from fastapi import APIRouter

from app.api.v1 import admin, auth, matchmaker, public

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(public.router)
api_router.include_router(matchmaker.router)
api_router.include_router(admin.router)
