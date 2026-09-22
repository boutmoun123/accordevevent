"""Weekly rules and on-demand slots; serialize booking and edits per matchmaker."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select, update

from app.core.errors import AppError
from app.models import (
    ContactAppointment,
    Matchmaker,
    MatchmakerAvailability,
    User,
    UserStatus,
    VerificationStatus,
)

LOCAL_ZONE = ZoneInfo("Asia/Damascus")


def now_local():
    return datetime.now(timezone.utc).astimezone(LOCAL_ZONE)


def appointment_json(row):
    from app.api.serializers import serialize

    return {
        **serialize(row),
        "scheduled_at": datetime.combine(
            row.appointment_date, row.start_time, LOCAL_ZONE
        ).isoformat(),
        "ends_at": datetime.combine(row.appointment_date, row.end_time, LOCAL_ZONE).isoformat(),
    }


async def lock_owner(db, owner_id):
    # A real UPDATE obtains a row write lock on PostgreSQL and a writer lock on SQLite.
    # All rule changes, bookings and cancellations take this same lock before reading.
    eligible = (
        select(Matchmaker.id)
        .join(User, User.id == Matchmaker.user_id)
        .where(
            Matchmaker.verification_status == VerificationStatus.VERIFIED,
            User.status == UserStatus.ACTIVE,
        )
    )
    result = await db.execute(
        update(Matchmaker)
        .where(
            Matchmaker.id == owner_id,
            Matchmaker.id.in_(eligible),
        )
        .values(availability_revision=Matchmaker.availability_revision)
    )
    if result.rowcount != 1:
        raise AppError("MATCHMAKER_UNAVAILABLE", "الخطّابة غير متاحة حاليًا.", 409)
    return await db.scalar(
        select(Matchmaker)
        .where(Matchmaker.id == owner_id)
        .execution_options(populate_existing=True)
    )


async def weekly_schedule(db, owner):
    rules = list(
        await db.scalars(
            select(MatchmakerAvailability)
            .where(
                MatchmakerAvailability.matchmaker_id == owner.id,
            )
            .order_by(MatchmakerAvailability.start_time)
        )
    )
    return {
        "slot_duration_minutes": owner.slot_duration_minutes,
        "booking_horizon_days": owner.booking_horizon_days,
        "revision": owner.availability_revision,
        "timezone": "Asia/Damascus",
        "days": [
            {
                "weekday": day,
                "is_active": any(r.is_active for r in rules if r.weekday == day),
                "ranges": [
                    {
                        "start_time": r.start_time.strftime("%H:%M"),
                        "end_time": r.end_time.strftime("%H:%M"),
                    }
                    for r in rules
                    if r.weekday == day
                ],
            }
            for day in range(7)
        ],
    }


async def save_schedule(db, owner_id, payload):
    owner = await lock_owner(db, owner_id)
    if owner.availability_revision != payload.revision:
        raise AppError(
            "SCHEDULE_CONFLICT", "تغيّر الجدول في نافذة أخرى. أعيدي تحميله قبل الحفظ.", 409
        )
    await db.execute(
        delete(MatchmakerAvailability).where(
            MatchmakerAvailability.matchmaker_id == owner_id,
        )
    )
    for day in payload.days:
        for period in day.ranges:
            db.add(
                MatchmakerAvailability(
                    matchmaker_id=owner_id,
                    weekday=day.weekday,
                    is_active=day.is_active,
                    **period.model_dump(),
                )
            )
    owner.slot_duration_minutes = payload.slot_duration_minutes
    owner.booking_horizon_days = payload.booking_horizon_days
    owner.availability_revision += 1
    await db.flush()
    result = await weekly_schedule(db, owner)
    await db.commit()
    return result


async def available_slots(db, owner_id=None):
    stmt = (
        select(Matchmaker)
        .join(User, User.id == Matchmaker.user_id)
        .where(
            Matchmaker.verification_status == VerificationStatus.VERIFIED,
            User.status == UserStatus.ACTIVE,
        )
    )
    if owner_id is not None:
        stmt = stmt.where(Matchmaker.id == owner_id)
    owners = list(await db.scalars(stmt.execution_options(populate_existing=True)))
    if not owners:
        return []
    owner_ids = [o.id for o in owners]
    now = now_local()
    rules = list(
        await db.scalars(
            select(MatchmakerAvailability).where(
                MatchmakerAvailability.matchmaker_id.in_(owner_ids),
                MatchmakerAvailability.is_active.is_(True),
            )
        )
    )
    booked = list(
        await db.scalars(
            select(ContactAppointment).where(
                ContactAppointment.matchmaker_id.in_(owner_ids),
                ContactAppointment.appointment_date >= now.date(),
                ContactAppointment.appointment_date < now.date() + timedelta(days=30),
                ContactAppointment.status != "CANCELLED",
            )
        )
    )
    slots = []
    for owner in owners:
        duration = timedelta(minutes=owner.slot_duration_minutes)
        for offset in range(owner.booking_horizon_days):
            date = now.date() + timedelta(days=offset)
            weekday = (date.weekday() + 1) % 7  # Sunday = 0
            occupied = [
                b for b in booked if b.matchmaker_id == owner.id and b.appointment_date == date
            ]
            for rule in rules:
                if rule.matchmaker_id != owner.id or rule.weekday != weekday:
                    continue
                start = datetime.combine(date, rule.start_time, LOCAL_ZONE)
                end = datetime.combine(date, rule.end_time, LOCAL_ZONE)
                while start + duration <= end:
                    finish = start + duration
                    if start > now and not any(
                        start.time() < b.end_time and finish.time() > b.start_time for b in occupied
                    ):
                        slots.append(
                            {
                                "id": f"{owner.id}:{start.isoformat()}",
                                "matchmaker_id": owner.id,
                                "appointment_date": date.isoformat(),
                                "scheduled_at": start.isoformat(),
                                "ends_at": finish.isoformat(),
                                "status": "AVAILABLE",
                            }
                        )
                    start = finish
    return sorted(slots, key=lambda s: (s["scheduled_at"], s["matchmaker_id"]))


async def reserve_slot(db, owner_id, scheduled_at):
    await lock_owner(db, owner_id)
    # Recompute under the lock: rejects stale selections, past dates, off-grid times,
    # disabled days, horizon changes, and any overlapping existing appointment.
    for slot in await available_slots(db, owner_id):
        if datetime.fromisoformat(slot["scheduled_at"]) == scheduled_at:
            return slot
    raise AppError("SLOT_UNAVAILABLE", "هذا الموعد لم يعد متاحًا، اختاري موعدًا آخر.", 409)


async def change_appointment(db, owner_id, appointment_id, status):
    await lock_owner(db, owner_id)
    result = await db.execute(
        update(ContactAppointment)
        .where(
            ContactAppointment.id == appointment_id,
            ContactAppointment.matchmaker_id == owner_id,
            ContactAppointment.status == "BOOKED",
        )
        .values(status=status)
    )
    if result.rowcount != 1:
        raise AppError("APPOINTMENT_CONFLICT", "تعذر تحديث الحجز. حدّثي القائمة.", 409)
    await db.commit()
    return {"id": appointment_id, "status": status}
