from datetime import datetime, time
from decimal import Decimal
from typing import Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

from app.models.enums import (
    ContactPreference,
    Decision,
    FeedbackDecision,
    FemaleLeadStatus,
    FemaleProfileStatus,
    MatchCaseStatus,
    MeetingType,
    PaymentStatus,
    SuccessFeeStatus,
    UserStatus,
    VerificationStatus,
)
from app.schemas.characteristics import (
    HijabCategory,
    MaleContactPreference,
    MaritalCategory,
    PreferredContactMethod,
)


class MaleCharacteristics(BaseModel):
    """Validated source-of-truth fields collected by the progressive chat."""

    model_config = ConfigDict(extra="forbid")

    age: StrictInt = Field(ge=18, le=90)
    governorate: str = Field(min_length=2, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    marital_status: MaritalCategory | None = Field(default=None, max_length=50)
    height: StrictInt | None = Field(default=None, ge=120, le=230)
    education: str | None = Field(default=None, max_length=150)
    education_field: str | None = Field(default=None, max_length=150)
    occupation: str | None = Field(default=None, max_length=150)
    employment_status: str | None = Field(default=None, max_length=100)
    religious_preference: str | None = Field(default=None, max_length=100)
    children: bool | None = None
    values: list[str] = Field(default_factory=list, max_length=20)
    personality_traits: list[str] = Field(default_factory=list, max_length=20)
    preferred_contact: MaleContactPreference | None = Field(default=None, max_length=100)
    preferred_contact_method: PreferredContactMethod | None = None


class DesiredPartnerPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age_min: StrictInt = Field(ge=18, le=90)
    age_max: StrictInt = Field(ge=18, le=90)
    governorates: list[str] = Field(default_factory=list, max_length=13)
    governorate: str | None = Field(default=None, max_length=100)
    height_min: StrictInt | None = Field(default=None, ge=120, le=230)
    height_max: StrictInt | None = Field(default=None, ge=120, le=230)
    education: str | list[str] | None = None
    occupation: str | list[str] | None = None
    profession_preference: str | list[str] | None = None
    marital_status: MaritalCategory | list[MaritalCategory] | None = None
    children: bool | None = None
    children_preference: bool | None = None
    hijab_status: HijabCategory | list[HijabCategory] | None = None
    religious_preference: str | list[str] | None = None
    values: list[str] = Field(default_factory=list, max_length=20)
    traits: list[str] = Field(default_factory=list, max_length=20)
    personality_traits: list[str] = Field(default_factory=list, max_length=20)
    other_criteria: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def valid_ranges(self):
        if self.age_min > self.age_max:
            raise ValueError("desired age range is invalid")
        if (
            self.height_min is not None
            and self.height_max is not None
            and self.height_min > self.height_max
        ):
            raise ValueError("desired height range is invalid")
        return self


class DesiredMalePreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age_min: StrictInt | None = Field(default=None, ge=18, le=90)
    age_max: StrictInt | None = Field(default=None, ge=18, le=90)
    governorates: list[str] = Field(default_factory=list, max_length=13)
    height_min: StrictInt | None = Field(default=None, ge=120, le=230)
    height_max: StrictInt | None = Field(default=None, ge=120, le=230)
    education: str | list[str] | None = None
    marital_status: MaritalCategory | list[MaritalCategory] | None = None
    children_preference: bool | None = None
    religious_preference: str | list[str] | None = None
    profession_preference: str | list[str] | None = None
    values: list[str] = Field(default_factory=list, max_length=20)
    traits: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def valid_ranges(self):
        if self.age_min is not None and self.age_max is not None and self.age_min > self.age_max:
            raise ValueError("desired age range is invalid")
        if (
            self.height_min is not None
            and self.height_max is not None
            and self.height_min > self.height_max
        ):
            raise ValueError("desired height range is invalid")
        return self


class MaleRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    male_characteristics: MaleCharacteristics
    desired_female_characteristics: DesiredPartnerPreferences


class MaleRequestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def sections_cannot_be_cleared(self):
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self

    male_characteristics: MaleCharacteristics | None = None
    desired_female_characteristics: DesiredPartnerPreferences | None = None


class FemaleLeadIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(min_length=8, max_length=30, pattern=r"^\+?[0-9][0-9\- ]+$")
    governorate: str = Field(min_length=2, max_length=100)
    matchmaker_id: str = Field(min_length=36, max_length=36)
    scheduled_at: datetime

    @field_validator("scheduled_at")
    @classmethod
    def aware_appointment(cls, value):
        if value.tzinfo is None:
            raise ValueError("Timezone is required")
        return value

    notes: str | None = Field(default=None, max_length=500)
    consent: Literal[True]


class WeeklyTimeRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def valid_range(self):
        for value in (self.start_time, self.end_time):
            if value.tzinfo is not None or value.second or value.microsecond:
                raise ValueError("Use local HH:MM times")
        if self.end_time <= self.start_time:
            raise ValueError("ساعة النهاية يجب أن تكون بعد البداية")
        return self


class WeeklyDay(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weekday: StrictInt = Field(ge=0, le=6)  # Sunday = 0
    is_active: bool
    ranges: list[WeeklyTimeRange] = Field(default_factory=list, max_length=24)

    @model_validator(mode="after")
    def no_overlap(self):
        if self.is_active and not self.ranges:
            raise ValueError("أضيفي فترة واحدة على الأقل لليوم المتاح")
        ordered = sorted(self.ranges, key=lambda r: r.start_time)
        if any(a.end_time > b.start_time for a, b in zip(ordered, ordered[1:], strict=False)):
            raise ValueError("الفترات المتداخلة في اليوم نفسه غير مسموحة")
        return self


class WeeklyAvailabilityIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_duration_minutes: Literal[15, 30, 45, 60] = 30
    booking_horizon_days: Literal[7, 14, 30] = 14
    revision: StrictInt = Field(ge=0)
    days: list[WeeklyDay] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def unique_days(self):
        if len({d.weekday for d in self.days}) != 7:
            raise ValueError("كل يوم من أيام الأسبوع يجب أن يظهر مرة واحدة")
        return self


class AppointmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["COMPLETED", "CANCELLED", "NO_SHOW"]


class FemaleProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str | None = None
    phone: str = Field(min_length=8, max_length=30)
    email: str | None = None
    exact_address: str | None = None
    private_notes: str | None = None
    age: StrictInt = Field(ge=18, le=90)
    governorate: str
    city: str | None = None
    height: StrictInt | None = Field(default=None, ge=120, le=220)
    education: str | None = None
    education_field: str | None = None
    occupation: str | None = None
    marital_status: MaritalCategory | None = None
    children: bool | None = None
    hijab_status: HijabCategory | None = None
    religious_preference: str | None = None
    personality_traits: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    public_summary: str | None = None
    desired_male: DesiredMalePreferences = Field(default_factory=DesiredMalePreferences)
    contact_preference: ContactPreference = ContactPreference.MATCHMAKER
    status: FemaleProfileStatus = FemaleProfileStatus.DRAFT


class FemaleProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self):
        required = {
            "first_name",
            "phone",
            "age",
            "governorate",
            "personality_traits",
            "interests",
            "values",
            "desired_male",
            "contact_preference",
            "status",
        }
        for name in self.model_fields_set & required:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self

    first_name: str | None = Field(default=None, min_length=2, max_length=100)
    last_name: str | None = None
    phone: str | None = Field(default=None, min_length=8, max_length=30)
    email: str | None = None
    exact_address: str | None = None
    private_notes: str | None = None
    age: StrictInt | None = Field(default=None, ge=18, le=90)
    governorate: str | None = None
    city: str | None = None
    height: StrictInt | None = Field(default=None, ge=120, le=220)
    education: str | None = None
    education_field: str | None = None
    occupation: str | None = None
    marital_status: MaritalCategory | None = None
    children: bool | None = None
    hijab_status: HijabCategory | None = None
    religious_preference: str | None = None
    personality_traits: list[str] | None = None
    interests: list[str] | None = None
    values: list[str] | None = None
    public_summary: str | None = None
    desired_male: DesiredMalePreferences | None = None
    contact_preference: ContactPreference | None = None
    status: FemaleProfileStatus | None = None


class MatchCaseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str


class MatchCaseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MatchCaseStatus | None = None
    female_decision: Decision | None = None
    male_decision: Decision | None = None
    reason: str | None = Field(default=None, max_length=1000)


class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    male_request_id: str
    match_case_id: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    method: str | None = None
    reference: str | None = None
    status: PaymentStatus = PaymentStatus.PENDING

    @field_validator("status")
    @classmethod
    def initial_payment_status(cls, value: PaymentStatus) -> PaymentStatus:
        if value == PaymentStatus.REFUNDED:
            raise ValueError("A payment cannot be created as refunded")
        return value


class PaymentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: PaymentStatus
    method: str | None = None
    reference: str | None = None


class MeetingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_case_id: str
    meeting_type: MeetingType
    scheduled_at: datetime
    location_or_link: str | None = None
    participants: list[str] = Field(default_factory=list)
    notes: str | None = None


class MeetingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(COMPLETED)$")


class MeetingFeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    party: str = Field(pattern="^(MALE|FEMALE)$")
    decision: FeedbackDecision
    notes: str | None = Field(default=None, max_length=2000)


class FemaleLeadUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: FemaleLeadStatus


class NotificationRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    read: bool = True


class ChatMessageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_key: str = Field(
        min_length=8,
        max_length=100,
        validation_alias=AliasChoices("session_key", "session_id"),
    )
    gender: str = Field(pattern="^(MALE|FEMALE)$")
    message: str = Field(min_length=1, max_length=4000)


class SettingPatch(BaseModel):
    values: dict[str, Any]


class UserPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def cannot_clear_required_fields(self):
        for field in self.model_fields_set & {"first_name", "phone", "status", "permissions"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    status: UserStatus | None = None
    permissions: list[str] | None = None
    first_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=8, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    governorate: str | None = Field(default=None, max_length=100)


class MatchmakerPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verification_status: VerificationStatus | None = None
    governorates: list[str] | None = None
    status: UserStatus | None = None
    permissions: list[str] | None = None


class MatchmakerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=30, pattern=r"^\+?[0-9][0-9\- ]+$")
    email: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=10, max_length=128)
    governorates: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class SuccessFeeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: SuccessFeeStatus

    @field_validator("status")
    @classmethod
    def cannot_clear_tracking(cls, value: SuccessFeeStatus) -> SuccessFeeStatus:
        if value == SuccessFeeStatus.NONE:
            raise ValueError("Tracked success fee cannot be reset to NONE")
        return value


class ReportUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(OPEN|REVIEWING|RESOLVED|DISMISSED)$")
