import os
from uuid import uuid4

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app


@pytest_asyncio.fixture
async def session_factory():
    postgres_url = os.environ.get("FARAH_TEST_DATABASE_URL")
    if postgres_url:
        if not postgres_url.rsplit("/", 1)[-1].startswith("farah_verify_"):
            raise RuntimeError("PostgreSQL tests require an isolated farah_verify_* database")
        engine = create_async_engine(postgres_url)
    else:
        engine = create_async_engine(
            "sqlite+aiosqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    if postgres_url:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db(session_factory):
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory, monkeypatch):
    monkeypatch.setattr("app.database.session.SessionLocal", session_factory)
    monkeypatch.setattr("app.main.SessionLocal", session_factory)

    async def override_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(
        transport=ASGITransport(app=app, client=(str(uuid4()), 123)), base_url="http://test"
    ) as http:
        yield http
    app.dependency_overrides.clear()
