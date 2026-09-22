"""Canonical authentication identifiers and one-way credential digests."""

import hashlib
import hmac
import re

from app.core.config import get_settings

REQUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_REQUEST_CODE_BODY_LENGTH = 16  # 80 bits with the 32-character alphabet.


def normalize_syrian_mobile(raw_phone: str) -> str:
    """Return a normalized phone identifier.

    Formatting whitespace, dashes, and parentheses are ignored. Syrian local
    numbers are converted to E.164, while other valid digit-only phone numbers
    are accepted as entered.
    """

    compact = re.sub(r"[\s()\-]", "", raw_phone.strip())
    if compact.startswith("00963"):
        compact = "+963" + compact[5:]
    elif compact.startswith("09"):
        compact = "+963" + compact[1:]
    elif compact.startswith("00"):
        compact = "+" + compact[2:]
    if not re.fullmatch(r"\+?[0-9]{8,15}", compact):
        raise ValueError("أدخل رقم هاتف صالحًا.")
    return compact


def canonicalize_request_code(raw_code: str) -> str:
    """Normalize case, whitespace and separators without accepting lookalikes."""

    compact = re.sub(r"[\s\-]", "", raw_code.strip().upper())
    if not re.fullmatch(r"FRH[A-Z0-9]{8,20}", compact):
        raise ValueError("رقم الطلب غير صالح.")
    body = compact[3:]
    return "FRH-" + "-".join(body[index : index + 4] for index in range(0, len(body), 4))


def credential_digest(namespace: str, value: str) -> str:
    """Create a server-peppered digest suitable for indexed credential lookup."""

    secret = get_settings().auth_pepper.encode("utf-8")
    return hmac.new(secret, f"{namespace}:{value}".encode("utf-8"), hashlib.sha256).hexdigest()


def request_code_digest(raw_code: str) -> str:
    return credential_digest("request-code", canonicalize_request_code(raw_code))


def request_code_for_id(request_id: str) -> str:
    """Derive a redisplayable high-entropy code without storing its plaintext."""

    secret = get_settings().auth_pepper.encode("utf-8")
    entropy = hmac.new(secret, f"request-id:{request_id}".encode(), hashlib.sha256).digest()[:10]
    number = int.from_bytes(entropy, "big")
    chars = []
    for _ in range(_REQUEST_CODE_BODY_LENGTH):
        number, offset = divmod(number, len(REQUEST_CODE_ALPHABET))
        chars.append(REQUEST_CODE_ALPHABET[offset])
    body = "".join(reversed(chars))
    return "FRH-" + "-".join(body[index : index + 4] for index in range(0, len(body), 4))

