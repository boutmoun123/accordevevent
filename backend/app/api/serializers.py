from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import inspect


def serialize(value: Any, *, exclude: set[str] | None = None) -> Any:
    exclude = exclude or set()
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {k: serialize(v, exclude=exclude) for k, v in value.items() if k not in exclude}
    if isinstance(value, (list, tuple)):
        return [serialize(item, exclude=exclude) for item in value]
    mapper = inspect(value.__class__)
    result = {
        column.key: serialize(getattr(value, column.key), exclude=exclude)
        for column in mapper.columns
        if column.key not in exclude
    }
    # Request codes are derived from the request UUID and a server secret. This keeps
    # the access secret redisplayable without ever persisting or serializing plaintext.
    if value.__class__.__name__ == "MaleRequest" and "request_code" not in exclude:
        result["request_code"] = value.request_code
    return result
