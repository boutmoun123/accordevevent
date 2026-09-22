from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.identifiers import (
    canonicalize_request_code,
    credential_digest,
    normalize_syrian_mobile,
)
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_digest,
    verify_password,
)
from app.core.config import get_settings
from app.core.errors import AppError
from app.models import (
    AuthAttempt,
    MaleRequest,
    MaleRequestAccessCode,
    OtpChallenge,
    RefreshToken,
    Role,
    SystemSetting,
    User,
    UserStatus,
)
from app.schemas.auth import RegisterRequest


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        registration_enabled = await self.db.scalar(
            select(SystemSetting.value).where(SystemSetting.key == "male_registration_enabled")
        )
        if registration_enabled is False:
            raise AppError("REGISTRATION_DISABLED", "تسجيل طلبات الشباب متوقف مؤقتًا.", 503)
        exists = await self.db.scalar(select(User.id).where(User.phone == data.phone))
        if exists:
            raise AppError("PHONE_EXISTS", "رقم الهاتف مستخدم مسبقًا.", 409)
        user = User(
            first_name=data.first_name,
            phone=data.phone,
            password_hash=hash_password(data.password),
            governorate=data.governorate,
            date_of_birth=data.date_of_birth,
            role=Role.MALE_USER,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, phone: str, password: str) -> User:
        identifier = phone.strip()
        user = await self.db.scalar(
            select(User).where(
                or_(
                    User.phone == identifier,
                    func.lower(User.email) == identifier.casefold(),
                )
            )
        )
        if (
            not user
            or user.role == Role.MALE_USER
            or not user.password_hash
            or not verify_password(password, user.password_hash)
        ):
            raise AppError("INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة.", 401)
        if user.status != UserStatus.ACTIVE:
            raise AppError("ACCOUNT_UNAVAILABLE", "الحساب غير متاح.", 401)
        return user

    async def _record_auth_attempt(
        self, method: str, subject: str, ip: str | None, successful: bool
    ) -> None:
        self.db.add(
            AuthAttempt(
                method=method,
                subject_digest=credential_digest(f"{method}:subject", subject),
                ip_digest=credential_digest(f"{method}:ip", ip or "unknown"),
                successful=successful,
            )
        )
        await self.db.flush()

    async def _rate_limit(self, method: str, subject: str, ip: str | None, limit: int, window: int):
        since = datetime.now(timezone.utc) - timedelta(seconds=window)
        subject_hash = credential_digest(f"{method}:subject", subject)
        ip_hash = credential_digest(f"{method}:ip", ip or "unknown")
        failures = int(
            await self.db.scalar(
                select(func.count(AuthAttempt.id)).where(
                    AuthAttempt.method == method,
                    AuthAttempt.created_at >= since,
                    AuthAttempt.successful.is_(False),
                    or_(
                        AuthAttempt.subject_digest == subject_hash,
                        AuthAttempt.ip_digest == ip_hash,
                    ),
                )
            )
            or 0
        )
        if failures >= limit:
            raise AppError("RATE_LIMITED", "تم تجاوز عدد المحاولات. حاول لاحقًا.", 429)

    async def start_male_phone_login(self, phone: str, ip: str | None = None) -> dict:
        settings = get_settings()
        try:
            normalized = normalize_syrian_mobile(phone)
        except ValueError as exc:
            raise AppError("INVALID_PHONE", str(exc), 400) from exc
        await self._rate_limit(
            "otp-start",
            normalized,
            ip,
            settings.otp_start_limit,
            settings.otp_start_window_seconds,
        )
        user = await self.db.scalar(
            select(User).where(User.phone == normalized, User.role == Role.MALE_USER)
        )
        if not user:
            user = User(phone=normalized, role=Role.MALE_USER, status=UserStatus.ACTIVE)
            self.db.add(user)
            await self.db.flush()
        if user.status != UserStatus.ACTIVE:
            raise AppError("ACCOUNT_UNAVAILABLE", "ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…طھط§ط­.", 401)
        await self._record_auth_attempt("otp-start", normalized, ip, True)
        await self.db.commit()
        await self.db.refresh(user)
        return {
            "otp_required": False,
            "phone": normalized,
            "user": user,
        }

    async def verify_male_phone_login(
        self, challenge_id: str, otp: str, ip: str | None = None
    ) -> User:
        challenge = await self.db.get(OtpChallenge, challenge_id)
        subject = challenge.phone if challenge else challenge_id
        if not challenge:
            await self._record_auth_attempt("otp-verify", subject, ip, False)
            await self.db.commit()
            raise AppError("INVALID_OTP", "رمز التحقق غير صحيح.", 401)
        now = datetime.now(timezone.utc)
        expires_at = challenge.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if (
            challenge.consumed_at is not None
            or expires_at <= now
            or challenge.attempts >= challenge.max_attempts
        ):
            await self._record_auth_attempt("otp-verify", subject, ip, False)
            await self.db.commit()
            raise AppError("INVALID_OTP", "رمز التحقق غير صحيح.", 401)
        if challenge.code_digest != credential_digest("otp", f"{challenge.phone}:{otp}"):
            challenge.attempts += 1
            await self._record_auth_attempt("otp-verify", subject, ip, False)
            await self.db.commit()
            raise AppError("INVALID_OTP", "رمز التحقق غير صحيح.", 401)
        user = await self.db.scalar(
            select(User).where(User.phone == challenge.phone, User.role == Role.MALE_USER)
        )
        if not user:
            user = User(phone=challenge.phone, role=Role.MALE_USER, status=UserStatus.ACTIVE)
            self.db.add(user)
            await self.db.flush()
        if user.status != UserStatus.ACTIVE:
            raise AppError("ACCOUNT_UNAVAILABLE", "الحساب غير متاح.", 401)
        challenge.consumed_at = now
        await self._record_auth_attempt("otp-verify", subject, ip, True)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def resolve_male_request_code(
        self, raw_code: str, ip: str | None = None, record_attempt: bool = True
    ) -> MaleRequest:
        settings = get_settings()
        try:
            canonical = canonicalize_request_code(raw_code)
        except ValueError:
            canonical = raw_code.strip().upper()
        await self._rate_limit(
            "request-code",
            canonical,
            ip,
            settings.request_code_attempt_limit,
            settings.request_code_window_seconds,
        )
        request = await self.db.scalar(
            select(MaleRequest)
            .join(MaleRequestAccessCode, MaleRequestAccessCode.male_request_id == MaleRequest.id)
            .where(
                MaleRequestAccessCode.code_digest
                == credential_digest("request-code", canonical)
            )
        )
        if not request:
            if record_attempt:
                await self._record_auth_attempt("request-code", canonical, ip, False)
                await self.db.commit()
            raise AppError("INVALID_REQUEST_CODE", "رقم الطلب غير صحيح.", 401)
        if record_attempt:
            await self._record_auth_attempt("request-code", canonical, ip, True)
            await self.db.commit()
        return request

    async def authenticate_request_code(self, raw_code: str, ip: str | None = None) -> User:
        request = await self.resolve_male_request_code(raw_code, ip)
        user = await self.db.get(User, request.male_user_id)
        if not user or user.role != Role.MALE_USER or user.status != UserStatus.ACTIVE:
            raise AppError("INVALID_REQUEST_CODE", "رقم الطلب غير صحيح.", 401)
        return user

    async def issue_pair(self, user: User, family_id: str | None = None) -> dict:
        family_id = family_id or str(uuid4())
        refresh, expires = create_refresh_token(user.id, family_id)
        row = RefreshToken(
            user_id=user.id,
            token_hash=token_digest(refresh),
            family_id=family_id,
            expires_at=expires,
        )
        self.db.add(row)
        await self.db.commit()
        return {
            "access_token": create_access_token(user.id, family_id),
            "refresh_token": refresh,
            "token_type": "bearer",
        }

    async def rotate(self, raw_token: str) -> dict:
        payload = decode_token(raw_token, "refresh")
        digest = token_digest(raw_token)
        row = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == digest).with_for_update()
        )
        now = datetime.now(timezone.utc)
        if not row:
            raise AppError("INVALID_REFRESH_TOKEN", "رمز التجديد غير معروف.", 401)
        if payload.get("sub") != row.user_id or payload.get("family") != row.family_id:
            raise AppError("INVALID_REFRESH_TOKEN", "رمز التجديد غير متطابق.", 401)
        expiry = (
            row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
        )
        if row.revoked_at or expiry <= now:
            # Reuse of a rotated token revokes the full family.
            await self.db.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == row.family_id)
                .values(revoked_at=now)
            )
            await self.db.commit()
            raise AppError("REFRESH_TOKEN_REUSED", "تم إبطال جلسة التجديد لأسباب أمنية.", 401)
        user = await self.db.get(User, payload["sub"])
        if not user or user.status != UserStatus.ACTIVE:
            raise AppError("INVALID_REFRESH_TOKEN", "المستخدم غير موجود.", 401)
        next_refresh, expires = create_refresh_token(user.id, row.family_id)
        replacement = RefreshToken(
            user_id=user.id,
            token_hash=token_digest(next_refresh),
            family_id=row.family_id,
            expires_at=expires,
        )
        self.db.add(replacement)
        await self.db.flush()
        row.revoked_at = now
        row.replaced_by_id = replacement.id
        await self.db.commit()
        return {
            "access_token": create_access_token(user.id, row.family_id),
            "refresh_token": next_refresh,
            "token_type": "bearer",
        }

    async def logout(self, raw_token: str) -> None:
        row = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_digest(raw_token))
        )
        if row:
            await self.db.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == row.family_id)
                .values(revoked_at=datetime.now(timezone.utc))
            )
            await self.db.commit()
