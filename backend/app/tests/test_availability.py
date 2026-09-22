import asyncio
from datetime import datetime, time, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.errors import AppError
from app.database.base import Base
from app.models import ContactAppointment, FemaleLead, Matchmaker, MatchmakerAvailability
from app.schemas.domain import FemaleLeadIn, WeeklyAvailabilityIn
from app.services import availability as service
from app.services.domain import DomainService
from app.tests.test_api_flows import actor

NOW = datetime(2026, 9, 12, 12, tzinfo=service.LOCAL_ZONE)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(service, "now_local", lambda: NOW)


def schedule(duration=30, horizon=14, revision=0):
    periods = {0: [("17:00", "19:00"), ("21:00", "22:00")], 1: [("17:00", "19:00")]}
    return {
        "slot_duration_minutes": duration,
        "booking_horizon_days": horizon,
        "revision": revision,
        "days": [
            {
                "weekday": d,
                "is_active": d in periods,
                "ranges": [{"start_time": a, "end_time": b} for a, b in periods.get(d, [])],
            }
            for d in range(7)
        ],
    }


def payload(slot):
    return {
        "phone": "+963966112233",
        "governorate": "دمشق",
        "consent": True,
        "matchmaker_id": slot["matchmaker_id"],
        "scheduled_at": slot["scheduled_at"],
        "notes": "ملاحظة",
    }


async def configure(client, db, body=None):
    headers = await actor(db)
    response = await client.patch(
        "/api/v1/matchmaker/availability", headers=headers, json=body or schedule()
    )
    assert response.status_code == 200, response.text
    slots = (await client.get("/api/v1/contact-availability")).json()["data"]
    return headers, slots


async def test_weekly_end_to_end(client, db):
    headers, slots = await configure(client, db)
    sunday = [s for s in slots if s["appointment_date"] == "2026-09-13"]
    assert [datetime.fromisoformat(s["scheduled_at"]).strftime("%H:%M") for s in sunday] == [
        "17:00",
        "17:30",
        "18:00",
        "18:30",
        "21:00",
        "21:30",
    ]
    assert len(slots) == 20  # two Sundays and two Mondays
    assert all(
        s["status"] == "AVAILABLE" and datetime.fromisoformat(s["scheduled_at"]) > NOW
        for s in slots
    )
    assert await db.scalar(select(func.count(ContactAppointment.id))) == 0
    assert await db.scalar(select(func.count(MatchmakerAvailability.id))) == 3
    response = await client.post("/api/v1/female-leads", json=payload(sunday[1]))
    assert response.status_code == 201, response.text
    assert (await client.post("/api/v1/female-leads", json=payload(sunday[1]))).status_code == 409
    remaining = (await client.get("/api/v1/contact-availability")).json()["data"]
    assert len(remaining) == 19
    assert sunday[1]["id"] not in {s["id"] for s in remaining}
    assert {s["id"] for s in sunday if s != sunday[1]} <= {s["id"] for s in remaining}
    appointments = (await client.get("/api/v1/matchmaker/appointments", headers=headers)).json()[
        "data"
    ]
    assert len(appointments) == 1
    assert appointments[0]["start_time"] == "17:30:00"
    assert appointments[0]["end_time"] == "18:00:00"
    assert appointments[0]["phone"] == payload(sunday[1])["phone"]
    assert appointments[0]["notes"] == "ملاحظة"
    leads = (await client.get("/api/v1/matchmaker/female-leads", headers=headers)).json()["data"]
    assert leads[0]["appointment_id"] == appointments[0]["id"]
    assert leads[0]["scheduled_at"] == sunday[1]["scheduled_at"]


@pytest.mark.parametrize("duration,count", [(15, 12), (30, 6), (45, 3), (60, 3)])
async def test_durations_exclude_partial_tail(client, db, duration, count):
    _, slots = await configure(client, db, schedule(duration))
    sunday = [s for s in slots if s["appointment_date"] == "2026-09-13"]
    assert len(sunday) == count
    for slot in sunday:
        assert datetime.fromisoformat(slot["ends_at"]) - datetime.fromisoformat(
            slot["scheduled_at"]
        ) == timedelta(minutes=duration)
        assert datetime.fromisoformat(slot["scheduled_at"]).hour not in (19, 22)


@pytest.mark.parametrize("horizon,count", [(7, 10), (14, 20), (30, 46)])
async def test_horizon(client, db, horizon, count):
    _, slots = await configure(client, db, schedule(horizon=horizon))
    assert len(slots) == count
    assert all(
        datetime.fromisoformat(s["scheduled_at"]).date() < NOW.date() + timedelta(days=horizon)
        for s in slots
    )


@pytest.mark.parametrize(
    "ranges",
    [
        [("19:00", "17:00")],
        [("17:00", "17:00")],
        [("17:00", "19:00"), ("18:00", "20:00")],
        [("17:00", "19:00"), ("17:00", "19:00")],
    ],
)
async def test_invalid_ranges(client, db, ranges):
    headers = await actor(db)
    body = schedule()
    body["days"][0]["ranges"] = [{"start_time": a, "end_time": b} for a, b in ranges]
    assert (
        await client.patch("/api/v1/matchmaker/availability", headers=headers, json=body)
    ).status_code == 422
    assert await db.scalar(select(func.count(MatchmakerAvailability.id))) == 0


async def test_disabled_day_stale_revision_and_ownership(client, db):
    headers, slots = await configure(client, db)
    other = await actor(db)
    assert (await client.get("/api/v1/matchmaker/availability", headers=other)).json()["data"][
        "days"
    ][0]["is_active"] is False
    body = schedule(revision=1)
    body["days"][0]["is_active"] = False
    assert (
        await client.patch("/api/v1/matchmaker/availability", headers=headers, json=body)
    ).status_code == 200
    assert (await client.post("/api/v1/female-leads", json=payload(slots[0]))).status_code == 409
    remaining = (await client.get("/api/v1/contact-availability")).json()["data"]
    assert len(remaining) == 8
    assert (
        await client.patch("/api/v1/matchmaker/availability", headers=headers, json=body)
    ).status_code == 409
    read = (await client.get("/api/v1/matchmaker/availability", headers=headers)).json()["data"]
    assert len(read["days"][0]["ranges"]) == 2
    assert (await client.get("/api/v1/matchmaker/availability")).status_code == 401


async def test_changed_grid_excludes_overlapping_booking(client, db):
    headers, slots = await configure(client, db)
    await client.post("/api/v1/female-leads", json=payload(slots[1]))  # 17:30-18:00
    assert (
        await client.patch(
            "/api/v1/matchmaker/availability",
            headers=headers,
            json=schedule(duration=45, revision=1),
        )
    ).status_code == 200
    available = (await client.get("/api/v1/contact-availability")).json()["data"]
    assert not [
        s
        for s in available
        if s["appointment_date"] == "2026-09-13"
        and datetime.fromisoformat(s["scheduled_at"]).hour == 17
    ]
    booking = (await client.get("/api/v1/matchmaker/appointments", headers=headers)).json()["data"][
        0
    ]
    assert booking["start_time"] == "17:30:00" and booking["end_time"] == "18:00:00"


@pytest.mark.parametrize(
    "status,remaining", [("CANCELLED", 20), ("COMPLETED", 19), ("NO_SHOW", 19)]
)
async def test_status_and_rebooking(client, db, status, remaining):
    headers, slots = await configure(client, db)
    await client.post("/api/v1/female-leads", json=payload(slots[0]))
    appointment = (await client.get("/api/v1/matchmaker/appointments", headers=headers)).json()[
        "data"
    ][0]
    other = await actor(db)
    url = f"/api/v1/matchmaker/appointments/{appointment['id']}"
    assert (await client.patch(url, headers=other, json={"status": status})).status_code == 409
    assert (await client.get("/api/v1/matchmaker/appointments", headers=other)).json()["data"] == []
    assert (await client.patch(url, headers=headers, json={"status": status})).status_code == 200
    assert len((await client.get("/api/v1/contact-availability")).json()["data"]) == remaining
    if status == "CANCELLED":
        assert (
            await client.post("/api/v1/female-leads", json=payload(slots[0]))
        ).status_code == 201
        assert await db.scalar(select(func.count(ContactAppointment.id))) == 2


async def test_invalid_and_stale_selection(client, db):
    _, slots = await configure(client, db)
    for extra in [
        {"scheduled_at": "2026-09-13T17:01:00+03:00"},
        {"scheduled_at": "2026-09-06T17:00:00+03:00"},
        {"scheduled_at": "2026-10-13T17:00:00+03:00"},
    ]:
        assert (
            await client.post("/api/v1/female-leads", json={**payload(slots[0]), **extra})
        ).status_code == 409
    for extra in [
        {"first_name": "Test"},
        {"age": 20},
        {"consent": False},
        {"scheduled_at": "2026-09-13T17:00:00"},
    ]:
        assert (
            await client.post("/api/v1/female-leads", json={**payload(slots[0]), **extra})
        ).status_code == 422
    assert await db.scalar(select(func.count(FemaleLead.id))) == 0


async def test_future_only_on_current_day(client, db, monkeypatch):
    monkeypatch.setattr(
        service, "now_local", lambda: datetime(2026, 9, 13, 17, 30, tzinfo=service.LOCAL_ZONE)
    )
    _, slots = await configure(client, db)
    assert datetime.fromisoformat(slots[0]["scheduled_at"]).time() == time(18)


async def test_rollback_and_database_unique_constraint(client, db, monkeypatch):
    _, slots = await configure(client, db)
    with monkeypatch.context() as patch:
        patch.setattr(
            DomainService,
            "notify_matchmakers",
            AsyncMock(side_effect=RuntimeError("forced failure")),
        )
        with pytest.raises(RuntimeError):
            await DomainService(db).create_lead(FemaleLeadIn(**payload(slots[0])))
    assert await db.scalar(select(func.count(FemaleLead.id))) == 0
    assert await db.scalar(select(func.count(ContactAppointment.id))) == 0
    await DomainService(db).create_lead(FemaleLeadIn(**payload(slots[0])))
    first = await db.scalar(select(ContactAppointment))
    new_lead = FemaleLead(
        phone="+963966112234",
        governorate="دمشق",
        consent=True,
        assigned_matchmaker_id=first.matchmaker_id,
    )
    db.add(new_lead)
    await db.flush()
    db.add(
        ContactAppointment(
            matchmaker_id=first.matchmaker_id,
            female_lead_id=new_lead.id,
            appointment_date=first.appointment_date,
            start_time=first.start_time,
            end_time=first.end_time,
            status="BOOKED",
        )
    )
    with pytest.raises(IntegrityError):
        await db.commit()
    await db.rollback()


async def test_simultaneous_booking_separate_connections(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'weekly-race.db'}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        await actor(db)
        owner = await db.scalar(select(Matchmaker))
        await service.save_schedule(db, owner.id, WeeklyAvailabilityIn(**schedule()))
        slot = (await service.available_slots(db, owner.id))[1]
    barrier = asyncio.Event()

    async def book():
        async with factory() as db:
            await barrier.wait()
            try:
                await DomainService(db).create_lead(FemaleLeadIn(**payload(slot)))
                return 201
            except AppError as exc:
                return exc.status_code

    tasks = [asyncio.create_task(book()), asyncio.create_task(book())]
    barrier.set()
    assert sorted(await asyncio.gather(*tasks)) == [201, 409]
    async with factory() as db:
        assert await db.scalar(select(func.count(ContactAppointment.id))) == 1
        assert await db.scalar(select(func.count(FemaleLead.id))) == 1
    await engine.dispose()
