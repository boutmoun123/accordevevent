import re
from copy import deepcopy
from typing import Any, ClassVar

from pydantic import TypeAdapter, ValidationError

from app.privacy.sanitizer import PrivacySanitizerService
from app.rag.adapters import GeminiAdapter
from app.schemas.characteristics import (
    HijabCategory,
    MaritalCategory,
    PreferredContactMethod,
    normalize_arabic,
)
from app.schemas.domain import DesiredPartnerPreferences, MaleCharacteristics


class ConversationAIService:
    """Progressive deterministic intake, optionally assisted by Gemini extraction."""

    GOVERNORATES: ClassVar[dict[str, str]] = {
        "دمشق": "DAMASCUS",
        "ريف دمشق": "RIF_DIMASHQ",
        "حلب": "ALEPPO",
        "حمص": "HOMS",
        "حماة": "HAMA",
        "اللاذقية": "LATTAKIA",
        "طرطوس": "TARTOUS",
        "السويداء": "AS_SUWAYDA",
        "درعا": "DARAA",
        "القنيطرة": "QUNEITRA",
        "إدلب": "IDLIB",
        "دير الزور": "DEIR_EZ_ZOR",
        "الرقة": "AR_RAQQAH",
        "الحسكة": "AL_HASAKAH",
    }
    GOVERNORATE_ALIASES: ClassVar[dict[str, str]] = {
        normalize_arabic(key): value for key, value in GOVERNORATES.items()
    }
    GOVERNORATE_ALIASES.update(
        {
            "ريف دمشق": "RIF_DIMASHQ",
            "ريف دمش": "RIF_DIMASHQ",
            "دمشق": "DAMASCUS",
            "الشام": "DAMASCUS",
            "ط¯ظ…ط´ظ‚": "DAMASCUS",
        }
    )

    MALE_QUESTIONS: ClassVar[list[dict[str, Any]]] = [
        {"field": "age", "question": "كم عمرك؟", "hint": "اكتب العمر بالأرقام، مثل: 31.", "kind": "number", "minimum": 18, "maximum": 90},
        {"field": "governorate", "question": "من أي محافظة أنت؟", "hint": "مثال: دمشق أو ريف دمشق.", "kind": "governorate"},
        {"field": "city", "question": "ما المدينة التي تقيم فيها؟", "hint": "اكتب المدينة أو المنطقة باختصار.", "kind": "text"},
        {"field": "marital_status", "question": "ما حالتك الاجتماعية؟", "hint": "أعزب، منفصل، أرمل، أو متزوج.", "kind": "text"},
        {"field": "height", "question": "كم طولك بالسنتمتر؟", "hint": "مثال: 175.", "kind": "number", "minimum": 120, "maximum": 230},
        {"field": "education", "question": "ما مستواك التعليمي؟", "hint": "مثال: ثانوي، معهد، جامعي.", "kind": "text"},
        {"field": "education_field", "question": "ما اختصاصك الدراسي؟", "hint": "يمكنك قول: تخطي.", "kind": "text", "optional": True},
        {"field": "occupation", "question": "ما مجال عملك؟", "hint": "مثال: موظف، عمل حر، لا أعمل حالياً.", "kind": "text"},
        {"field": "employment_status", "question": "ما وضعك المهني حالياً؟", "hint": "اكتب وصفاً مختصراً.", "kind": "text"},
        {"field": "children", "question": "هل لديك أطفال؟", "hint": "نعم أو لا.", "kind": "boolean"},
        {"field": "values", "question": "ما أهم القيم بالنسبة لك؟", "hint": "افصل بينها بفواصل أو واو.", "kind": "list"},
        {"field": "personality_traits", "question": "كيف تصف شخصيتك باختصار؟", "hint": "مثال: هادئ، مسؤول، اجتماعي.", "kind": "list"},
        {"field": "preferred_contact_method", "question": "ما طريقة التواصل التي تفضلها؟", "hint": "مثال: التواصل مع ولي الأمر أولاً.", "kind": "text"},
    ]
    DESIRED_QUESTIONS: ClassVar[list[dict[str, Any]]] = [
        {"field": "age_range", "question": "ما المجال العمري المناسب؟", "hint": "مثال: بدي عمرها بين 24 و29.", "kind": "range", "target": ("age_min", "age_max"), "minimum": 18, "maximum": 90},
        {"field": "governorates", "question": "ما المحافظات المناسبة؟", "hint": "مثال: دمشق أو ريف دمشق، أو قل لا يهم.", "kind": "governorates", "optional": True},
        {"field": "height_range", "question": "هل لديك مجال طول مفضل؟", "hint": "مثال: من 155 إلى 175، أو تخطي.", "kind": "range", "target": ("height_min", "height_max"), "minimum": 120, "maximum": 230, "optional": True},
        {"field": "education", "question": "هل لديك تفضيل للمستوى التعليمي؟", "hint": "مثال: جامعية، أو لا يهم.", "kind": "text", "optional": True},
        {"field": "occupation", "question": "هل مجال العمل معيار مهم؟", "hint": "اذكره أو قل لا يهم.", "kind": "text", "optional": True},
        {"field": "marital_status", "question": "ما الحالة الاجتماعية المقبولة؟", "hint": "مثال: عزباء، منفصلة، أو لا يهم.", "kind": "text", "optional": True},
        {"field": "children", "question": "هل تقبل أن يكون لديها أطفال؟", "hint": "نعم، لا، أو لا يهم.", "kind": "boolean", "optional": True},
        {"field": "hijab_status", "question": "هل لديك تفضيل متعلق بالحجاب؟", "hint": "مثال: محجبة، غير محجبة، أو لا يهم.", "kind": "text", "optional": True},
        {"field": "religious_preference", "question": "هل الانتماء الديني معيار مهم؟", "hint": "اكتب تفضيلك أو قل لا يهم.", "kind": "text", "optional": True},
        {"field": "values", "question": "ما القيم الأهم في شريكة حياتك؟", "hint": "افصل بينها بفواصل أو واو.", "kind": "list"},
        {"field": "personality_traits", "question": "ما الصفات الشخصية التي تبحث عنها؟", "hint": "مثال: هادئة، مسؤولة، اجتماعية.", "kind": "list"},
        {"field": "other_criteria", "question": "هل توجد معايير أخرى؟", "hint": "يمكنك قول لا يوجد.", "kind": "text", "optional": True},
    ]
    BLOCKED_REQUEST_WORDS: ClassVar[tuple[str, ...]] = (
        "اسماء",
        "أسماء",
        "اسمها",
        "رقمها",
        "صورتها",
        "صورهن",
        "هاتفها",
        "عنوانها",
    )
    SKIP_WORDS: ClassVar[set[str]] = {
        "تخطي",
        "لا يهم",
        "ما بيفرق معي",
        "لا فرق",
        "بدون تفضيل",
        "لا يوجد",
        "طھط®ط·ظٹ",
        "ظ„ط§ ظٹظ‡ظ…",
        "ظ„ط§ ظٹظˆط¬ط¯",
    }
    CONTACT_CHOICES: ClassVar[list[str]] = [
        "عن طريق الخطابة",
        "بين الأهل",
        "التواصل مع ولي الأمر أولاً",
        "لقاء افتراضي بحضور ولي الأمر",
        "لقاء حضوري بإشراف الخطابة",
    ]

    def __init__(self):
        self.gemini = GeminiAdapter()

    async def process(self, message: str, state: dict, gender: str) -> tuple[dict, str]:
        if gender == "FEMALE":
            return state, "للحفاظ على الخصوصية، يتم تسجيل ملفات الفتيات من خلال الخطابات الموثوقات."

        if any(normalize_arabic(word) in normalize_arabic(message) for word in self.BLOCKED_REQUEST_WORDS):
            return state, "حفاظاً على الخصوصية لا تعرض المنصة بيانات الفتيات الشخصية."

        result = self._normalized_state(state)
        current = self.next_question(result)

        extracted = await self.gemini.extract(message, result)
        if extracted:
            result = self._merge(result, extracted)
        result = self._offline_extract(message, result)

        if current and not self._is_answered(result, current):
            self._apply_expected_answer(message, result, current)

        next_item = self.next_question(result)
        result["complete"] = next_item is None
        if result["complete"]:
            return result, "اكتملت المعلومات الأساسية. راجع إجاباتك ثم أنشئ طلب التوفيق."
        if current and next_item == current:
            if current[1]["field"] == "preferred_contact_method":
                return result, "اختر طريقة التواصل الأقرب لك:\n\n- " + "\n- ".join(self.CONTACT_CHOICES)
            return result, f"أحتاج توضيحاً أكثر. {next_item[1]['question']}"
        if next_item[0] == "desired_female" and current and current[0] == "male":
            return result, "شكراً، اكتملت معلوماتك الأساسية. الآن ننتقل لمواصفات شريكة الحياة. " + next_item[1]["question"]
        return result, next_item[1]["question"]

    @classmethod
    def next_question(cls, state: dict) -> tuple[str, dict[str, Any]] | None:
        for section, questions in (("male", cls.MALE_QUESTIONS), ("desired_female", cls.DESIRED_QUESTIONS)):
            for item in questions:
                if not cls._is_answered(state, (section, item)):
                    return section, item
        return None

    @classmethod
    def is_complete(cls, state: dict) -> bool:
        return cls.next_question(state) is None

    @classmethod
    def quick_replies(cls, state: dict) -> list[str]:
        item = cls.next_question(state)
        if not item:
            return []
        spec = item[1]
        if spec["field"] == "preferred_contact_method":
            return cls.CONTACT_CHOICES.copy()
        if spec["kind"] == "boolean":
            return ["نعم", "لا"]
        if spec.get("optional"):
            return ["لا يهم", "تخطي"]
        return []

    @staticmethod
    def _normalized_state(state: dict) -> dict:
        value = deepcopy(state) if isinstance(state, dict) else {}
        value["male"] = dict(value.get("male") or {})
        value["desired_female"] = dict(value.get("desired_female") or {})
        value["answered"] = list(value.get("answered") or [])
        male = value["male"]
        contact = male.get("preferred_contact_method", male.get("preferred_contact"))
        if contact is not None:
            try:
                male["preferred_contact_method"] = TypeAdapter(PreferredContactMethod).dump_python(
                    TypeAdapter(PreferredContactMethod).validate_python(contact),
                    mode="json",
                )
                value["answered"] = [
                    item for item in value["answered"] if item != "male.preferred_contact"
                ]
                if "male.preferred_contact_method" not in value["answered"]:
                    value["answered"].append("male.preferred_contact_method")
            except ValidationError:
                male.pop("preferred_contact_method", None)
        value.pop("complete", None)
        return value

    @classmethod
    def _is_answered(cls, state: dict, current: tuple[str, dict[str, Any]]) -> bool:
        section, spec = current
        if f"{section}.{spec['field']}" in state.get("answered", []):
            return True
        target = spec.get("target")
        if target:
            return all(key in state.get(section, {}) for key in target)
        return spec["field"] in state.get(section, {})

    @classmethod
    def _mark_answered(cls, state: dict, section: str, field: str) -> None:
        marker = f"{section}.{field}"
        if marker not in state["answered"]:
            state["answered"].append(marker)

    @classmethod
    def _validate_section(cls, section: str, values: dict) -> bool:
        model = MaleCharacteristics if section == "male" else DesiredPartnerPreferences
        try:
            model.model_validate(values)
            return True
        except ValidationError as exc:
            return all(error["type"] == "missing" for error in exc.errors())

    @classmethod
    def _set_value(cls, state: dict, section: str, field: str, value: Any) -> None:
        proposed = {**state[section], field: value}
        if cls._validate_section(section, proposed):
            state[section] = proposed
            cls._mark_answered(state, section, field)

    @classmethod
    def _merge(cls, current: dict, patch: dict) -> dict:
        result = cls._normalized_state(current)
        if not isinstance(patch, dict):
            return result
        allowed = {
            "male": {item["field"] for item in cls.MALE_QUESTIONS},
            "desired_female": {key for item in cls.DESIRED_QUESTIONS for key in item.get("target", (item["field"],))},
        }
        for section in ("male", "desired_female"):
            values = patch.get(section)
            if not isinstance(values, dict):
                continue
            for key, value in values.items():
                if section == "male" and key == "preferred_contact":
                    key = "preferred_contact_method"
                if key not in allowed[section] or value in (None, "", []):
                    continue
                model = MaleCharacteristics if section == "male" else DesiredPartnerPreferences
                try:
                    field = model.model_fields[key]
                    adapter = TypeAdapter(field.rebuild_annotation())
                    canonical = adapter.dump_python(adapter.validate_python(PrivacySanitizerService().sanitize(value)), mode="json")
                    cls._set_value(result, section, key, canonical)
                except ValidationError:
                    continue
            questions = cls.MALE_QUESTIONS if section == "male" else cls.DESIRED_QUESTIONS
            for item in questions:
                targets = item.get("target", (item["field"],))
                if all(target in result[section] for target in targets):
                    cls._mark_answered(result, section, item["field"])
        return result

    @classmethod
    def _numbers(cls, message: str) -> list[int]:
        return [int(number) for number in re.findall(r"(?<!\d)\d{2,3}(?!\d)", message)]

    @classmethod
    def _governorates_from_text(cls, message: str) -> list[str]:
        text = normalize_arabic(message)
        found: list[str] = []
        for alias, code in sorted(cls.GOVERNORATE_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
            if alias in text and code not in found:
                found.append(code)
        return found

    @classmethod
    def _is_skip(cls, message: str) -> bool:
        text = normalize_arabic(message)
        return any(normalize_arabic(word) == text or normalize_arabic(word) in text for word in cls.SKIP_WORDS)

    @classmethod
    def _offline_extract(cls, message: str, state: dict) -> dict:
        result = cls._normalized_state(state)
        text = normalize_arabic(message)
        numbers = cls._numbers(message)
        if "عمرها" in text or "العمر" in text or "بين" in text:
            ages = [value for value in numbers if 18 <= value <= 90]
            if len(ages) >= 2:
                low, high = sorted(ages[:2])
                cls._set_value(result, "desired_female", "age_min", low)
                cls._set_value(result, "desired_female", "age_max", high)
                cls._mark_answered(result, "desired_female", "age_range")
        elif re.search(r"(عمري|انا)\D*(\d{2})", text) and numbers:
            age = numbers[0]
            if 18 <= age <= 90:
                cls._set_value(result, "male", "age", age)

        if "طولي" in text or "الطول" in text:
            heights = [value for value in numbers if 120 <= value <= 230]
            if len(heights) == 1:
                cls._set_value(result, "male", "height", heights[0])
            elif len(heights) >= 2:
                low, high = sorted(heights[:2])
                cls._set_value(result, "desired_female", "height_min", low)
                cls._set_value(result, "desired_female", "height_max", high)
                cls._mark_answered(result, "desired_female", "height_range")

        governorates = cls._governorates_from_text(message)
        if governorates:
            desired_markers = ("بدي", "افضل", "مناسبة", "زوجة", "شريكة", "او", "أو")
            if any(marker in message for marker in desired_markers) or len(governorates) > 1:
                result["desired_female"]["governorates"] = governorates
                cls._mark_answered(result, "desired_female", "governorates")
            else:
                cls._set_value(result, "male", "governorate", governorates[0])

        if cls._is_skip(message):
            current = cls.next_question(result)
            if current and current[1].get("optional"):
                cls._mark_answered(result, current[0], current[1]["field"])

        desired_context = any(token in text for token in ("بدي", "افضل", "يفضل", "زوجة", "شريكة", "فتاة", "بنت"))
        if "محجبة" in text and desired_context:
            cls._set_value(result, "desired_female", "hijab_status", "HIJAB")
            cls._mark_answered(result, "desired_female", "hijab_status")
        if ("غير محجبة" in text or "بدون حجاب" in text) and desired_context:
            cls._set_value(result, "desired_female", "hijab_status", "NONE")
            cls._mark_answered(result, "desired_female", "hijab_status")
        if ("جامعي" in text or "جامعية" in text) and desired_context:
            cls._set_value(result, "desired_female", "education", "جامعية")
        return result

    @classmethod
    def _apply_expected_answer(cls, message: str, state: dict, current: tuple[str, dict[str, Any]]) -> None:
        section, spec = current
        text = PrivacySanitizerService().sanitize(message).strip()
        normalized = normalize_arabic(text)
        if cls._is_skip(text) and spec.get("optional"):
            cls._mark_answered(state, section, spec["field"])
            return

        kind = spec["kind"]
        if kind == "number":
            values = [value for value in cls._numbers(text) if spec["minimum"] <= value <= spec["maximum"]]
            if len(values) == 1:
                cls._set_value(state, section, spec["field"], values[0])
            return
        if kind == "range":
            values = [value for value in cls._numbers(text) if spec["minimum"] <= value <= spec["maximum"]]
            if len(values) >= 2:
                low, high = sorted(values[:2])
                first, second = spec["target"]
                cls._set_value(state, section, first, low)
                cls._set_value(state, section, second, high)
                cls._mark_answered(state, section, spec["field"])
            return
        if kind in {"governorate", "governorates"}:
            values = cls._governorates_from_text(text)
            if values:
                cls._set_value(state, section, spec["field"], values[0] if kind == "governorate" else values)
            return
        if kind == "boolean":
            if cls._is_skip(text) and spec.get("optional"):
                cls._mark_answered(state, section, spec["field"])
                return
            negative = any(token in normalized for token in ("لا", "ليس", "ما عندي", "بدون"))
            positive = any(token in normalized for token in ("نعم", "اجل", "عندي", "يوجد", "اقبل"))
            if negative or positive:
                cls._set_value(state, section, spec["field"], not negative)
            return
        if kind == "list":
            values = [item.strip(" .") for item in re.split(r"[,،؛;]|\s+و\s+", text) if item.strip(" .")]
            if values:
                cls._set_value(state, section, spec["field"], values[:12])
            return
        if kind == "text" and text:
            categories = {
                "marital_status": MaritalCategory,
                "hijab_status": HijabCategory,
                "preferred_contact_method": PreferredContactMethod,
            }
            value: Any = text[:100]
            if spec["field"] in categories:
                try:
                    value = TypeAdapter(categories[spec["field"]]).dump_python(
                        TypeAdapter(categories[spec["field"]]).validate_python(text),
                        mode="json",
                    )
                except ValidationError:
                    return
            cls._set_value(state, section, spec["field"], value)
