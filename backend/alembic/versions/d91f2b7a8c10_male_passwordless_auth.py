"""male passwordless auth

Revision ID: d91f2b7a8c10
Revises: c83b042a1002
Create Date: 2026-09-10 00:00:00.000000
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d91f2b7a8c10"
down_revision: str | None = "c83b042a1002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _digest(value: str) -> str:
    secret = b"development-only-auth-pepper-change-me"
    canonical = _canonical_code(value)
    return hmac.new(secret, f"request-code:{canonical}".encode("utf-8"), hashlib.sha256).hexdigest()


def _canonical_code(value: str) -> str:
    compact = "".join(ch for ch in value.strip().upper() if ch not in {" ", "-"})
    body = compact[3:] if compact.startswith("FRH") else compact
    return "FRH-" + "-".join(body[index : index + 4] for index in range(0, len(body), 4))


def _request_code_for_id(request_id: str) -> str:
    secret = b"development-only-auth-pepper-change-me"
    entropy = hmac.new(secret, f"request-id:{request_id}".encode(), hashlib.sha256).digest()[:10]
    number = int.from_bytes(entropy, "big")
    chars = []
    for _ in range(16):
        number, offset = divmod(number, len(REQUEST_CODE_ALPHABET))
        chars.append(REQUEST_CODE_ALPHABET[offset])
    body = "".join(reversed(chars))
    return "FRH-" + "-".join(body[index : index + 4] for index in range(0, len(body), 4))


def _insert_access_code(bind, request_id: str, code: str, primary: bool) -> None:
    exists = bind.execute(
        sa.text("SELECT 1 FROM male_request_access_codes WHERE code_digest = :digest"),
        {"digest": _digest(code)},
    ).first()
    if exists:
        return
    bind.execute(
        sa.text(
            """
            INSERT INTO male_request_access_codes
            (id, male_request_id, code_digest, is_primary, created_at)
            VALUES (:id, :male_request_id, :code_digest, :is_primary, CURRENT_TIMESTAMP)
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "male_request_id": request_id,
            "code_digest": _digest(code),
            "is_primary": primary,
        },
    )


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.alter_column("first_name", existing_type=sa.String(length=100), nullable=True)
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)

    with op.batch_alter_table("male_requests") as batch:
        batch.alter_column("request_code", existing_type=sa.String(length=30), nullable=True)

    op.create_table(
        "male_request_access_codes",
        sa.Column("male_request_id", sa.String(length=36), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["male_request_id"], ["male_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_male_request_access_codes_code_digest"),
        "male_request_access_codes",
        ["code_digest"],
        unique=True,
    )
    op.create_index(
        op.f("ix_male_request_access_codes_male_request_id"),
        "male_request_access_codes",
        ["male_request_id"],
        unique=False,
    )
    op.create_index(
        "uq_male_request_access_codes_primary",
        "male_request_access_codes",
        ["male_request_id"],
        unique=True,
        sqlite_where=sa.text("is_primary = 1"),
        postgresql_where=sa.text("is_primary = true"),
    )

    op.create_table(
        "otp_challenges",
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.CheckConstraint("attempts >= 0", name="otp_attempts_nonnegative"),
        sa.CheckConstraint("max_attempts > 0", name="otp_max_attempts_positive"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_otp_challenges_expires_at"), "otp_challenges", ["expires_at"])
    op.create_index(op.f("ix_otp_challenges_phone"), "otp_challenges", ["phone"])

    op.create_table(
        "auth_attempts",
        sa.Column("method", sa.String(length=30), nullable=False),
        sa.Column("subject_digest", sa.String(length=64), nullable=False),
        sa.Column("ip_digest", sa.String(length=64), nullable=False),
        sa.Column("successful", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_attempts_ip_digest"), "auth_attempts", ["ip_digest"])
    op.create_index(
        "ix_auth_attempts_method_created_at", "auth_attempts", ["method", "created_at"]
    )
    op.create_index(op.f("ix_auth_attempts_subject_digest"), "auth_attempts", ["subject_digest"])

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, request_code FROM male_requests")).mappings()
    for row in rows:
        _insert_access_code(bind, row["id"], _request_code_for_id(row["id"]), True)
        if row["request_code"]:
            _insert_access_code(bind, row["id"], row["request_code"], False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_attempts_subject_digest"), table_name="auth_attempts")
    op.drop_index("ix_auth_attempts_method_created_at", table_name="auth_attempts")
    op.drop_index(op.f("ix_auth_attempts_ip_digest"), table_name="auth_attempts")
    op.drop_table("auth_attempts")
    op.drop_index(op.f("ix_otp_challenges_phone"), table_name="otp_challenges")
    op.drop_index(op.f("ix_otp_challenges_expires_at"), table_name="otp_challenges")
    op.drop_table("otp_challenges")
    op.drop_index("uq_male_request_access_codes_primary", table_name="male_request_access_codes")
    op.drop_index(
        op.f("ix_male_request_access_codes_male_request_id"),
        table_name="male_request_access_codes",
    )
    op.drop_index(
        op.f("ix_male_request_access_codes_code_digest"),
        table_name="male_request_access_codes",
    )
    op.drop_table("male_request_access_codes")

    with op.batch_alter_table("male_requests") as batch:
        batch.alter_column("request_code", existing_type=sa.String(length=30), nullable=False)

    with op.batch_alter_table("users") as batch:
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
        batch.alter_column("first_name", existing_type=sa.String(length=100), nullable=False)
REQUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
