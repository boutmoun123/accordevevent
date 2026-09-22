from datetime import datetime, timezone

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_token
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Matchmaker, RefreshToken, Role, User, UserStatus, VerificationStatus

bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise AppError("NOT_AUTHENTICATED", "يلزم تسجيل الدخول.", 401)
    payload = decode_token(credentials.credentials, "access")
    if payload.get("family"):
        active_session = await db.scalar(
            select(RefreshToken.id)
            .where(
                RefreshToken.user_id == payload["sub"],
                RefreshToken.family_id == payload["family"],
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .limit(1)
        )
        if not active_session:
            raise AppError("SESSION_REVOKED", "انتهت الجلسة. يرجى تسجيل الدخول.", 401)
    user = await db.get(User, payload["sub"])
    if not user:
        raise AppError("ACCOUNT_UNAVAILABLE", "الحساب غير متاح.", 401)
    if user.status != UserStatus.ACTIVE:
        raise AppError(
            "ACCOUNT_UNAVAILABLE",
            "الحساب غير متاح.",
            403 if user.role == Role.MATCHMAKER else 401,
        )
    if user.role == Role.MATCHMAKER:
        verification = await db.scalar(
            select(Matchmaker.verification_status).where(Matchmaker.user_id == user.id)
        )
        if verification != VerificationStatus.VERIFIED:
            raise AppError(
                "MATCHMAKER_NOT_VERIFIED",
                "حساب الخطّابة بانتظار اعتماد مدير النظام.",
                403,
            )
    return user


async def optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    return await current_user(credentials, db)
