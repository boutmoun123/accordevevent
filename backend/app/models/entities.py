from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    ContactPreference,
    Decision,
    FeedbackDecision,
    FemaleLeadStatus,
    FemaleProfileStatus,
    MatchCaseStatus,
    MeetingType,
    PaymentStatus,
    Role,
    SuccessFeeStatus,
    UserStatus,
    VerificationStatus,
)


def enum_col(enum: type, default=None):
    return mapped_column(SAEnum(enum, native_enum=False), default=default, nullable=False)


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    governorate: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    role: Mapped[Role] = enum_col(Role, Role.MALE_USER)
    status: Mapped[UserStatus] = enum_col(UserStatus, UserStatus.ACTIVE)
    permissions: Mapped[list] = mapped_column(JSON, default=list)


class Matchmaker(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "matchmakers"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    verification_status: Mapped[VerificationStatus] = enum_col(
        VerificationStatus, VerificationStatus.PENDING
    )
    governorates: Mapped[list] = mapped_column(JSON, default=list)
    bio: Mapped[str | None] = mapped_column(Text)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    booking_horizon_days: Mapped[int] = mapped_column(Integer, default=14, server_default="14")
    availability_revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    __table_args__ = (
        CheckConstraint("slot_duration_minutes IN (15,30,45,60)", name="slot_duration"),
        CheckConstraint("booking_horizon_days IN (7,14,30)", name="booking_horizon"),
    )


class MaleProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "male_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    characteristics: Mapped[dict] = mapped_column(JSON, default=dict)
    preferred_contact: Mapped[str | None] = mapped_column(String(50))


class MaleRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "male_requests"
    _legacy_request_code: Mapped[str | None] = mapped_column(
        "request_code", String(30), unique=True, index=True, nullable=True
    )
    male_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    male_characteristics: Mapped[dict] = mapped_column(JSON, default=dict)
    desired_female_characteristics: Mapped[dict] = mapped_column(JSON, default=dict)
    assigned_matchmaker_id: Mapped[str | None] = mapped_column(ForeignKey("matchmakers.id"))
    verification_status: Mapped[VerificationStatus] = enum_col(
        VerificationStatus, VerificationStatus.PENDING
    )
    workflow_status: Mapped[str] = mapped_column(String(50), default="ACTIVE")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    __table_args__ = (
        Index(
            "uq_male_requests_one_active",
            "male_user_id",
            unique=True,
            postgresql_where=text("is_active = true"),
            sqlite_where=text("is_active = 1"),
        ),
    )

    @property
    def request_code(self) -> str:
        from app.auth.identifiers import request_code_for_id

        return request_code_for_id(self.id)


class MaleRequestAccessCode(UUIDPrimaryKeyMixin, Base):
    """One-way request access credentials, including migrated legacy aliases."""

    __tablename__ = "male_request_access_codes"
    male_request_id: Mapped[str] = mapped_column(
        ForeignKey("male_requests.id", ondelete="CASCADE"), index=True
    )
    code_digest: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    __table_args__ = (
        Index(
            "uq_male_request_access_codes_primary",
            "male_request_id",
            unique=True,
            postgresql_where=text("is_primary = true"),
            sqlite_where=text("is_primary = 1"),
        ),
    )


class OtpChallenge(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "otp_challenges"
    phone: Mapped[str] = mapped_column(String(30), index=True)
    code_digest: Mapped[str] = mapped_column(String(64))
    provider: Mapped[str] = mapped_column(String(30))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="otp_attempts_nonnegative"),
        CheckConstraint("max_attempts > 0", name="otp_max_attempts_positive"),
    )


class AuthAttempt(UUIDPrimaryKeyMixin, Base):
    """Minimal, privacy-preserving events used for credential-specific throttling."""

    __tablename__ = "auth_attempts"
    method: Mapped[str] = mapped_column(String(30))
    subject_digest: Mapped[str] = mapped_column(String(64), index=True)
    ip_digest: Mapped[str] = mapped_column(String(64), index=True)
    successful: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    __table_args__ = (
        Index("ix_auth_attempts_method_created_at", "method", "created_at"),
    )


class FemaleLead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "female_leads"
    phone: Mapped[str] = mapped_column(String(30), index=True)
    governorate: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    consent: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[FemaleLeadStatus] = enum_col(FemaleLeadStatus, FemaleLeadStatus.NEW)
    assigned_matchmaker_id: Mapped[str | None] = mapped_column(ForeignKey("matchmakers.id"))


class MatchmakerAvailability(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "matchmaker_availability"
    matchmaker_id: Mapped[str] = mapped_column(ForeignKey("matchmakers.id"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday"),
        CheckConstraint("end_time > start_time", name="time_range"),
    )


class ContactAppointment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contact_appointments"
    matchmaker_id: Mapped[str] = mapped_column(ForeignKey("matchmakers.id"), index=True)
    female_lead_id: Mapped[str] = mapped_column(ForeignKey("female_leads.id"), unique=True)
    appointment_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(20), default="BOOKED")
    __table_args__ = (
        CheckConstraint(
            "status IN ('BOOKED','COMPLETED','CANCELLED','NO_SHOW')", name="appointment_status"
        ),
        CheckConstraint("end_time > start_time", name="appointment_range"),
        Index(
            "uq_contact_appointment_active_start",
            "matchmaker_id",
            "appointment_date",
            "start_time",
            unique=True,
            sqlite_where=text("status != 'CANCELLED'"),
            postgresql_where=text("status != 'CANCELLED'"),
        ),
    )


class FemaleProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "female_profiles"
    public_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    matchmaker_id: Mapped[str] = mapped_column(ForeignKey("matchmakers.id"), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    exact_address: Mapped[str | None] = mapped_column(Text)
    private_notes: Mapped[str | None] = mapped_column(Text)
    age: Mapped[int] = mapped_column(Integer)
    governorate: Mapped[str] = mapped_column(String(100), index=True)
    city: Mapped[str | None] = mapped_column(String(100))
    height: Mapped[int | None] = mapped_column(Integer)
    education: Mapped[str | None] = mapped_column(String(150))
    education_field: Mapped[str | None] = mapped_column(String(150))
    occupation: Mapped[str | None] = mapped_column(String(150))
    marital_status: Mapped[str | None] = mapped_column(String(50))
    children: Mapped[bool | None] = mapped_column(Boolean)
    hijab_status: Mapped[str | None] = mapped_column(String(50))
    religious_preference: Mapped[str | None] = mapped_column(String(100))
    personality_traits: Mapped[list] = mapped_column(JSON, default=list)
    interests: Mapped[list] = mapped_column(JSON, default=list)
    values: Mapped[list] = mapped_column(JSON, default=list)
    public_summary: Mapped[str | None] = mapped_column(Text)
    desired_male: Mapped[dict] = mapped_column(JSON, default=dict)
    contact_preference: Mapped[ContactPreference] = enum_col(
        ContactPreference, ContactPreference.MATCHMAKER
    )
    status: Mapped[FemaleProfileStatus] = enum_col(FemaleProfileStatus, FemaleProfileStatus.DRAFT)


class MatchCandidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "match_candidates"
    male_request_id: Mapped[str] = mapped_column(ForeignKey("male_requests.id"), index=True)
    female_profile_id: Mapped[str] = mapped_column(ForeignKey("female_profiles.id"), index=True)
    matchmaker_id: Mapped[str | None] = mapped_column(ForeignKey("matchmakers.id"))
    male_to_female_score: Mapped[float] = mapped_column(Float)
    female_to_male_score: Mapped[float] = mapped_column(Float)
    mutual_score: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE")
    __table_args__ = (
        UniqueConstraint("male_request_id", "female_profile_id", name="uq_candidate_pair"),
    )


class MatchCase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "match_cases"
    candidate_id: Mapped[str] = mapped_column(ForeignKey("match_candidates.id"), unique=True)
    male_request_id: Mapped[str] = mapped_column(ForeignKey("male_requests.id"), index=True)
    female_profile_id: Mapped[str] = mapped_column(ForeignKey("female_profiles.id"))
    matchmaker_id: Mapped[str] = mapped_column(ForeignKey("matchmakers.id"))
    status: Mapped[MatchCaseStatus] = enum_col(MatchCaseStatus, MatchCaseStatus.CANDIDATE_SELECTED)
    female_decision: Mapped[Decision] = enum_col(Decision, Decision.PENDING)
    male_decision: Mapped[Decision] = enum_col(Decision, Decision.PENDING)
    engaged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    married_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    success_fee_status: Mapped[SuccessFeeStatus] = enum_col(SuccessFeeStatus, SuccessFeeStatus.NONE)


class MatchCaseHistory(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "match_case_history"
    match_case_id: Mapped[str] = mapped_column(ForeignKey("match_cases.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(50))
    to_status: Mapped[str] = mapped_column(String(50))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payments"
    male_request_id: Mapped[str] = mapped_column(ForeignKey("male_requests.id"), index=True)
    match_case_id: Mapped[str | None] = mapped_column(ForeignKey("match_cases.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[PaymentStatus] = enum_col(PaymentStatus, PaymentStatus.PENDING)
    method: Mapped[str | None] = mapped_column(String(50))
    reference: Mapped[str | None] = mapped_column(String(100), unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Meeting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "meetings"
    match_case_id: Mapped[str] = mapped_column(ForeignKey("match_cases.id"), index=True)
    meeting_type: Mapped[MeetingType] = enum_col(MeetingType)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location_or_link: Mapped[str | None] = mapped_column(Text)
    participants: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED")


class MeetingFeedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "meeting_feedback"
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), index=True)
    party: Mapped[str] = mapped_column(String(10))
    decision: Mapped[FeedbackDecision] = enum_col(FeedbackDecision)
    notes: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("meeting_id", "party", name="uq_feedback_party"),)


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "conversations"
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    session_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    gender: Mapped[str] = mapped_column(String(10))
    structured_state: Mapped[dict] = mapped_column(JSON, default=dict)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)


class Message(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "messages"
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Report(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reports"
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="OPEN")


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    old_values: Mapped[dict | None] = mapped_column(JSON)
    new_values: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class SystemSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[object] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
