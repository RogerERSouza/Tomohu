from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        # Account identifiers, including the local part, are case-insensitive.
        return value.lower()


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    email_verified: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


def validate_new_password(value: SecretStr) -> SecretStr:
    password = value.get_secret_value()
    if (
        len(password) < 5
        or not any("A" <= c <= "Z" for c in password)
        or not any("a" <= c <= "z" for c in password)
        or not any("0" <= c <= "9" for c in password)
    ):
        raise ValueError(
            "Use 5 to 128 characters with uppercase, lowercase and a number"
        )
    return value


class Registration(Credentials):
    password: SecretStr = Field(min_length=5, max_length=128)
    _password_policy = field_validator("password")(validate_new_password)


class EmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=254)


class TokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr = Field(min_length=1, max_length=200)


class ResetPassword(TokenRequest):
    password: SecretStr = Field(min_length=5, max_length=128)
    _password_policy = field_validator("password")(validate_new_password)


class ChangePassword(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: SecretStr = Field(min_length=1, max_length=128)
    password: SecretStr = Field(min_length=5, max_length=128)
    _password_policy = field_validator("password")(validate_new_password)
