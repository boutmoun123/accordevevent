"""Vendor-neutral OTP delivery abstraction."""

import secrets
from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.core.errors import AppError


class OtpProvider(ABC):
    """Delivery contract implemented by mock and future SMS adapters."""

    def generate_code(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def client_hint(self, code: str) -> str | None:
        return None

    @abstractmethod
    async def send_code(self, phone: str, code: str) -> None:
        """Deliver ``code`` to ``phone`` or raise an availability error."""


class MockOtpProvider(OtpProvider):
    """Deterministic local provider; never selected in production."""

    def __init__(self, code: str | None = None):
        self.code = code or get_settings().otp_mock_code
        self.deliveries: list[tuple[str, str]] = []

    def generate_code(self) -> str:
        return self.code

    def client_hint(self, code: str) -> str | None:
        return code

    async def send_code(self, phone: str, code: str) -> None:
        self.deliveries.append((phone, code))


class ProductionOtpProvider(OtpProvider):
    """Integration seam for a production SMS provider.

    Deployments should subclass or dependency-inject this adapter. Keeping the
    default closed avoids silently authenticating users when SMS is unconfigured.
    """

    async def send_code(self, phone: str, code: str) -> None:
        raise AppError(
            "OTP_PROVIDER_UNAVAILABLE",
            "خدمة إرسال رمز التحقق غير مهيأة حاليًا.",
            503,
        )


def get_otp_provider() -> OtpProvider:
    settings = get_settings()
    if settings.otp_provider == "mock":
        return MockOtpProvider()
    return ProductionOtpProvider()
