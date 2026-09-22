from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, user_id: str, kind: str, title: str, body: str, data: dict | None = None
    ) -> Notification:
        item = Notification(user_id=user_id, type=kind, title=title, body=body, data=data or {})
        self.db.add(item)
        await self.db.flush()
        return item

    # Channel providers (WhatsApp/SMS/email) can implement this boundary later.
    async def dispatch_external(self, notification: Notification) -> None:
        return None
