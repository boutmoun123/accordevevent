"""Run only against a freshly created scratch database; never downgrade the app database.

Run inside the Compose network with the backend environment and pytest installed.
"""
import asyncio
import json
import os
import subprocess
import sys
from uuid import uuid4

import asyncpg


def run(*args, env):
    result = subprocess.run([sys.executable, *args], env=env, capture_output=True, text=True)
    if result.returncode:
        print(result.stdout)
        print(result.stderr)
        raise RuntimeError(f"Verification command failed: {args}")
    return result.stdout.strip()


async def main():
    source_url = os.environ["DATABASE_URL"]
    name = "farah_verify_" + uuid4().hex[:12]
    admin = await asyncpg.connect(source_url.replace("postgresql+asyncpg://", "postgresql://"))
    await admin.execute(f'CREATE DATABASE "{name}"')
    url = source_url.rsplit("/", 1)[0] + "/" + name
    env = {**os.environ, "DATABASE_URL": url, "ENVIRONMENT": "test", "GEMINI_API_KEY": "", "QDRANT_URL": ""}
    try:
        for action in [("upgrade", "head"), ("downgrade", "base"), ("upgrade", "head")]:
            run("-m", "alembic", *action, env=env)
        run("-m", "app.database.seed", env=env)
        db = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))
        tables = await db.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        before = {row["tablename"]: await db.fetchval(f'SELECT count(*) FROM "{row["tablename"]}"') for row in tables}
        run("-m", "app.database.seed", env=env)
        after = {row["tablename"]: await db.fetchval(f'SELECT count(*) FROM "{row["tablename"]}"') for row in tables}
        assert before == after
        assert after["users"] == 24 and after["female_profiles"] == 50
        run("-m", "alembic", "check", env=env)
        print(json.dumps({"postgres_migrations": "upgrade/downgrade/upgrade passed", "seed_idempotency": before == after, "counts": after}))
        print(run("-m", "scripts.verify_qdrant", env={**env, "QDRANT_URL": os.environ["QDRANT_URL"]}))
        # Reset only this scratch database before running the API test suite.
        await db.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        await db.close()
        print(run("-m", "pytest", "-q", "--tb=short", "--show-capture=no", "-o", "cache_dir=/tmp/farah-pytest-cache", env={**env, "FARAH_TEST_DATABASE_URL": url}))
    finally:
        await admin.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
        await admin.close()


if __name__ == "__main__":
    asyncio.run(main())
