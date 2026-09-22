"""API integration coverage with real SQL persistence and isolated external adapters."""

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.auth.security import create_access_token
from app.models import (
    AuditLog,
    FemaleProfile,
    MaleRequest,
    MatchCandidate,
    MatchCaseHistory,
    Matchmaker,
    Role,
    SystemSetting,
    User,
    UserStatus,
    VerificationStatus,
)
from app.rag.adapters import GeminiAdapter, QdrantAdapter


async def actor(
    db, role=Role.MATCHMAKER, verification=VerificationStatus.VERIFIED, status=UserStatus.ACTIVE
):
    user = User(
        first_name="Test actor",
        phone="+963" + str(uuid4().int)[:9],
        password_hash="unused",
        role=role,
        status=status,
    )
    db.add(user)
    await db.flush()
    if role == Role.MATCHMAKER and verification is not None:
        db.add(Matchmaker(user_id=user.id, verification_status=verification))
    await db.commit()
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.parametrize("verification", ["PENDING", "REJECTED", "VERIFIED", None])
@pytest.mark.parametrize("status", list(UserStatus))
async def test_matchmaker_authorization_matrix(client, db, verification, status):
    headers = await actor(db, verification=verification, status=status)
    for endpoint in ["dashboard", "female-profiles", "male-requests", "payments", "meetings"]:
        response = await client.get(f"/api/v1/matchmaker/{endpoint}", headers=headers)
        assert response.status_code == (
            200 if verification == "VERIFIED" and status == "ACTIVE" else 403
        )


@pytest.mark.parametrize(
    "patch",
    [
        {"age": 17},
        {"age": True},
        {"age": 91},
        {"height": 170.5},
        {"height": "170"},
        {"values": "family"},
        {"values": [123]},
        {"governorate": {}},
        {"unexpected": True},
    ],
)
async def test_invalid_male_contract_is_422(client, db, patch):
    headers = await actor(db, Role.MALE_USER)
    response = await client.post(
        "/api/v1/male/request",
        headers=headers,
        json={
            "male_characteristics": {"age": 30, "governorate": "Damascus", **patch},
            "desired_female_characteristics": {"age_min": 20, "age_max": 30},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["fields"]


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "UNKNOWN"},
        {"status": None},
        {"age": None},
        {"desired_male": {"age_min": 40, "age_max": 20}},
        {"desired_male": {"height_min": 190, "height_max": 160}},
        {"contact_preference": "UNKNOWN"},
        {"desired_male": []},
    ],
)
async def test_invalid_female_update_is_422(client, db, payload):
    response = await client.patch(
        "/api/v1/matchmaker/female-profiles/missing", headers=await actor(db), json=payload
    )
    assert response.status_code == 422


async def test_female_profile_create_get_patch_persists(client, db):
    headers = await actor(db)
    payload = {
        "first_name": "Salamoun",
        "last_name": "Peter",
        "phone": "09874127220",
        "email": "petersalamoun2004@gmail.com",
        "age": 37,
        "governorate": "دمشق",
        "city": "دمشق",
        "height": 150,
        "education": "معهد",
        "occupation": "عمل حر",
        "marital_status": "DIVORCED",
        "hijab_status": "NONE",
        "status": "ACTIVE",
        "desired_male": {
            "age_min": 25,
            "age_max": 30,
            "height_min": 120,
            "education": "ثانوي",
            "profession_preference": "لا أعمل حاليا",
            "marital_status": "SINGLE",
        },
        "contact_preference": "GUARDIAN_FIRST",
    }

    created = await client.post("/api/v1/matchmaker/female-profiles", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    profile_id = data["id"]
    assert data["contact_preference"] == "GUARDIAN_FIRST"

    row = await db.get(FemaleProfile, profile_id)
    assert row is not None
    assert row.first_name == "Salamoun"
    assert row.desired_male["height_min"] == 120

    fetched = await client.get(f"/api/v1/matchmaker/female-profiles/{profile_id}", headers=headers)
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["data"]["desired_male"]["marital_status"] == "SINGLE"

    patched = await client.patch(
        f"/api/v1/matchmaker/female-profiles/{profile_id}",
        headers=headers,
        json={"height": 160, "desired_male": {**payload["desired_male"], "height_min": 130}},
    )
    assert patched.status_code == 200, patched.text
    await db.refresh(row)
    assert row.height == 160
    assert row.desired_male["height_min"] == 130

    invalid = await client.post(
        "/api/v1/matchmaker/female-profiles",
        headers=headers,
        json={**payload, "phone": "09874127221", "height": 110},
    )
    assert invalid.status_code == 422


async def test_malformed_json_and_null_request_sections(client, db):
    headers = await actor(db, Role.MALE_USER)
    response = await client.post(
        "/api/v1/male/request",
        headers={**headers, "Content-Type": "application/json"},
        content='{"broken":',
    )
    assert response.status_code == 422

    response = await client.patch(
        "/api/v1/male/request", headers=headers, json={"male_characteristics": None}
    )
    assert response.status_code == 422


@pytest.mark.parametrize("role", [Role.MALE_USER, Role.MATCHMAKER])
async def test_admin_namespace_never_accepts_shared_role_permissions(client, db, role):
    headers = await actor(db, role)
    for endpoint in [
        "dashboard",
        "users",
        "female-profiles",
        "male-requests",
        "matches",
        "match-cases",
        "payments",
        "meetings",
        "settings",
        "audit-logs",
    ]:
        response = await client.get(f"/api/v1/admin/{endpoint}", headers=headers)
        assert response.status_code == 403, endpoint


async def test_admin_lists_and_user_mutations(client, db):
    headers = await actor(db, Role.SUPER_ADMIN)
    for endpoint in [
        "dashboard",
        "users?search=Test&page=1&page_size=1",
        "matchmakers",
        "female-profiles",
        "male-requests",
        "match-cases",
        "meetings",
        "payments",
        "notifications",
        "reports",
        "settings",
        "audit-logs",
        "permissions",
    ]:
        assert (await client.get(f"/api/v1/admin/{endpoint}", headers=headers)).status_code == 200
    user_id = await db.scalar(select(User.id))
    response = await client.patch(
        f"/api/v1/admin/users/{user_id}", headers=headers, json={"first_name": "Updated name"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["first_name"] == "Updated name"
    permissions = (await client.get("/api/v1/admin/permissions", headers=headers)).json()["data"]
    assert len(permissions) == len({item["id"] for item in permissions})


async def test_full_intake_matching_payment_meeting_marriage(client, db, monkeypatch):
    monkeypatch.setattr(GeminiAdapter, "extract", AsyncMock(return_value=None))
    embed = AsyncMock(return_value=[0.1, 0.2])
    upsert = AsyncMock(return_value=True)
    monkeypatch.setattr(GeminiAdapter, "embed", embed)
    monkeypatch.setattr(QdrantAdapter, "upsert", upsert)
    monkeypatch.setattr(QdrantAdapter, "delete", AsyncMock(return_value=True))
    monkeypatch.setattr(QdrantAdapter, "search", AsyncMock(return_value=None))
    mm = await actor(db)
    db.add(SystemSetting(key="contact_opening_fee", value=75))
    await db.commit()
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "أحمد",
            "phone": "+963955112233",
            "password": "Strong-pass-123",
            "governorate": "دمشق",
            "date_of_birth": "1995-01-01",
        },
    )
    assert registered.status_code == 201
    male = {"Authorization": "Bearer " + registered.json()["data"]["access_token"]}
    answers = [
        "31",
        "دمشق",
        "المدينة",
        "أعزب",
        "180",
        "جامعي",
        "تخطي",
        "مهندس",
        "موظف",
        "لا",
        "العائلة",
        "هادئ",
        "يتواصل أهلي مع أهلها",
        "24 إلى 30",
        "لا يهم",
        "تخطي",
        "لا يهم",
        "لا يهم",
        "لا يهم",
        "لا",
        "لا يهم",
        "لا يهم",
        "العائلة",
        "هادئة",
        "لا يوجد",
    ]
    for answer in answers:
        response = await client.post(
            "/api/v1/chat/message",
            headers=male,
            json={"session_key": "integration-session", "gender": "MALE", "message": answer},
        )
        assert response.status_code == 200, response.text
        if answer == "يتواصل أهلي مع أهلها":
            data = response.json()["data"]
            assert data["structured_state"]["male"]["preferred_contact_method"] == "FAMILIES"
            assert "المجال العمري" in data["reply"]
            restored = await client.get(
                "/api/v1/chat/session?session_key=integration-session", headers=male
            )
            assert (
                restored.json()["data"]["state"]["male"]["preferred_contact_method"] == "FAMILIES"
            )
    chat = response.json()["data"]
    assert chat["completed"]
    payload = {
        "male_characteristics": chat["structured_state"]["male"],
        "desired_female_characteristics": chat["structured_state"]["desired_female"],
    }
    request = await client.post("/api/v1/male/request", headers=male, json=payload)
    assert request.status_code == 201, request.text
    request = request.json()["data"]
    duplicate = await client.post("/api/v1/male/request", headers=male, json=payload)
    assert duplicate.json()["data"]["id"] == request["id"]
    assert await db.scalar(select(func.count(MaleRequest.id))) == 1
    code = request["request_code"]
    assert code.startswith("FRH-")
    schedule = (await client.get("/api/v1/matchmaker/availability", headers=mm)).json()["data"]
    schedule.pop("timezone")
    schedule["days"] = [
        {"weekday": d, "is_active": True, "ranges": [{"start_time": "00:00", "end_time": "23:59"}]}
        for d in range(7)
    ]
    assert (
        await client.patch("/api/v1/matchmaker/availability", headers=mm, json=schedule)
    ).status_code == 200
    slot = (await client.get("/api/v1/contact-availability")).json()["data"][0]
    lead = await client.post(
        "/api/v1/female-leads",
        json={
            "matchmaker_id": slot["matchmaker_id"],
            "scheduled_at": slot["scheduled_at"],
            "phone": "+963966112233",
            "governorate": "دمشق",
            "consent": True,
        },
    )
    assert lead.status_code == 201
    leads = await client.get("/api/v1/matchmaker/female-leads", headers=mm)
    assert lead.json()["data"]["id"] in [row["id"] for row in leads.json()["data"]]
    female_chat = await client.post(
        "/api/v1/chat/message",
        json={"session_key": "female-integration", "gender": "FEMALE", "message": "ابحثي عن شباب"},
    )
    assert female_chat.status_code == 200
    assert female_chat.json()["data"]["structured_state"] == {}
    secrets = [
        "SecretFirst",
        "SecretLast",
        "+963977112233",
        "secret@example.com",
        "Secret street 567",
        "Confidential notes",
    ]
    profile_data = dict(
        zip(
            ["first_name", "last_name", "phone", "email", "exact_address", "private_notes"],
            secrets,
            strict=True,
        )
    )
    profile_data.update(
        age=26,
        governorate="دمشق",
        children=False,
        values=["العائلة"],
        personality_traits=["هادئة"],
        desired_male={"age_min": 28, "age_max": 35},
        status="ACTIVE",
    )
    profile = await client.post("/api/v1/matchmaker/female-profiles", headers=mm, json=profile_data)
    assert profile.status_code == 201, profile.text
    profile_id = profile.json()["data"]["id"]
    upsert.assert_awaited_once()
    for secret in secrets:
        assert secret not in json.dumps(upsert.call_args.args, ensure_ascii=False)
        assert secret not in str(embed.call_args_list)
    # Untrusted semantic IDs cannot create a candidate outside SQL eligibility.
    for status in ["HIDDEN", "ARCHIVED", "MATCHED", "DRAFT"]:
        hidden = await client.post(
            "/api/v1/matchmaker/female-profiles",
            headers=mm,
            json={**profile_data, "status": status},
        )
        assert hidden.status_code == 201
    monkeypatch.setattr(
        QdrantAdapter, "search", AsyncMock(return_value=[profile_id, "hallucinated-id"])
    )
    matched = await client.post("/api/v1/matching/run", headers=male)
    assert matched.status_code == 200, matched.text
    assert matched.json()["data"]["count"] == 1
    assert set(matched.json()["data"]) == {"count", "quality", "message"}
    candidates = list(await db.scalars(select(MatchCandidate)))
    assert len(candidates) == 1 and candidates[0].female_profile_id == profile_id
    for path in [
        "/male/request",
        "/matching/count",
        "/chat/session?session_key=integration-session",
    ]:
        response = await client.get("/api/v1" + path, headers=male)
        assert response.status_code == 200
        for secret in secrets:
            assert secret not in response.text
    assert (
        await client.get(f"/api/v1/matchmaker/female-profiles/{profile_id}", headers=male)
    ).status_code == 403
    selected = {"candidate_id": candidates[0].id}
    assert (
        await client.post("/api/v1/matchmaker/match-cases", headers=mm, json=selected)
    ).status_code == 409
    assert (
        await client.get(f"/api/v1/matchmaker/male-requests/{code}", headers=mm)
    ).status_code == 200
    assert (
        await client.post(
            f"/api/v1/matchmaker/male-requests/{code}/verify?status=VERIFIED", headers=mm
        )
    ).status_code == 200
    payment = await client.post(
        "/api/v1/matchmaker/payments",
        headers=mm,
        json={"male_request_id": request["id"], "status": "WAIVED"},
    )
    assert payment.status_code == 201, payment.text
    assert float(payment.json()["data"]["amount"]) == 75
    case = await client.post("/api/v1/matchmaker/match-cases", headers=mm, json=selected)
    assert case.status_code == 201, case.text
    case_id = case.json()["data"]["id"]
    meeting_payload = {
        "match_case_id": case_id,
        "meeting_type": "FAMILY",
        "scheduled_at": "2027-01-01T12:00:00Z",
    }
    assert (
        await client.post("/api/v1/matchmaker/meetings", headers=mm, json=meeting_payload)
    ).status_code == 409
    assert (
        await client.patch(
            f"/api/v1/matchmaker/match-cases/{case_id}", headers=mm, json={"status": "MARRIED"}
        )
    ).status_code == 409
    for status, extra in [
        ("WAITING_FEMALE", {}),
        ("FEMALE_ACCEPTED", {"female_decision": "ACCEPTED"}),
        ("WAITING_MALE", {}),
        ("MUTUAL_ACCEPTANCE", {"male_decision": "ACCEPTED"}),
    ]:
        response = await client.patch(
            f"/api/v1/matchmaker/match-cases/{case_id}",
            headers=mm,
            json={"status": status, **extra},
        )
        assert response.status_code == 200, response.text
    meeting = await client.post("/api/v1/matchmaker/meetings", headers=mm, json=meeting_payload)
    assert meeting.status_code == 201, meeting.text
    meeting_id = meeting.json()["data"]["id"]
    assert (
        await client.patch(
            f"/api/v1/matchmaker/meetings/{meeting_id}", headers=mm, json={"status": "COMPLETED"}
        )
    ).status_code == 200
    for party in ["MALE", "FEMALE"]:
        assert (
            await client.post(
                f"/api/v1/matchmaker/meetings/{meeting_id}/feedback",
                headers=mm,
                json={"party": party, "decision": "CONTINUE"},
            )
        ).status_code == 201
    for status in ["FOLLOW_UP", "SERIOUS_CONTACT", "ENGAGED", "MARRIED"]:
        response = await client.patch(
            f"/api/v1/matchmaker/match-cases/{case_id}", headers=mm, json={"status": status}
        )
        assert response.status_code == 200, response.text
    assert await db.scalar(select(func.count(MatchCaseHistory.id))) == 11
    assert await db.scalar(select(func.count(AuditLog.id))) >= 15
    profile = await db.get(FemaleProfile, profile_id)
    assert profile.status == "MATCHED"
