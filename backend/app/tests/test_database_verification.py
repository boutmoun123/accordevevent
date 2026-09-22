import asyncio
import os
import secrets
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.base import Base
from app.models import MaleRequest, Role, User
from app.schemas.domain import MaleRequestIn
from app.services.domain import DomainService


def test_clean_migration_roundtrip_and_seed_idempotency(tmp_path):
    database = tmp_path / "migration.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite+aiosqlite:///{database.as_posix()}",
        "ENVIRONMENT": "test",
        "DEV_SEED_PASSWORD": secrets.token_urlsafe(24),
        "GEMINI_API_KEY": "",
        "QDRANT_URL": "",
    }
    root = Path(__file__).resolve().parents[2]

    def run(*args):
        result = subprocess.run(
            [sys.executable, *args], cwd=root, env=env, capture_output=True, text=True, timeout=90
        )
        assert result.returncode == 0, result.stdout + result.stderr

    run("-m", "alembic", "upgrade", "head")
    run("-m", "alembic", "downgrade", "base")
    run("-m", "alembic", "upgrade", "head")
    run("-m", "app.database.seed")
    import sqlite3

    with sqlite3.connect(database) as db:
        tables = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        before = {
            table: db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in tables
        }
    run("-m", "app.database.seed")
    with sqlite3.connect(database) as db:
        after = {
            table: db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in tables
        }
    assert before == after
    assert after["users"] == 24 and after["female_profiles"] == 50
    run("-m", "alembic", "check")


@pytest.mark.asyncio
async def test_concurrent_duplicate_requests_return_same_record(tmp_path, monkeypatch):
    url = os.environ.get("FARAH_TEST_DATABASE_URL")
    if url and not url.rsplit("/", 1)[-1].startswith("farah_verify_"):
        raise RuntimeError("Concurrent tests require an isolated database")
    engine = create_async_engine(
        url or f"sqlite+aiosqlite:///{(tmp_path / 'concurrent.db').as_posix()}"
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        user = User(
            first_name="Concurrent", phone="concurrent", password_hash="unused", role=Role.MALE_USER
        )
        db.add(user)
        await db.commit()
        user_id = user.id
    original = DomainService.get_active_request
    ready = asyncio.Event()
    arrivals = 0

    async def synchronized_lookup(self, uid):
        nonlocal arrivals
        result = await original(self, uid)
        if arrivals < 2:
            arrivals += 1
            if arrivals == 2:
                ready.set()
            await asyncio.wait_for(ready.wait(), 5)
        return result

    monkeypatch.setattr(DomainService, "get_active_request", synchronized_lookup)
    payload = MaleRequestIn(
        male_characteristics={"age": 30, "governorate": "Damascus"},
        desired_female_characteristics={"age_min": 20, "age_max": 30},
    )

    async def create():
        async with factory() as db:
            user = await db.get(User, user_id)
            request, created = await DomainService(db).create_or_get_request(user, payload)
            return request.id, created

    try:
        results = await asyncio.wait_for(asyncio.gather(create(), create()), 20)
        assert results[0][0] == results[1][0]
        assert sum(created for _, created in results) == 1
        async with factory() as db:
            assert await db.scalar(select(func.count(MaleRequest.id))) == 1
    finally:
        if url:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
