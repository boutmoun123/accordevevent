import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.errors import AppError

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    return password_hash.verify(password, encoded)


def create_access_token(user_id: str, family_id: str | None = None) -> str:
    cfg = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=cfg.jwt_access_expire_minutes),
    }
    if family_id:
        payload["family"] = family_id
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def create_refresh_token(user_id: str, family_id: str) -> tuple[str, datetime]:
    cfg = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=cfg.jwt_refresh_expire_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "family": family_id,
        "jti": secrets.token_urlsafe(24),
        "iat": now,
        "exp": expires,
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm), expires


def decode_token(token: str, expected_type: str) -> dict:
    cfg = get_settings()
    try:
        payload = jwt.decode(token, cfg.jwt_secret, algorithms=[cfg.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise AppError("INVALID_TOKEN", "رمز المصادقة غير صالح أو منتهي.", 401) from exc
    if payload.get("type") != expected_type or not payload.get("sub"):
        raise AppError("INVALID_TOKEN", "نوع رمز المصادقة غير صالح.", 401)
    return payload


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
