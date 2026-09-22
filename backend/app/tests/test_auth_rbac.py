import pytest
from sqlalchemy import select

from app.auth.security import hash_password, verify_password
from app.models import AuditLog, MaleRequest, Role, User
from app.permissions.rbac import has_permission


MALE_REQUEST_PAYLOAD = {
    "male_characteristics": {
        "age": 31,
        "governorate": "دمشق",
        "height": 176,
        "values": ["العائلة"],
        "personality_traits": ["هادئ"],
        "preferred_contact_method": "MATCHMAKER",
    },
    "desired_female_characteristics": {
        "age_min": 24,
        "age_max": 32,
        "governorates": ["دمشق"],
        "values": ["العائلة"],
        "personality_traits": ["هادئة"],
    },
}


@pytest.mark.asyncio
async def test_register_login_refresh_rotation_and_reuse_detection(client):
    payload = {
        "first_name": "أحمد",
        "phone": "+963900123456",
        "password": "Strong-pass-123",
        "governorate": "دمشق",
        "date_of_birth": "1995-01-01",
    }
    registered = await client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 201
    data = registered.json()["data"]
    assert data["access_token"] == data["tokens"]["access_token"]
    old_refresh = data["refresh_token"]
    rotated = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert rotated.status_code == 200
    assert rotated.json()["data"]["refresh_token"] != old_refresh
    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "REFRESH_TOKEN_REUSED"
    revoked = await client.get(
        "/api/v1/me", headers={"Authorization": "Bearer " + rotated.json()["data"]["access_token"]}
    )
    assert revoked.status_code == 401


async def test_logout_revokes_access_and_refresh(client):
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Logout",
            "phone": "+963900123458",
            "password": "Strong-pass-123",
            "governorate": "Damascus",
            "date_of_birth": "1995-01-01",
        },
    )
    tokens = registered.json()["data"]
    headers = {"Authorization": "Bearer " + tokens["access_token"]}
    assert (await client.get("/api/v1/me", headers=headers)).status_code == 200
    assert (
        await client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 200
    assert (await client.get("/api/v1/me", headers=headers)).status_code == 401
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 401


def test_password_hash_and_rbac():
    encoded = hash_password("Strong-pass-123")
    assert verify_password("Strong-pass-123", encoded)
    admin = User(first_name="a", phone="1", password_hash=encoded, role=Role.SUPER_ADMIN)
    male = User(first_name="m", phone="2", password_hash=encoded, role=Role.MALE_USER)
    assert has_permission(admin, "settings.manage")
    assert not has_permission(male, "female_profiles.view")


async def _male_login(client, phone="+963900123499"):
    started = await client.post("/api/v1/auth/male/phone/start", json={"phone": phone})
    assert started.status_code == 200
    data = started.json()["data"]
    assert data["otp_required"] is False
    return data


@pytest.mark.asyncio
async def test_male_phone_passwordless_request_code_and_no_duplicate(client, db):
    first = await _male_login(client, "09 0012 3499")
    assert first["user"]["phone"] == "+963900123499"
    assert first["user"]["first_name"] is None

    users = list(await db.scalars(select(User).where(User.role == Role.MALE_USER)))
    assert len(users) == 1
    assert users[0].password_hash is None

    headers = {"Authorization": "Bearer " + first["access_token"]}
    created = await client.post("/api/v1/male/request", json=MALE_REQUEST_PAYLOAD, headers=headers)
    assert created.status_code == 201
    request = created.json()["data"]
    code = request["request_code"]
    assert code.startswith("FRH-")
    assert "2026-000001" not in code

    second = await _male_login(client, "00963900123499")
    assert second["user"]["id"] == first["user"]["id"]
    headers = {"Authorization": "Bearer " + second["access_token"]}
    same = await client.post("/api/v1/male/request", json=MALE_REQUEST_PAYLOAD, headers=headers)
    assert same.status_code == 201
    assert same.json()["data"]["id"] == request["id"]

    requests = list(await db.scalars(select(MaleRequest)))
    assert len(requests) == 1

    by_code = await client.post(
        "/api/v1/auth/male/request-code", json={"request_code": code.lower()}
    )
    assert by_code.status_code == 200
    assert by_code.json()["data"]["user"]["id"] == first["user"]["id"]
    headers = {"Authorization": "Bearer " + by_code.json()["data"]["access_token"]}
    restored = await client.get("/api/v1/male/request", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["data"]["id"] == request["id"]


@pytest.mark.asyncio
async def test_male_request_patch_preserves_request_and_recalculates(client, db, monkeypatch):
    calls = []

    async def fake_run_matching(self, request):
        calls.append(request.id)
        return {"count": 0, "message": "ok"}

    monkeypatch.setattr("app.services.domain.DomainService.run_matching", fake_run_matching)
    session = await _male_login(client, "09 0012 3500")
    headers = {"Authorization": "Bearer " + session["access_token"]}
    created = await client.post("/api/v1/male/request", json=MALE_REQUEST_PAYLOAD, headers=headers)
    assert created.status_code == 201
    request = created.json()["data"]
    payload = {
        "male_characteristics": {
            **request["male_characteristics"],
            "age": 35,
        },
        "desired_female_characteristics": {
            **request["desired_female_characteristics"],
            "age_min": 26,
            "age_max": 30,
        },
    }
    updated = await client.patch("/api/v1/male/request", json=payload, headers=headers)
    assert updated.status_code == 200
    data = updated.json()["data"]
    assert data["id"] == request["id"]
    assert data["request_code"] == request["request_code"]
    assert data["male_characteristics"]["age"] == 35
    assert data["desired_female_characteristics"]["age_min"] == 26
    assert data["desired_female_characteristics"]["age_max"] == 30
    assert calls == [request["id"]]
    requests = list(await db.scalars(select(MaleRequest)))
    assert len(requests) == 1
    audit_log = await db.scalar(
        select(AuditLog).where(AuditLog.action == "male_request.updated")
    )
    assert audit_log is not None
    assert "desired_female_characteristics.age_min" in audit_log.new_values["field_changes"]


@pytest.mark.asyncio
async def test_bad_request_code_is_generic_and_rate_limited(client):
    bad_code = "FRH-BAD1-CODE"
    for _ in range(5):
        response = await client.post(
            "/api/v1/auth/male/request-code", json={"request_code": bad_code}
        )
        assert response.status_code == 401
        assert response.json()["error"]["message"] == "رقم الطلب غير صحيح."
    limited = await client.post(
        "/api/v1/auth/male/request-code", json={"request_code": bad_code}
    )
    assert limited.status_code == 429


@pytest.mark.asyncio
async def test_male_phone_start_rejects_invalid_phone_as_api_error(client):
    response = await client.post("/api/v1/auth/male/phone/start", json={"phone": "not-a-phone"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_PHONE"
