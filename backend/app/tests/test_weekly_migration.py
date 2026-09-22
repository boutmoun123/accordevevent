import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def test_existing_bookings_survive_weekly_migration(tmp_path):
    path = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{path}"}
    backend = Path(__file__).resolve().parents[2]

    def alembic(*args):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr

    alembic("upgrade", "b72a9c31f001")
    conn = sqlite3.connect(path)
    stamp = "2026-09-12 09:00:00"
    conn.execute(
        "INSERT INTO users (id, first_name, phone, password_hash, role, status, "
        "permissions, created_at, updated_at) "
        "VALUES ('user','test','+9630001','unused','MATCHMAKER','ACTIVE','[]',?,?)",
        (stamp, stamp),
    )
    conn.execute(
        "INSERT INTO matchmakers (id, user_id, verification_status, governorates, "
        "created_at, updated_at) VALUES ('owner','user','VERIFIED','[]',?,?)",
        (stamp, stamp),
    )
    for i, status in enumerate(["BOOKED", "COMPLETED", "CANCELLED"]):
        conn.execute(
            "INSERT INTO contact_availability VALUES (?,?,?,?,?,?)",
            (f"slot{i}", stamp, stamp, "owner", f"2026-09-1{3 + i} 14:30:00", status),
        )
        conn.execute(
            "INSERT INTO female_leads (id, phone, governorate, notes, consent, status, "
            "assigned_matchmaker_id, created_at, updated_at, availability_id) "
            "VALUES (?, '+9630002','test','preserved',1,'NEW','owner',?,?,?)",
            (f"lead{i}", stamp, stamp, f"slot{i}"),
        )
    conn.commit()
    conn.close()
    alembic("upgrade", "head")
    alembic("check")
    conn = sqlite3.connect(path)
    rows = conn.execute(
        "SELECT female_lead_id,start_time,end_time,status "
        "FROM contact_appointments ORDER BY female_lead_id"
    ).fetchall()
    assert [(r[0], r[1][:5], r[2][:5], r[3]) for r in rows] == [
        (f"lead{i}", "17:30", "18:00", status)
        for i, status in enumerate(["BOOKED", "COMPLETED", "CANCELLED"])
    ]
    assert conn.execute("SELECT count(*) FROM matchmaker_availability").fetchone()[0] == 0
    assert (
        conn.execute("SELECT count(*) FROM female_leads WHERE notes='preserved'").fetchone()[0] == 3
    )
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    conn.close()
    alembic("downgrade", "b72a9c31f001")
    alembic("upgrade", "head")
    alembic("check")
