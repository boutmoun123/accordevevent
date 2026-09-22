"""Replace single available slots with weekly rules; preserve linked bookings."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import sqlalchemy as sa

from alembic import op

revision = "c83b042a1002"
down_revision = "b72a9c31f001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("matchmakers") as batch:
        batch.add_column(
            sa.Column("slot_duration_minutes", sa.Integer(), nullable=False, server_default="30")
        )
        batch.add_column(
            sa.Column("booking_horizon_days", sa.Integer(), nullable=False, server_default="14")
        )
        batch.add_column(
            sa.Column("availability_revision", sa.Integer(), nullable=False, server_default="0")
        )
        batch.create_check_constraint("slot_duration", "slot_duration_minutes IN (15,30,45,60)")
        batch.create_check_constraint("booking_horizon", "booking_horizon_days IN (7,14,30)")
    op.create_table(
        "matchmaker_availability",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("matchmaker_id", sa.String(36), sa.ForeignKey("matchmakers.id"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday"),
        sa.CheckConstraint("end_time > start_time", name="time_range"),
    )
    op.create_index(
        "ix_matchmaker_availability_matchmaker_id", "matchmaker_availability", ["matchmaker_id"]
    )
    appointments = op.create_table(
        "contact_appointments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("matchmaker_id", sa.String(36), sa.ForeignKey("matchmakers.id"), nullable=False),
        sa.Column(
            "female_lead_id",
            sa.String(36),
            sa.ForeignKey("female_leads.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("appointment_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.CheckConstraint(
            "status IN ('BOOKED','COMPLETED','CANCELLED','NO_SHOW')", name="appointment_status"
        ),
        sa.CheckConstraint("end_time > start_time", name="appointment_range"),
    )
    op.create_index(
        "ix_contact_appointments_matchmaker_id", "contact_appointments", ["matchmaker_id"]
    )
    op.create_index(
        "uq_contact_appointment_active_start",
        "contact_appointments",
        ["matchmaker_id", "appointment_date", "start_time"],
        unique=True,
        sqlite_where=sa.text("status != 'CANCELLED'"),
        postgresql_where=sa.text("status != 'CANCELLED'"),
    )
    bind = op.get_bind()
    metadata = sa.MetaData()
    old = sa.Table("contact_availability", metadata, autoload_with=bind)
    leads = sa.Table("female_leads", metadata, autoload_with=bind)
    rows = (
        bind.execute(
            sa.select(old, leads.c.id.label("lead_id")).join(
                leads, leads.c.availability_id == old.c.id
            )
        )
        .mappings()
        .all()
    )
    for row in rows:
        start = row["scheduled_at"]
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        start = start.astimezone(ZoneInfo("Asia/Damascus"))
        end = start + timedelta(minutes=30)
        # Legacy slots had no duration. Keep their exact start and cap at day's end.
        end_time = end.time() if end.date() == start.date() else datetime.max.time()
        bind.execute(
            appointments.insert().values(
                id=row["id"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                matchmaker_id=row["matchmaker_id"],
                female_lead_id=row["lead_id"],
                appointment_date=start.date(),
                start_time=start.time(),
                end_time=end_time,
                status=row["status"] if row["status"] in ("COMPLETED", "CANCELLED") else "BOOKED",
            )
        )
    with op.batch_alter_table("female_leads") as batch:
        batch.drop_constraint("uq_female_leads_availability_id", type_="unique")
        batch.drop_constraint(
            "fk_female_leads_availability_id_contact_availability", type_="foreignkey"
        )
        batch.drop_column("availability_id")
    op.drop_table("contact_availability")


def downgrade():
    bind = op.get_bind()
    appointments = sa.Table("contact_appointments", sa.MetaData(), autoload_with=bind)
    rows = bind.execute(sa.select(appointments)).mappings().all()
    # The old schema cannot represent rebookings at the same start; refuse lossy downgrade.
    keys = [(r["matchmaker_id"], r["appointment_date"], r["start_time"]) for r in rows]
    if len(set(keys)) != len(keys):
        raise RuntimeError(
            "Downgrade cannot preserve rebooked appointment history; restore backup instead"
        )
    slots = op.create_table(
        "contact_availability",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("matchmaker_id", sa.String(36), sa.ForeignKey("matchmakers.id"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.UniqueConstraint("matchmaker_id", "scheduled_at", name="uq_contact_availability_time"),
        sa.CheckConstraint(
            "status IN ('AVAILABLE','BOOKED','DISABLED','COMPLETED','CANCELLED')",
            name="availability_status",
        ),
    )
    op.create_index(
        "ix_contact_availability_matchmaker_id", "contact_availability", ["matchmaker_id"]
    )
    with op.batch_alter_table("female_leads") as batch:
        batch.add_column(sa.Column("availability_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_female_leads_availability_id_contact_availability",
            "contact_availability",
            ["availability_id"],
            ["id"],
        )
        batch.create_unique_constraint("uq_female_leads_availability_id", ["availability_id"])
    bind = op.get_bind()
    metadata = sa.MetaData()
    appointments = sa.Table("contact_appointments", metadata, autoload_with=bind)
    leads = sa.Table("female_leads", metadata, autoload_with=bind)
    rows = bind.execute(sa.select(appointments)).mappings().all()
    for row in rows:
        start = datetime.combine(
            row["appointment_date"], row["start_time"], ZoneInfo("Asia/Damascus")
        )
        bind.execute(
            slots.insert().values(
                id=row["id"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                matchmaker_id=row["matchmaker_id"],
                scheduled_at=start.astimezone(timezone.utc),
                status="COMPLETED" if row["status"] == "NO_SHOW" else row["status"],
            )
        )
        bind.execute(
            leads.update()
            .where(leads.c.id == row["female_lead_id"])
            .values(availability_id=row["id"])
        )
    op.drop_table("contact_appointments")
    op.drop_table("matchmaker_availability")
    with op.batch_alter_table("matchmakers") as batch:
        batch.drop_constraint(op.f("ck_matchmakers_slot_duration"), type_="check")
        batch.drop_constraint(op.f("ck_matchmakers_booking_horizon"), type_="check")
        batch.drop_column("slot_duration_minutes")
        batch.drop_column("booking_horizon_days")
        batch.drop_column("availability_revision")
