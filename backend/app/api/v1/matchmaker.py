from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import serialize
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.database.session import get_db
from app.models import (
    ContactAppointment,
    Conversation,
    FemaleLead,
    FemaleProfile,
    MaleRequest,
    MatchCandidate,
    MatchCase,
    MatchCaseStatus,
    Matchmaker,
    Meeting,
    MeetingFeedback,
    Notification,
    Payment,
    PaymentStatus,
    SystemSetting,
    User,
    VerificationStatus,
)
from app.permissions.rbac import require_permission
from app.schemas.common import ok
from app.schemas.domain import (
    AppointmentUpdate,
    FemaleLeadUpdate,
    FemaleProfileIn,
    FemaleProfileUpdate,
    MaleRequestUpdate,
    MatchCaseIn,
    MatchCaseUpdate,
    MeetingFeedbackIn,
    MeetingIn,
    MeetingUpdate,
    NotificationRead,
    PaymentIn,
    PaymentUpdate,
    WeeklyAvailabilityIn,
)
from app.services.audit import audit
from app.services.auth import AuthService
from app.services.domain import DomainService
from app.services.payment import ensure_payment_transition

router = APIRouter(prefix="/matchmaker", tags=["Matchmaker"])


async def matchmaker_row(user: User, db: AsyncSession) -> Matchmaker:
    row = await db.scalar(select(Matchmaker).where(Matchmaker.user_id == user.id))
    if not row:
        raise NotFoundError("MATCHMAKER_NOT_FOUND", "ظ…ظ„ظپ ط§ظ„ط®ط·ظ‘ط§ط¨ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    return row


async def request_by_code(db: AsyncSession, request_code: str) -> MaleRequest:
    try:
        return await AuthService(db).resolve_male_request_code(request_code, record_attempt=False)
    except AppError as exc:
        if exc.code == "INVALID_REQUEST_CODE":
            raise NotFoundError("REQUEST_NOT_FOUND", "الطلب غير موجود.") from exc
        raise


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)

    async def count(model, *filters):
        return await db.scalar(select(func.count(model.id)).where(*filters))

    return ok(
        {
            "active_profiles": await count(
                FemaleProfile,
                FemaleProfile.matchmaker_id == mm.id,
                FemaleProfile.status == "ACTIVE",
            ),
            "male_requests": await count(MaleRequest, MaleRequest.is_active.is_(True)),
            "new_leads": await count(FemaleLead, FemaleLead.status == "NEW"),
            "matches": await count(MatchCandidate, MatchCandidate.matchmaker_id == mm.id),
            "cases": await count(MatchCase, MatchCase.matchmaker_id == mm.id),
        }
    )


@router.get("/female-profiles")
async def female_profiles(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    rows = list(
        await db.scalars(
            select(FemaleProfile)
            .where(FemaleProfile.matchmaker_id == mm.id)
            .order_by(FemaleProfile.created_at.desc())
        )
    )
    return ok(serialize(rows))


@router.post("/female-profiles", status_code=201)
async def create_female_profile(
    payload: FemaleProfileIn,
    user: User = Depends(require_permission("female_profiles.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    return ok(serialize(await DomainService(db).create_female_profile(mm.id, payload, user.id)))


@router.get("/female-profiles/{profile_id}")
async def get_female_profile(
    profile_id: str,
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await db.scalar(
        select(FemaleProfile).where(
            FemaleProfile.id == profile_id, FemaleProfile.matchmaker_id == mm.id
        )
    )
    if not row:
        raise NotFoundError()
    return ok(serialize(row))


@router.patch("/female-profiles/{profile_id}")
async def update_female_profile(
    profile_id: str,
    payload: FemaleProfileUpdate,
    user: User = Depends(require_permission("female_profiles.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await db.scalar(
        select(FemaleProfile).where(
            FemaleProfile.id == profile_id, FemaleProfile.matchmaker_id == mm.id
        )
    )
    if not row:
        raise NotFoundError()
    return ok(serialize(await DomainService(db).update_female_profile(row, payload, user.id)))


@router.get("/male-requests")
async def male_requests(
    request_code: str | None = None,
    user: User = Depends(require_permission("male_requests.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    stmt = (
        select(MaleRequest)
        .where(
            (MaleRequest.assigned_matchmaker_id == mm.id)
            | (MaleRequest.assigned_matchmaker_id.is_(None))
        )
        .order_by(MaleRequest.created_at.desc())
    )
    if request_code:
        request = await request_by_code(db, request_code)
        stmt = stmt.where(MaleRequest.id == request.id)
    return ok(serialize(list(await db.scalars(stmt))))


@router.get("/male-requests/{request_code}")
async def male_request(
    request_code: str,
    user: User = Depends(require_permission("male_requests.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await request_by_code(db, request_code)
    if not row:
        raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if row.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ظ‘ط§ط¨ط© ط£ط®ط±ظ‰.")
    candidates = list(
        await db.scalars(
            select(MatchCandidate)
            .where(MatchCandidate.male_request_id == row.id)
            .order_by(MatchCandidate.mutual_score.desc())
        )
    )
    return ok({"request": serialize(row), "candidates": serialize(candidates)})


@router.patch("/male-requests/{request_code}")
async def update_male_request(
    request_code: str,
    payload: MaleRequestUpdate,
    user: User = Depends(require_permission("male_requests.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await request_by_code(db, request_code)
    if not row:
        raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if row.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ط§ط¨ط© ط£ط®ط±ظ‰.")
    if row.assigned_matchmaker_id is None:
        row.assigned_matchmaker_id = mm.id
    updated = await DomainService(db).update_matchmaker_request(row, payload, user.id)
    candidates = list(
        await db.scalars(
            select(MatchCandidate)
            .where(MatchCandidate.male_request_id == updated.id)
            .order_by(MatchCandidate.mutual_score.desc())
        )
    )
    return ok({"request": serialize(updated), "candidates": serialize(candidates)})


@router.post("/male-requests/{request_code}/verify")
async def verify_male_request(
    request_code: str,
    status: VerificationStatus,
    user: User = Depends(require_permission("male_requests.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await request_by_code(db, request_code)
    if not row:
        raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if row.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ظ‘ط§ط¨ط© ط£ط®ط±ظ‰.")
    old = row.verification_status
    row.assigned_matchmaker_id, row.verification_status = mm.id, status
    await audit(
        db,
        actor_id=user.id,
        action="male_request.verification_changed",
        entity_type="male_request",
        entity_id=row.id,
        old_values={"verification_status": old.value},
        new_values={"verification_status": status.value},
    )
    await db.commit()
    return ok(serialize(row))


@router.post("/male-requests/{request_code}/matching/run")
async def run_request_matching(
    request_code: str,
    user: User = Depends(require_permission("matches.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    row = await request_by_code(db, request_code)
    if not row:
        raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if row.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ظ‘ط§ط¨ط© ط£ط®ط±ظ‰.")
    if row.assigned_matchmaker_id is None:
        row.assigned_matchmaker_id = mm.id
    result = await DomainService(db).run_matching(row)
    return ok(result)


@router.get("/matches")
async def matches(
    user: User = Depends(require_permission("matches.view")), db: AsyncSession = Depends(get_db)
):
    mm = await matchmaker_row(user, db)
    rows = list(
        (
            await db.execute(
                select(MatchCandidate, MaleRequest, FemaleProfile.public_code)
                .join(MaleRequest, MatchCandidate.male_request_id == MaleRequest.id)
                .join(FemaleProfile, MatchCandidate.female_profile_id == FemaleProfile.id)
                .where(MatchCandidate.matchmaker_id == mm.id)
                .order_by(MatchCandidate.mutual_score.desc())
            )
        ).all()
    )
    return ok(
        [
            {
                **serialize(candidate),
                "male_request_code": request.request_code,
                "female_public_code": public_code,
            }
            for candidate, request, public_code in rows
        ]
    )


@router.get("/female-leads")
async def female_leads(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    rows = list(
        await db.scalars(
            select(FemaleLead)
            .where(
                (FemaleLead.assigned_matchmaker_id == mm.id)
                | (FemaleLead.assigned_matchmaker_id.is_(None))
            )
            .order_by(FemaleLead.created_at.desc())
        )
    )
    result = []
    for lead in rows:
        appointment = await db.scalar(
            select(ContactAppointment).where(ContactAppointment.female_lead_id == lead.id)
        )
        from app.services.availability import appointment_json

        details = appointment_json(appointment) if appointment else {}
        result.append(
            {
                **serialize(lead),
                "appointment_id": details.get("id"),
                "scheduled_at": details.get("scheduled_at"),
                "ends_at": details.get("ends_at"),
                "appointment_status": details.get("status"),
            }
        )
    return ok(result)


@router.patch("/female-leads/{lead_id}")
async def update_female_lead(
    lead_id: str,
    payload: FemaleLeadUpdate,
    user: User = Depends(require_permission("female_profiles.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    lead = await db.get(FemaleLead, lead_id)
    if not lead:
        raise NotFoundError("LEAD_NOT_FOUND", "ط·ظ„ط¨ ط§ظ„طھظˆط§طµظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if lead.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ط·ظ„ط¨ ط§ظ„طھظˆط§طµظ„ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ظ‘ط§ط¨ط© ط£ط®ط±ظ‰.")
    old = lead.status
    lead.assigned_matchmaker_id = mm.id
    lead.status = payload.status
    await audit(
        db,
        actor_id=user.id,
        action="female_lead.status_changed",
        entity_type="female_lead",
        entity_id=lead.id,
        old_values={"status": old.value},
        new_values={"status": lead.status.value},
    )
    await db.commit()
    return ok(serialize(lead))


@router.get("/match-cases")
async def match_cases(
    user: User = Depends(require_permission("matches.view")), db: AsyncSession = Depends(get_db)
):
    mm = await matchmaker_row(user, db)
    return ok(
        serialize(
            list(
                await db.scalars(
                    select(MatchCase)
                    .where(MatchCase.matchmaker_id == mm.id)
                    .order_by(MatchCase.created_at.desc())
                )
            )
        )
    )


@router.get("/meetings")
async def meetings(
    user: User = Depends(require_permission("matches.view")), db: AsyncSession = Depends(get_db)
):
    mm = await matchmaker_row(user, db)
    rows = list(
        await db.scalars(
            select(Meeting)
            .join(MatchCase, Meeting.match_case_id == MatchCase.id)
            .where(MatchCase.matchmaker_id == mm.id)
            .order_by(Meeting.scheduled_at.desc())
        )
    )
    return ok(serialize(rows))


@router.get("/payments")
async def payments(
    user: User = Depends(require_permission("payments.view")), db: AsyncSession = Depends(get_db)
):
    mm = await matchmaker_row(user, db)
    rows = list(
        await db.scalars(
            select(Payment)
            .join(MaleRequest, Payment.male_request_id == MaleRequest.id)
            .where(MaleRequest.assigned_matchmaker_id == mm.id)
            .order_by(Payment.created_at.desc())
        )
    )
    return ok(serialize(rows))


@router.get("/conversations")
async def conversations(
    user: User = Depends(require_permission("male_requests.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    rows = list(
        await db.scalars(
            select(Conversation)
            .join(MaleRequest, Conversation.user_id == MaleRequest.male_user_id)
            .where(MaleRequest.assigned_matchmaker_id == mm.id)
            .order_by(Conversation.updated_at.desc())
        )
    )
    # Conversation state may include male-supplied contact-like text; matchmakers are authorized,
    # but raw message bodies remain behind the request detail workflow rather than this index.
    return ok(serialize(rows))


@router.get("/notifications")
async def notifications(
    user: User = Depends(require_permission("notifications.view")),
    db: AsyncSession = Depends(get_db),
):
    return ok(
        serialize(
            list(
                await db.scalars(
                    select(Notification)
                    .where(Notification.user_id == user.id)
                    .order_by(Notification.created_at.desc())
                    .limit(100)
                )
            )
        )
    )


@router.patch("/notifications/{notification_id}")
async def read_notification(
    notification_id: str,
    payload: NotificationRead,
    user: User = Depends(require_permission("notifications.view")),
    db: AsyncSession = Depends(get_db),
):
    notification = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if not notification:
        raise NotFoundError("NOTIFICATION_NOT_FOUND", "ط§ظ„ط¥ط´ط¹ط§ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    notification.read_at = datetime.now(timezone.utc) if payload.read else None
    await db.commit()
    return ok(serialize(notification))


@router.get("/profile")
async def own_profile(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    return ok({"user": serialize(user, exclude={"password_hash"}), "matchmaker": serialize(mm)})


@router.get("/settings")
async def public_settings(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"support_phone", "support_whatsapp", "contact_opening_fee", "success_fee"}
    rows = list(await db.scalars(select(SystemSetting).where(SystemSetting.key.in_(allowed))))
    return ok({row.key: row.value for row in rows})


@router.post("/payments", status_code=201)
async def create_payment(
    payload: PaymentIn,
    user: User = Depends(require_permission("payments.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    male_request = await db.get(MaleRequest, payload.male_request_id)
    if not male_request:
        raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    if male_request.assigned_matchmaker_id not in (None, mm.id):
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ظ†ط¯ ط¥ظ„ظ‰ ط®ط·ظ‘ط§ط¨ط© ط£ط®ط±ظ‰.")
    male_request.assigned_matchmaker_id = mm.id
    if payload.match_case_id:
        linked_case = await db.get(MatchCase, payload.match_case_id)
        if (
            not linked_case
            or linked_case.male_request_id != male_request.id
            or linked_case.matchmaker_id != mm.id
        ):
            raise ForbiddenError(
                "ط­ط§ظ„ط© ط§ظ„طھظˆط§ظپظ‚ ظ„ط§ طھطھط¨ط¹ ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ط£ظˆ ظ‡ط°ظ‡ ط§ظ„ط®ط·ظ‘ط§ط¨ط©."
            )
    amount = Decimal(str(await DomainService(db).setting("contact_opening_fee", 0)))
    if payload.amount is not None and payload.amount != amount:
        raise AppError(
            "FEE_MISMATCH", "ظ‚ظٹظ…ط© ط§ظ„ط£طھط¹ط§ط¨ طھط­ط¯ط¯ظ‡ط§ ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ†ط¸ط§ظ….", 422
        )
    payment = Payment(**payload.model_dump(exclude={"amount"}), amount=amount)
    if payment.status == PaymentStatus.PAID:
        payment.paid_at = datetime.now(timezone.utc)
    db.add(payment)
    await db.flush()
    await audit(
        db,
        actor_id=user.id,
        action="payment.created",
        entity_type="payment",
        entity_id=payment.id,
        new_values={"status": payment.status.value, "amount": str(payment.amount)},
    )
    await db.commit()
    return ok(serialize(payment))


@router.patch("/payments/{payment_id}")
async def update_payment(
    payment_id: str,
    payload: PaymentUpdate,
    user: User = Depends(require_permission("payments.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise NotFoundError("PAYMENT_NOT_FOUND", "ط§ظ„ط¯ظپط¹ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©.")
    male_request = await db.get(MaleRequest, payment.male_request_id)
    if not male_request or male_request.assigned_matchmaker_id != mm.id:
        raise ForbiddenError("ظ‡ط°ظ‡ ط§ظ„ط¯ظپط¹ط© ظ„ط§ طھطھط¨ط¹ ط·ظ„ط¨ظ‹ط§ ظ…ط³ظ†ط¯ظ‹ط§ ط¥ظ„ظٹظƒ.")
    ensure_payment_transition(payment.status, payload.status)
    old = {
        "status": payment.status.value,
        "method": payment.method,
        "reference": payment.reference,
    }
    payment.status = payload.status
    if payload.method is not None:
        payment.method = payload.method
    if payload.reference is not None:
        payment.reference = payload.reference
    if payment.status == PaymentStatus.PAID:
        payment.paid_at = datetime.now(timezone.utc)
    await audit(
        db,
        actor_id=user.id,
        action="payment.updated",
        entity_type="payment",
        entity_id=payment.id,
        old_values=old,
        new_values=payload.model_dump(mode="json", exclude_none=True),
    )
    await db.commit()
    return ok(serialize(payment))


@router.post("/match-cases", status_code=201)
async def create_match_case(
    payload: MatchCaseIn,
    user: User = Depends(require_permission("matches.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    candidate = await db.get(MatchCandidate, payload.candidate_id)
    if not candidate or candidate.matchmaker_id != mm.id:
        raise NotFoundError("CANDIDATE_NOT_FOUND", "ظپط±طµط© ط§ظ„طھظˆط§ظپظ‚ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©.")
    return ok(serialize(await DomainService(db).create_case(candidate, mm.id, user.id)))


@router.patch("/match-cases/{case_id}")
async def update_match_case(
    case_id: str,
    payload: MatchCaseUpdate,
    user: User = Depends(require_permission("matches.manage")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(MatchCase, case_id)
    if not case:
        raise NotFoundError()
    mm = await matchmaker_row(user, db)
    if case.matchmaker_id != mm.id:
        raise ForbiddenError("ظ‡ط°ظ‡ ط§ظ„ط­ط§ظ„ط© ظ„ظٹط³طھ ظ…ط³ظ†ط¯ط© ط¥ظ„ظٹظƒ.")
    if payload.female_decision is not None:
        case.female_decision = payload.female_decision
    if payload.male_decision is not None:
        case.male_decision = payload.male_decision
    if payload.status is not None:
        case = await DomainService(db).transition_case(
            case, payload.status, user.id, payload.reason
        )
    else:
        await audit(
            db,
            actor_id=user.id,
            action="match_case.decisions_updated",
            entity_type="match_case",
            entity_id=case.id,
            new_values=payload.model_dump(mode="json", exclude_none=True),
        )
        await db.commit()
    return ok(serialize(case))


@router.post("/meetings", status_code=201)
async def create_meeting(
    payload: MeetingIn,
    user: User = Depends(require_permission("meetings.manage")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(MatchCase, payload.match_case_id)
    if not case:
        raise NotFoundError()
    mm = await matchmaker_row(user, db)
    if case.matchmaker_id != mm.id:
        raise ForbiddenError("ظ‡ط°ظ‡ ط§ظ„ط­ط§ظ„ط© ظ„ظٹط³طھ ظ…ط³ظ†ط¯ط© ط¥ظ„ظٹظƒ.")
    if case.status != MatchCaseStatus.MUTUAL_ACCEPTANCE:
        raise AppError(
            "MEETING_NOT_ALLOWED",
            "ظ„ط§ ظٹظ…ظƒظ† ط¥ظ†ط´ط§ط، ظ„ظ‚ط§ط، ظ‚ط¨ظ„ ط§ظ„ظ‚ط¨ظˆظ„ ط§ظ„ظ…طھط¨ط§ط¯ظ„.",
            409,
        )
    meeting = Meeting(**payload.model_dump())
    db.add(meeting)
    await db.flush()
    await audit(
        db,
        actor_id=user.id,
        action="meeting.created",
        entity_type="meeting",
        entity_id=meeting.id,
        new_values={"scheduled_at": payload.scheduled_at.isoformat()},
    )
    await DomainService(db).transition_case(
        case, MatchCaseStatus.MEETING_SCHEDULED, user.id, "Meeting scheduled"
    )
    return ok(serialize(meeting))


@router.patch("/meetings/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    user: User = Depends(require_permission("meetings.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise NotFoundError("MEETING_NOT_FOUND", "ط§ظ„ظ„ظ‚ط§ط، ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    case = await db.get(MatchCase, meeting.match_case_id)
    if not case or case.matchmaker_id != mm.id:
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ظ„ظ‚ط§ط، ظ„ظٹط³ ظ…ط³ظ†ط¯ظ‹ط§ ط¥ظ„ظٹظƒ.")
    meeting.status = payload.status
    await audit(
        db,
        actor_id=user.id,
        action="meeting.completed",
        entity_type="meeting",
        entity_id=meeting.id,
        new_values={"status": payload.status},
    )
    await DomainService(db).transition_case(
        case, MatchCaseStatus.MEETING_COMPLETED, user.id, "Meeting completed"
    )
    return ok(serialize(meeting))


@router.post("/meetings/{meeting_id}/feedback", status_code=201)
async def meeting_feedback(
    meeting_id: str,
    payload: MeetingFeedbackIn,
    user: User = Depends(require_permission("meetings.manage")),
    db: AsyncSession = Depends(get_db),
):
    mm = await matchmaker_row(user, db)
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise NotFoundError("MEETING_NOT_FOUND", "ط§ظ„ظ„ظ‚ط§ط، ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
    case = await db.get(MatchCase, meeting.match_case_id)
    if not case or case.matchmaker_id != mm.id:
        raise ForbiddenError("ظ‡ط°ط§ ط§ظ„ظ„ظ‚ط§ط، ظ„ظٹط³ ظ…ط³ظ†ط¯ظ‹ط§ ط¥ظ„ظٹظƒ.")
    if meeting.status != "COMPLETED":
        raise AppError(
            "MEETING_NOT_COMPLETED",
            "ظ„ط§ ظٹظ…ظƒظ† ط¥ط¶ط§ظپط© طھظ‚ظٹظٹظ… ظ‚ط¨ظ„ ط§ظƒطھظ…ط§ظ„ ط§ظ„ظ„ظ‚ط§ط،.",
            409,
        )
    row = await db.scalar(
        select(MeetingFeedback).where(
            MeetingFeedback.meeting_id == meeting.id, MeetingFeedback.party == payload.party
        )
    )
    if row:
        row.decision, row.notes = payload.decision, payload.notes
    else:
        row = MeetingFeedback(meeting_id=meeting.id, **payload.model_dump())
        db.add(row)
    await db.flush()
    await audit(
        db,
        actor_id=user.id,
        action="meeting.feedback_recorded",
        entity_type="meeting_feedback",
        entity_id=row.id,
        new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return ok(serialize(row))


@router.get("/availability")
async def availability(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.availability import weekly_schedule

    mm = await matchmaker_row(user, db)
    return ok(await weekly_schedule(db, mm))


@router.patch("/availability")
async def update_availability(
    payload: WeeklyAvailabilityIn,
    user: User = Depends(require_permission("female_profiles.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.availability import save_schedule

    mm = await matchmaker_row(user, db)
    return ok(await save_schedule(db, mm.id, payload))


@router.get("/appointments")
async def appointments(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.availability import appointment_json

    mm = await matchmaker_row(user, db)
    rows = (
        await db.execute(
            select(ContactAppointment, FemaleLead)
            .join(FemaleLead, FemaleLead.id == ContactAppointment.female_lead_id)
            .where(ContactAppointment.matchmaker_id == mm.id)
            .order_by(ContactAppointment.appointment_date.desc(), ContactAppointment.start_time)
        )
    ).all()
    return ok(
        [
            {
                **appointment_json(a),
                "phone": lead.phone,
                "governorate": lead.governorate,
                "notes": lead.notes,
            }
            for a, lead in rows
        ]
    )


@router.patch("/appointments/{appointment_id}")
async def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    user: User = Depends(require_permission("female_profiles.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.availability import change_appointment

    mm = await matchmaker_row(user, db)
    return ok(await change_appointment(db, mm.id, appointment_id, payload.status))
