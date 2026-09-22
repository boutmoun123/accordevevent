from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import serialize
from app.auth.dependencies import current_user
from app.auth.security import hash_password
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.database.session import get_db
from app.models import (
    AuditLog,
    FemaleLead,
    FemaleProfile,
    MaleRequest,
    MatchCandidate,
    MatchCase,
    MatchCaseStatus,
    Matchmaker,
    Meeting,
    Notification,
    Payment,
    Report,
    Role,
    SystemSetting,
    User,
    UserStatus,
    VerificationStatus,
)
from app.permissions.rbac import ROLE_PERMISSIONS, require_permission
from app.schemas.common import ok
from app.schemas.domain import (
    MatchCaseUpdate,
    MatchmakerCreate,
    MatchmakerPatch,
    NotificationRead,
    SettingPatch,
    UserPatch,
)
from app.services.audit import audit
from app.services.auth import AuthService
from app.services.domain import DomainService


async def require_super_admin(user: User = Depends(current_user)) -> User:
    if user.role != Role.SUPER_ADMIN:
        raise ForbiddenError()
    return user


router = APIRouter(
    prefix="/admin", tags=["Super admin"], dependencies=[Depends(require_super_admin)]
)

SETTING_TYPES = {
    "minimum_match_score": (int, float),
    "maximum_candidates": int,
    "contact_opening_fee": (int, float),
    "success_fee": (int, float),
    "allow_multiple_serious_matches": bool,
    "male_registration_enabled": bool,
    "female_leads_enabled": bool,
    "support_phone": str,
    "support_whatsapp": str,
    "default_matchmaker_assignment": (str, type(None)),
    "maintenance_mode": bool,
}


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(require_permission("*")), db: AsyncSession = Depends(get_db)
):
    async def count(model, *filters):
        return int(await db.scalar(select(func.count(model.id)).where(*filters)) or 0)

    revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "PAID")
    )
    return ok(
        {
            "male_users": await count(User, User.role == Role.MALE_USER),
            "female_profiles": await count(FemaleProfile),
            "matchmakers": await count(Matchmaker),
            "active_requests": await count(MaleRequest, MaleRequest.is_active.is_(True)),
            "match_candidates": await count(MatchCandidate),
            "match_cases": await count(MatchCase),
            "engagements": await count(MatchCase, MatchCase.status == "ENGAGED"),
            "marriages": await count(MatchCase, MatchCase.status == "MARRIED"),
            "revenue": float(revenue),
        }
    )


@router.get("/users")
async def users(
    role: Role | None = None,
    status: UserStatus | None = None,
    governorate: str | None = None,
    verification: VerificationStatus | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    user: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = max(page, 1), min(max(page_size, 1), 100)
    joins = (
        select(User.id)
        .outerjoin(MaleRequest, MaleRequest.male_user_id == User.id)
        .outerjoin(Matchmaker, Matchmaker.user_id == User.id)
    )
    filters = []
    if role:
        filters.append(User.role == role)
    if status:
        filters.append(User.status == status)
    if governorate:
        filters.append(User.governorate == governorate)
    if verification:
        filters.append(
            or_(
                MaleRequest.verification_status == verification,
                Matchmaker.verification_status == verification,
            )
        )
    if search:
        pattern = f"%{search.strip()}%"
        search_filters = [
            User.first_name.ilike(pattern),
            User.phone.ilike(pattern),
            User.email.ilike(pattern),
        ]
        try:
            request = await AuthService(db).resolve_male_request_code(
                search.strip(), record_attempt=False
            )
            search_filters.append(User.id == request.male_user_id)
        except AppError as exc:
            if exc.code != "INVALID_REQUEST_CODE":
                raise
        filters.append(or_(*search_filters))
    total_stmt = (
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .outerjoin(MaleRequest, MaleRequest.male_user_id == User.id)
        .outerjoin(Matchmaker, Matchmaker.user_id == User.id)
        .where(*filters)
    )
    total = int(await db.scalar(total_stmt) or 0)
    sortable = {
        "created_at": User.created_at,
        "first_name": User.first_name,
        "phone": User.phone,
        "role": User.role,
        "status": User.status,
    }
    order = sortable.get(sort_by, User.created_at)
    order = order.asc() if sort_order.casefold() == "asc" else order.desc()
    rows = list(
        await db.scalars(
            select(User)
            .where(User.id.in_(joins.where(*filters).distinct()))
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    )
    return ok(
        {
            "items": serialize(rows, exclude={"password_hash"}),
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    user: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(User, user_id)
    if not row:
        raise NotFoundError("USER_NOT_FOUND", "المستخدم غير موجود.")
    return ok(serialize(row, exclude={"password_hash"}))


@router.patch("/users/{user_id}")
async def patch_user(
    user_id: str,
    payload: UserPatch,
    request: Request,
    user: User = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(User, user_id)
    if not row:
        raise NotFoundError("USER_NOT_FOUND", "المستخدم غير موجود.")
    old = {"status": row.status.value, "permissions": row.permissions}
    if payload.status:
        try:
            row.status = UserStatus(payload.status)
        except ValueError as exc:
            raise AppError("INVALID_USER_STATUS", "حالة المستخدم غير صالحة.") from exc
    if payload.permissions is not None:
        row.permissions = payload.permissions
    for field in ("first_name", "phone", "email", "governorate"):
        if field in payload.model_fields_set:
            setattr(row, field, getattr(payload, field))
    await audit(
        db,
        actor_id=user.id,
        action="user.updated",
        entity_type="user",
        entity_id=row.id,
        old_values=old,
        new_values=payload.model_dump(exclude_none=True),
        request=request,
    )
    await db.commit()
    return ok(serialize(row, exclude={"password_hash"}))


@router.get("/matchmakers")
async def matchmakers(
    user: User = Depends(require_permission("matchmakers.view")), db: AsyncSession = Depends(get_db)
):
    rows = list(
        (
            await db.execute(
                select(Matchmaker, User)
                .join(User, Matchmaker.user_id == User.id)
                .order_by(Matchmaker.created_at.desc())
            )
        ).all()
    )
    return ok(
        [
            {
                **serialize(matchmaker),
                "first_name": account.first_name,
                "phone": account.phone,
                "email": account.email,
                "status": account.status.value,
            }
            for matchmaker, account in rows
        ]
    )


@router.post("/matchmakers", status_code=201)
async def create_matchmaker(
    payload: MatchmakerCreate,
    request: Request,
    user: User = Depends(require_permission("matchmakers.manage")),
    db: AsyncSession = Depends(get_db),
):
    if await db.scalar(select(User.id).where(User.phone == payload.phone)):
        raise AppError("PHONE_EXISTS", "رقم الهاتف مستخدم مسبقًا.", 409)
    account = User(
        first_name=payload.first_name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=Role.MATCHMAKER,
        permissions=payload.permissions,
    )
    db.add(account)
    await db.flush()
    mm = Matchmaker(user_id=account.id, governorates=payload.governorates)
    db.add(mm)
    await db.flush()
    await audit(
        db,
        actor_id=user.id,
        action="matchmaker.created",
        entity_type="matchmaker",
        entity_id=mm.id,
        new_values={"user_id": account.id, "governorates": mm.governorates},
        request=request,
    )
    await db.commit()
    return ok(
        {"account": serialize(account, exclude={"password_hash"}), "matchmaker": serialize(mm)}
    )


@router.patch("/matchmakers/{matchmaker_id}")
async def patch_matchmaker(
    matchmaker_id: str,
    payload: MatchmakerPatch,
    user: User = Depends(require_permission("matchmakers.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Matchmaker, matchmaker_id)
    if not row:
        raise NotFoundError()
    account = await db.get(User, row.user_id)
    old = {
        "verification_status": row.verification_status.value,
        "governorates": row.governorates,
        "status": account.status.value if account else None,
    }
    if payload.verification_status:
        row.verification_status = payload.verification_status
    if payload.governorates is not None:
        row.governorates = payload.governorates
    if payload.status is not None and account:
        account.status = payload.status
    if payload.permissions is not None and account:
        account.permissions = payload.permissions
    await audit(
        db,
        actor_id=user.id,
        action="matchmaker.updated",
        entity_type="matchmaker",
        entity_id=row.id,
        old_values=old,
        new_values={
            "verification_status": row.verification_status.value,
            "governorates": row.governorates,
            "status": account.status.value if account else None,
        },
    )
    await db.commit()
    return ok(serialize(row))


async def list_model(db: AsyncSession, model):
    return ok(
        serialize(
            list(await db.scalars(select(model).order_by(model.created_at.desc()).limit(200)))
        )
    )


@router.get("/female-profiles")
async def all_female_profiles(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, FemaleProfile)


@router.get("/female-leads")
async def all_female_leads(
    user: User = Depends(require_permission("female_profiles.view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, FemaleLead)


@router.get("/male-requests")
async def all_male_requests(
    user: User = Depends(require_permission("male_requests.view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, MaleRequest)


@router.get("/match-cases")
async def all_match_cases(
    status: MatchCaseStatus | None = None,
    user: User = Depends(require_permission("matches.view")),
    db: AsyncSession = Depends(get_db),
):
    statement = select(MatchCase).order_by(MatchCase.created_at.desc())
    if status is not None:
        statement = statement.where(MatchCase.status == status)
    return ok(serialize(list(await db.scalars(statement))))


@router.patch("/match-cases/{case_id}")
async def patch_match_case(
    case_id: str,
    payload: MatchCaseUpdate,
    user: User = Depends(require_permission("matches.manage")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(MatchCase, case_id)
    if not case:
        raise NotFoundError()
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


@router.get("/matches")
async def all_matches(
    user: User = Depends(require_permission("matches.view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, MatchCandidate)


@router.get("/meetings")
async def all_meetings(
    user: User = Depends(require_permission("matches.view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, Meeting)


@router.get("/success-fees")
async def success_fees(
    user: User = Depends(require_permission("payments.view")),
    db: AsyncSession = Depends(get_db),
):
    rows = list(
        await db.scalars(
            select(MatchCase)
            .where(MatchCase.success_fee_status != "NONE")
            .order_by(MatchCase.updated_at.desc())
        )
    )
    amount = await db.scalar(select(SystemSetting.value).where(SystemSetting.key == "success_fee"))
    return ok(
        [
            {
                "id": row.id,
                "match_case_id": row.id,
                "amount": amount or 0,
                "status": row.success_fee_status.value,
                "paid_at": None,
                "engaged_at": serialize(row.engaged_at),
            }
            for row in rows
        ]
    )


@router.get("/notifications")
async def all_notifications(
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, Notification)


@router.patch("/notifications/{notification_id}")
async def read_notification(
    notification_id: str,
    payload: NotificationRead,
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Notification, notification_id)
    if not row:
        raise NotFoundError()
    row.read_at = datetime.now(timezone.utc) if payload.read else None
    await db.commit()
    return ok(serialize(row))


@router.get("/reports")
async def reports(
    user: User = Depends(require_permission("reports.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await list_model(db, Report)


@router.get("/permissions")
async def permissions(user: User = Depends(require_permission("settings.manage"))):
    codes = sorted(
        {
            permission
            for values in ROLE_PERMISSIONS.values()
            for permission in values
            if permission != "*"
        }
    )
    return ok(
        [
            {
                "id": code,
                "code": code,
                "description": code.replace(".", " / "),
                "roles_count": sum(
                    code in permissions or "*" in permissions
                    for permissions in ROLE_PERMISSIONS.values()
                ),
            }
            for code in codes
        ]
    )


@router.get("/payments")
async def all_payments(
    user: User = Depends(require_permission("payments.view")), db: AsyncSession = Depends(get_db)
):
    return await list_model(db, Payment)


@router.get("/audit-logs")
async def audit_logs(
    limit: int = 100,
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    return ok(
        serialize(
            list(
                await db.scalars(
                    select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 500))
                )
            )
        )
    )


@router.get("/settings")
async def settings(
    user: User = Depends(require_permission("settings.manage")), db: AsyncSession = Depends(get_db)
):
    rows = list(await db.scalars(select(SystemSetting)))
    return ok({row.key: row.value for row in rows})


@router.patch("/settings")
async def patch_settings(
    payload: SettingPatch,
    request: Request,
    user: User = Depends(require_permission("settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    unknown = set(payload.values) - set(SETTING_TYPES)
    if unknown:
        raise AppError("UNKNOWN_SETTING", f"إعدادات غير معروفة: {', '.join(sorted(unknown))}")
    for key, value in payload.values.items():
        expected = SETTING_TYPES[key]
        if not isinstance(value, expected) or (
            key
            in {"minimum_match_score", "maximum_candidates", "contact_opening_fee", "success_fee"}
            and isinstance(value, bool)
        ):
            raise AppError("INVALID_SETTING_TYPE", f"قيمة {key} غير صالحة.")
        if key == "minimum_match_score" and not 0 <= float(value) <= 100:
            raise AppError("INVALID_SETTING_VALUE", "درجة المطابقة يجب أن تكون بين 0 و100.")
        if key == "maximum_candidates" and int(value) < 1:
            raise AppError("INVALID_SETTING_VALUE", "عدد المرشحات يجب أن يكون موجبًا.")
        if key in {"contact_opening_fee", "success_fee"} and float(value) < 0:
            raise AppError("INVALID_SETTING_VALUE", "قيمة الأتعاب لا يمكن أن تكون سالبة.")
        if key == "default_matchmaker_assignment" and value is not None:
            if not await db.get(Matchmaker, value):
                raise AppError("MATCHMAKER_NOT_FOUND", "الخطّابة الافتراضية غير موجودة.", 404)
        row = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if row:
            old, row.value = row.value, value
        else:
            old, row = None, SystemSetting(key=key, value=value)
            db.add(row)
            await db.flush()
        await audit(
            db,
            actor_id=user.id,
            action="setting.updated",
            entity_type="system_setting",
            entity_id=row.id,
            old_values={"value": old},
            new_values={"value": value},
            request=request,
        )
    await db.commit()
    return ok(payload.values, "تم تحديث الإعدادات.")
