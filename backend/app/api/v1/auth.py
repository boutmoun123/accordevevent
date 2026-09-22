from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user
from app.database.session import get_db
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    MalePhoneStartRequest,
    MalePhoneVerifyRequest,
    MaleRequestCodeLoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserPublic,
)
from app.schemas.common import ok
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await AuthService(db).register(payload)
    tokens = await AuthService(db).issue_pair(user)
    return ok(
        {
            "user": UserPublic.model_validate(user).model_dump(mode="json"),
            "tokens": tokens,
            **tokens,
        }
    )


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user = await service.authenticate(payload.phone, payload.password)
    tokens = await service.issue_pair(user)
    return ok(
        {
            "user": UserPublic.model_validate(user).model_dump(mode="json"),
            "tokens": tokens,
            **tokens,
        }
    )


@router.post("/male/phone/start")
async def male_phone_start(
    payload: MalePhoneStartRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    service = AuthService(db)
    result = await service.start_male_phone_login(payload.phone, client_ip)
    user = result.pop("user")
    tokens = await service.issue_pair(user)
    return ok(
        {
            **result,
            "user": UserPublic.model_validate(user).model_dump(mode="json"),
            "tokens": tokens,
            **tokens,
        }
    )


@router.post("/male/phone/verify")
async def male_phone_verify(
    payload: MalePhoneVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    user = await service.verify_male_phone_login(
        payload.challenge_id, payload.otp, request.client.host if request.client else None
    )
    tokens = await service.issue_pair(user)
    return ok(
        {
            "user": UserPublic.model_validate(user).model_dump(mode="json"),
            "tokens": tokens,
            **tokens,
        }
    )


@router.post("/male/request-code")
async def male_request_code_login(
    payload: MaleRequestCodeLoginRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    user = await service.authenticate_request_code(
        payload.request_code, request.client.host if request.client else None
    )
    tokens = await service.issue_pair(user)
    return ok(
        {
            "user": UserPublic.model_validate(user).model_dump(mode="json"),
            "tokens": tokens,
            **tokens,
        }
    )


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return ok(await AuthService(db).rotate(payload.refresh_token))


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await AuthService(db).logout(payload.refresh_token)
    return ok(message="تم تسجيل الخروج.")


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return ok(UserPublic.model_validate(user).model_dump(mode="json"))
