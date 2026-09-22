import re
from typing import Any


class PrivacySanitizerService:
    BLOCKED_KEYS = {
        "first_name",
        "first_name_private",
        "last_name",
        "last_name_private",
        "full_name",
        "name",
        "phone",
        "mobile",
        "email",
        "address",
        "exact_address",
        "private_notes",
        "identifier",
        "identifiers",
        "id",
        "female_profile_id",
        "public_code",
    }
    PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d\s\-()]{6,}\d)(?!\w)")
    EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
    LABELED_SECRET = re.compile(
        r"(?:اسمي|الاسم|العنوان|أسكن في|اقيم في|أقيم في)\s*[:：-]?\s*[^،,.\n]{2,80}",
        re.IGNORECASE,
    )

    def sanitize(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: self.sanitize(item)
                for key, item in value.items()
                if key.lower() not in self.BLOCKED_KEYS
            }
        if isinstance(value, list):
            return [self.sanitize(item) for item in value]
        if isinstance(value, str):
            value = self.EMAIL.sub("[محجوب]", value)
            value = self.PHONE.sub("[محجوب]", value)
            return self.LABELED_SECRET.sub("[محجوب]", value)
        return value

    def searchable_female(self, profile: Any) -> dict:
        safe = {
            "age": profile.age,
            "governorate": profile.governorate,
            "height": profile.height,
            "education": profile.education,
            "education_field": getattr(profile, "education_field", None),
            "occupation": getattr(profile, "occupation", None),
            "marital_status": profile.marital_status,
            "children": profile.children,
            "hijab_status": profile.hijab_status,
            "religious_preference": getattr(profile, "religious_preference", None),
            "personality_traits": profile.personality_traits,
            "interests": profile.interests,
            "values": profile.values,
            # Free-form summaries are intentionally excluded: key-based scrubbing cannot prove
            # that a name or exact address was not embedded semantically in prose.
        }
        private_values = [
            getattr(profile, key, None)
            for key in (
                "first_name",
                "last_name",
                "first_name_private",
                "last_name_private",
                "full_name",
                "phone",
                "email",
                "exact_address",
                "private_notes",
            )
        ]

        def redact_known_values(value):
            if isinstance(value, dict):
                return {key: redact_known_values(item) for key, item in value.items()}
            if isinstance(value, list):
                return [redact_known_values(item) for item in value]
            if isinstance(value, str):
                for secret in private_values:
                    if isinstance(secret, str) and secret.strip():
                        value = re.sub(
                            re.escape(secret.strip()), "[محجوب]", value, flags=re.IGNORECASE
                        )
            return value

        return self.sanitize(redact_known_values(safe))

    def assert_no_pii(self, value: Any) -> None:
        if isinstance(value, dict):
            if any(key.lower() in self.BLOCKED_KEYS for key in value):
                raise ValueError("Private field detected in outbound payload")
            for item in value.values():
                self.assert_no_pii(item)
        elif isinstance(value, list):
            for item in value:
                self.assert_no_pii(item)
        rendered = str(value)
        if self.EMAIL.search(rendered) or self.PHONE.search(rendered):
            raise ValueError("PII detected in outbound payload")
