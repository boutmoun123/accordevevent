from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import serialize
from app.auth.dependencies import current_user, optional_user
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.database.session import get_db
from app.models import Conversation, FemaleProfile, FemaleProfileStatus, Message, Role, User
from app.permissions.rbac import require_permission
from app.rag.service import ConversationAIService
from app.schemas.auth import UserPublic
from app.schemas.common import ok
from app.schemas.domain import ChatMessageIn, FemaleLeadIn, MaleRequestIn, MaleRequestUpdate
from app.services.domain import DomainService

router = APIRouter(tags=["Public and male flow"])


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return ok(UserPublic.model_validate(user).model_dump(mode="json"))


@router.post("/female-leads", status_code=201)
async def create_female_lead(payload: FemaleLeadIn, db: AsyncSession = Depends(get_db)):
    lead = await DomainService(db).create_lead(payload)
    return ok({"id": lead.id, "status": lead.status.value}, "تم استلام طلب التواصل.")


@router.post("/chat/message")
async def chat(
    payload: ChatMessageIn,
    user: User | None = Depends(optional_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.gender == "MALE" and user is None:
        raise AppError("NOT_AUTHENTICATED", "يلزم تسجيل الدخول لبدء مسار الشاب.", 401)
    if payload.gender == "MALE" and user.role != Role.MALE_USER:
        raise ForbiddenError("مسار المحادثة هذا مخصص لحسابات الشباب.")
    domain = DomainService(db)
    active_request = (
        await domain.get_active_request(user.id) if user and payload.gender == "MALE" else None
    )
    conversation = await db.scalar(
        select(Conversation).where(Conversation.session_key == payload.session_key)
    )
    if not conversation:
        conversation = Conversation(
            session_key=payload.session_key,
            gender=payload.gender,
            user_id=user.id if user else None,
            structured_state={},
        )
        db.add(conversation)
        await db.flush()
    elif (
        conversation.user_id != (user.id if user else None) or conversation.gender != payload.gender
    ):
        raise ForbiddenError("لا يمكنك الوصول إلى جلسة محادثة أخرى.")
    db.add(Message(conversation_id=conversation.id, role="user", content=payload.message))
    assistant = ConversationAIService()
    state, reply = await assistant.process(
        payload.message, conversation.structured_state or {}, payload.gender
    )
    conversation.structured_state = state
    completed = assistant.is_complete(state)
    conversation.completed = completed
    db.add(Message(conversation_id=conversation.id, role="assistant", content=reply))
    created_request = None
    if user and payload.gender == "MALE" and completed:
        request_payload = MaleRequestIn.model_validate(
            {
                "male_characteristics": state.get("male") or {},
                "desired_female_characteristics": state.get("desired_female") or {},
            }
        )
        created_request, _ = await domain.create_or_get_request(user, request_payload)
    await db.commit()
    data = {
        "session_key": conversation.session_key,
        "session_id": conversation.session_key,
        "reply": reply,
        "message": reply,
        "structured_state": state,
        "completed": completed,
        "quick_replies": assistant.quick_replies(state),
    }
    request = created_request or active_request
    if request:
        data["request_code"] = request.request_code
        data["active_request"] = serialize(request)
    return ok(data)


@router.get("/chat/session")
async def chat_session(
    session_key: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    conversation = await db.scalar(
        select(Conversation).where(Conversation.session_key == session_key)
    )
    if not conversation:
        raise NotFoundError("SESSION_NOT_FOUND", "جلسة المحادثة غير موجودة.")
    if conversation.user_id != user.id:
        raise ForbiddenError("لا يمكنك الوصول إلى جلسة محادثة أخرى.")
    messages = list(
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at)
        )
    )
    return ok(
        {
            "session_key": session_key,
            "gender": conversation.gender,
            "state": conversation.structured_state,
            "messages": serialize(messages),
        }
    )


@router.get("/chat/session/current")
async def current_chat_session(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    conversation = await db.scalar(
        select(Conversation)
        .where(Conversation.user_id == user.id, Conversation.gender == "MALE")
        .order_by(Conversation.updated_at.desc())
    )
    if not conversation:
        raise NotFoundError("SESSION_NOT_FOUND", "جلسة المحادثة غير موجودة.")
    messages = list(
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at)
        )
    )
    return ok(
        {
            "session_key": conversation.session_key,
            "gender": conversation.gender,
            "state": conversation.structured_state,
            "completed": conversation.completed,
            "messages": serialize(messages),
        }
    )


@router.get("/male/request")
async def get_male_request(
    user: User = Depends(require_permission("male_request.own")),
    db: AsyncSession = Depends(get_db),
):
    request = await DomainService(db).get_active_request(user.id)
    if not request:
        raise NotFoundError("REQUEST_NOT_FOUND", "الطلب غير موجود.")
    return ok(serialize(request))


@router.post("/male/request", status_code=201)
async def create_male_request(
    payload: MaleRequestIn,
    user: User = Depends(require_permission("male_request.own")),
    db: AsyncSession = Depends(get_db),
):
    request, created = await DomainService(db).create_or_get_request(user, payload)
    return ok(serialize(request), "تم حفظ طلبك بنجاح." if created else "لديك طلب فعال حاليًا.")


@router.patch("/male/request")
async def update_male_request(
    payload: MaleRequestUpdate,
    user: User = Depends(require_permission("male_request.own")),
    db: AsyncSession = Depends(get_db),
):
    return ok(serialize(await DomainService(db).update_request(user, payload)))


@router.post("/matching/run")
async def run_matching(
    user: User = Depends(require_permission("matches.count")),
    db: AsyncSession = Depends(get_db),
):
    request = await DomainService(db).get_active_request(user.id)
    if not request:
        raise NotFoundError("REQUEST_NOT_FOUND", "الطلب غير موجود.")
    return ok(await DomainService(db).run_matching(request))


@router.get("/matching/count")
async def matching_count(
    user: User = Depends(require_permission("matches.count")),
    db: AsyncSession = Depends(get_db),
):
    request = await DomainService(db).get_active_request(user.id)
    if not request:
        raise NotFoundError("REQUEST_NOT_FOUND", "الطلب غير موجود.")
    from app.models import MatchCandidate

    candidates = list(
        await db.scalars(
            select(MatchCandidate.mutual_score)
            .join(FemaleProfile, FemaleProfile.id == MatchCandidate.female_profile_id)
            .where(
                MatchCandidate.male_request_id == request.id,
                MatchCandidate.status == "AVAILABLE",
                FemaleProfile.status == FemaleProfileStatus.ACTIVE,
            )
        )
    )
    from app.services.matching import public_match_summary

    return ok(public_match_summary(candidates))


@router.get("/contact-availability")
async def contact_availability(
    matchmaker_id: str | None = None, db: AsyncSession = Depends(get_db)
):
    from app.services.availability import available_slots

    return ok(await available_slots(db, matchmaker_id))
