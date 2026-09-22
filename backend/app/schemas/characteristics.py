"""Canonical categorical contracts shared by intake, profiles, and matching."""

import re
import unicodedata
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BeforeValidator


def normalize_arabic(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = value.translate(str.maketrans("أإآٱى", "ااااي")).replace("ـ", "")
    return re.sub(r"\s+", " ", value).strip().casefold()


class ContactMethod(StrEnum):
    MATCHMAKER = "MATCHMAKER"
    FAMILIES = "FAMILIES"
    GUARDIAN_FIRST = "GUARDIAN_FIRST"
    VIRTUAL_WITH_GUARDIAN = "VIRTUAL_WITH_GUARDIAN"
    IN_PERSON_WITH_MATCHMAKER = "IN_PERSON_WITH_MATCHMAKER"
    OTHER = "OTHER"


def normalize_contact_method(value):
    if not isinstance(value, str):
        return value
    if value.strip().upper() in ContactMethod.__members__:
        return value.strip().upper()
    text = normalize_arabic(value)
    legacy = value
    if text in {"اخرى", "اخري", "طريقة اخرى", "طريقة اخري", "غير ذلك"}:
        return ContactMethod.OTHER
    if "ط£ط®" in legacy or "ط§ط®" in legacy:
        return ContactMethod.OTHER
    if "ط§ظپطھ" in legacy or "ظ…ظƒط§" in legacy:
        return ContactMethod.VIRTUAL_WITH_GUARDIAN
    if "ط­ط¶" in legacy and ("ط®ط·" in legacy or "ط®ط·ظ‘" in legacy):
        return ContactMethod.IN_PERSON_WITH_MATCHMAKER
    if "ظˆظ„ظٹ" in legacy:
        return ContactMethod.GUARDIAN_FIRST
    if "ط£ظ‡" in legacy or "ط§ظ„ط£ظ‡" in legacy or "ط¹ط§ط¦ظ„" in legacy:
        return ContactMethod.FAMILIES
    if "ط®ط·" in legacy:
        return ContactMethod.MATCHMAKER
    guardian = "ولي الامر" in text or "الولي" in text
    matchmaker = "خطابة" in text or "خطابه" in text
    if guardian and any(word in text for word in ("افتراضي", "مكالمة", "فيديو", "اونلاين")):
        return ContactMethod.VIRTUAL_WITH_GUARDIAN
    if matchmaker and any(word in text for word in ("حضوري", "حضوريا", "وجه لوجه")):
        return ContactMethod.IN_PERSON_WITH_MATCHMAKER
    if guardian or ("اهلها" in text and "اولا" in text):
        return ContactMethod.GUARDIAN_FIRST
    if any(word in text for word in ("العائلتين", "العيلتين", "بين الاهل", "الاهل مع الاهل")) or (
        "اهلي" in text and "اهلها" in text
    ):
        return ContactMethod.FAMILIES
    if matchmaker:
        return ContactMethod.MATCHMAKER
    return value


PreferredContactMethod = Annotated[ContactMethod, BeforeValidator(normalize_contact_method)]


def canonical_category(value):
    aliases = {
        "أعزب": "SINGLE",
        "اعزب": "SINGLE",
        "عزباء": "SINGLE",
        "ط£ط¹ط²ط¨": "SINGLE",
        "منفصل": "DIVORCED",
        "منفصلة": "DIVORCED",
        "مطلق": "DIVORCED",
        "مطلقة": "DIVORCED",
        "ظ…ظ†ظپطµظ„": "DIVORCED",
        "ظ…ظ†ظپطµظ„ط©": "DIVORCED",
        "أرمل": "WIDOWED",
        "ارمل": "WIDOWED",
        "أرملة": "WIDOWED",
        "ارملة": "WIDOWED",
        "متزوج": "MARRIED",
        "متزوجة": "MARRIED",
        "محجبة": "HIJAB",
        "حجاب": "HIJAB",
        "ظ…ط­ط¬ط¨ط©": "HIJAB",
        "منقبة": "NIQAB",
        "نقاب": "NIQAB",
        "غير محجبة": "NONE",
        "بدون حجاب": "NONE",
        "لا": "NONE",
        "هاتف": "PHONE",
        "الهاتف": "PHONE",
        "اتصال": "PHONE",
        "واتساب": "WHATSAPP",
        "واتس اب": "WHATSAPP",
        "بريد": "EMAIL",
        "البريد الإلكتروني": "EMAIL",
        "الخطابة": "MATCHMAKER",
        "الخاطبة": "MATCHMAKER",
        "أخرى": "OTHER",
        "اخرى": "OTHER",
    }
    if isinstance(value, str):
        normalized_aliases = {normalize_arabic(key): item for key, item in aliases.items()}
        return normalized_aliases.get(normalize_arabic(value), value.strip().upper())
    return value


MaritalCategory = Annotated[
    Literal["SINGLE", "DIVORCED", "WIDOWED", "MARRIED"], BeforeValidator(canonical_category)
]
HijabCategory = Annotated[
    Literal["HIJAB", "NIQAB", "NONE", "OTHER"], BeforeValidator(canonical_category)
]
MaleContactPreference = Annotated[
    Literal["PHONE", "WHATSAPP", "EMAIL", "MATCHMAKER", "OTHER"],
    BeforeValidator(canonical_category),
]
