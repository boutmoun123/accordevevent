import time
from collections import defaultdict, deque

from fastapi import Request
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.models import SystemSetting


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.limit = requests_per_minute
        self.windows: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in {"/health", "/api/health"}:
            return await call_next(request)
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = self.windows[key]
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= self.limit:
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {"code": "RATE_LIMITED", "message": "عدد الطلبات كبير. حاول لاحقًا."},
                },
            )
        window.append(now)
        return await call_next(request)


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    """Apply the database-controlled maintenance switch without blocking recovery/admin APIs."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            path in {"/health", "/api/health"}
            or path.startswith("/api/v1/admin")
            or path.startswith("/api/v1/auth")
        ):
            return await call_next(request)

        # Import lazily so the middleware does not create an engine import cycle.
        from app.database.session import SessionLocal

        try:
            async with SessionLocal() as db:
                enabled = await db.scalar(
                    select(SystemSetting.value).where(SystemSetting.key == "maintenance_mode")
                )
        except Exception:
            # Database availability is reported by /health. Do not mask the underlying API error.
            enabled = False
        if enabled is True:
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "error": {
                        "code": "MAINTENANCE_MODE",
                        "message": "المنصة تحت الصيانة حاليًا. يرجى المحاولة لاحقًا.",
                    },
                },
            )
        return await call_next(request)
