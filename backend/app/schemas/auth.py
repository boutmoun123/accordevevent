from datetime import date

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=30, pattern=r"^\+?[0-9][0-9\- ]+$")
    password: str = Field(min_length=10, max_length=128)
    governorate: str = Field(min_length=2, max_length=100)
    date_of_birth: date

    @field_validator("date_of_birth")
    @classmethod
    def adult_birth_date(cls, value: date) -> date:
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if not 18 <= age <= 90:
            raise ValueError("العمر يجب أن يكون بين 18 و90 سنة.")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str
    password: str


class MalePhoneStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str = Field(min_length=8, max_length=30)


class MalePhoneVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    challenge_id: str = Field(min_length=36, max_length=36)
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^[0-9]{6}$",
        validation_alias=AliasChoices("otp", "code"),
    )


class MaleRequestCodeLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    request_code: str = Field(
        min_length=8,
        max_length=40,
        validation_alias=AliasChoices("request_code", "code"),
    )


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    first_name: str | None
    phone: str
    email: str | None
    governorate: str | None
    role: str
    status: str
    permissions: list[str]
