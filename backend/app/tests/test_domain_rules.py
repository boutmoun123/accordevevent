from datetime import date

import pytest
from sqlalchemy import func, select

from app.auth.security import hash_password
from app.core.errors import AppError
from app.models import (
    AuditLog,
    Decision,
    MaleRequest,
    MatchCase,
    MatchCaseStatus,
    PaymentStatus,
    Role,
    User,
    VerificationStatus,
)
from app.schemas.domain import MaleRequestIn
from app.services.audit import audit
from app.services.domain import DomainService
from app.services.payment import ensure_contact_allowed, ensure_payment_transition
from app.services.state_machine import ensure_transition


@pytest.mark.asyncio
async def test_one_active_male_request_returns_existing(db):
    user = User(
        first_name="أحمد",
        phone="+963900000001",
        password_hash=hash_password("Strong-pass-123"),
        role=Role.MALE_USER,
        date_of_birth=date(1995, 1, 1),
    )
    db.add(user)
    await db.commit()
    service = DomainService(db)
    first, created = await service.create_or_get_request(
        user,
        MaleRequestIn(
            male_characteristics={"age": 31, "governorate": "دمشق"},
            desired_female_characteristics={"age_min": 24, "age_max": 32},
        ),
    )
    second, created_again = await service.create_or_get_request(
        user,
        MaleRequestIn(
            male_characteristics={"age": 33, "governorate": "دمشق"},
            desired_female_characteristics={"age_min": 24, "age_max": 32},
        ),
    )
    assert created and not created_again and first.id == second.id
    assert await db.scalar(select(func.count(MaleRequest.id))) == 1


def test_payment_and_match_state_rules():
    ensure_contact_allowed(VerificationStatus.VERIFIED, PaymentStatus.PAID)
    with pytest.raises(AppError):
        ensure_contact_allowed(VerificationStatus.PENDING, PaymentStatus.PAID)
    with pytest.raises(AppError):
        ensure_payment_transition(PaymentStatus.REFUNDED, PaymentStatus.PAID)
    ensure_transition(MatchCaseStatus.WAITING_MALE, MatchCaseStatus.MUTUAL_ACCEPTANCE)
    with pytest.raises(AppError):
        ensure_transition(MatchCaseStatus.CANDIDATE_SELECTED, MatchCaseStatus.MARRIED)


@pytest.mark.asyncio
async def test_mutual_acceptance_requires_both_decisions(db):
    case = MatchCase(
        candidate_id="c",
        male_request_id="r",
        female_profile_id="f",
        matchmaker_id="m",
        status=MatchCaseStatus.WAITING_MALE,
        female_decision=Decision.ACCEPTED,
        male_decision=Decision.PENDING,
    )
    with pytest.raises(AppError) as exc:
        await DomainService(db).transition_case(case, MatchCaseStatus.MUTUAL_ACCEPTANCE, "actor")
    assert exc.value.code == "MUTUAL_DECISIONS_REQUIRED"


@pytest.mark.asyncio
async def test_audit_log_is_persisted(db):
    await audit(
        db,
        actor_id=None,
        action="settings.updated",
        entity_type="system_setting",
        entity_id="x",
        old_values={"v": 1},
        new_values={"v": 2},
    )
    await db.commit()
    row = await db.scalar(select(AuditLog))
    assert row.action == "settings.updated" and row.old_values == {"v": 1}
