from collections.abc import Callable

from fastapi import Depends

from app.core.errors import ForbiddenError
from app.models import Role, User

ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: {"*"},
    Role.MATCHMAKER: {
        "female_profiles.view",
        "female_profiles.manage",
        "male_requests.view",
        "male_requests.manage",
        "matches.view",
        "matches.manage",
        "payments.view",
        "payments.manage",
        "meetings.manage",
        "notifications.view",
    },
    Role.MALE_USER: {"male_request.own", "matches.count", "chat.use", "notifications.view"},
}


def has_permission(user: User, permission: str) -> bool:
    allowed = ROLE_PERMISSIONS.get(user.role, set()) | set(user.permissions or [])
    return "*" in allowed or permission in allowed


def require_permission(permission: str) -> Callable:
    from app.auth.dependencies import current_user

    async def guard(user: User = Depends(current_user)) -> User:
        if not has_permission(user, permission):
            raise ForbiddenError()
        return user

    return guard
