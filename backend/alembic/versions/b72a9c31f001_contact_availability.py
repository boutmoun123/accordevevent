"""Contact availability and unique lead booking."""

import sqlalchemy as sa

from alembic import op

revision = "b72a9c31f001"
down_revision = "a66577795a04"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
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
        batch.drop_column("first_name")
        batch.drop_column("age")
        batch.drop_column("preferred_time")


def downgrade():
    with op.batch_alter_table("female_leads") as batch:
        batch.add_column(sa.Column("first_name", sa.String(100), nullable=True))
        batch.add_column(sa.Column("age", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("preferred_time", sa.String(100), nullable=True))
        batch.drop_constraint("uq_female_leads_availability_id", type_="unique")
        batch.drop_constraint(
            "fk_female_leads_availability_id_contact_availability", type_="foreignkey"
        )
        batch.drop_column("availability_id")
    op.drop_table("contact_availability")
