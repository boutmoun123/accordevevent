import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.middleware import (
    MaintenanceModeMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.database.session import SessionLocal

cfg = get_settings()
logging.basicConfig(level=logging.INFO if cfg.environment != "production" else logging.WARNING)

app = FastAPI(
    title="Farah.event API",
    description="Privacy-first Syrian matchmaking platform API",
    version="1.0.0",
    docs_url="/docs" if cfg.environment != "production" else None,
    redoc_url="/redoc" if cfg.environment != "production" else None,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=cfg.rate_limit_per_minute)
app.add_middleware(MaintenanceModeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Operations"])
@app.get("/api/health", tags=["Operations"])
async def health():
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
        database = "up"
    except Exception:
        database = "down"
    status = 200 if database == "up" else 503
    return JSONResponse(
        status_code=status,
        content={"status": "ok" if status == 200 else "degraded", "database": database},
    )


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    fields = [
        {"field": ".".join(map(str, item["loc"])), "message": item["msg"]} for item in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "البيانات المدخلة غير صالحة.",
                "fields": fields,
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "error": {
                "code": "DATA_CONFLICT",
                "message": "تعارضت البيانات مع سجل موجود. راجع الطلب وأعد المحاولة.",
            },
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logging.exception("Unhandled API error")
    message = str(exc) if cfg.environment == "development" else "حدث خطأ داخلي."
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": message}},
    )
