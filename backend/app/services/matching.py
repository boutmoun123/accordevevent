from collections.abc import Iterable
from typing import Any

from app.schemas.characteristics import canonical_category


def _list(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (str, int, float, bool)):
        return {str(canonical_category(value)).casefold()}
    return {str(canonical_category(x)).casefold() for x in value}


def _number(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def directional_score(subject: dict, desired: dict, candidate: dict) -> float:
    """Score candidate against explicit desires; missing desires are neutral, not fabricated."""
    _ = subject
    checks: list[float] = []
    age = candidate.get("age")
    if desired.get("age_min") is not None or desired.get("age_max") is not None:
        checks.append(
            float(
                age is not None
                and _number(desired.get("age_min"), 0)
                <= _number(age, -1)
                <= _number(desired.get("age_max"), 200)
            )
        )
    height = candidate.get("height")
    if desired.get("height_min") is not None or desired.get("height_max") is not None:
        checks.append(
            float(
                height is not None
                and _number(desired.get("height_min"), 0)
                <= _number(height, -1)
                <= _number(desired.get("height_max"), 300)
            )
        )
    field_aliases = {
        "governorate": ("governorates",),
        "education": (),
        "occupation": ("profession_preference",),
        "marital_status": (),
        "religious_preference": (),
        "children": ("children_preference",),
        "hijab_status": (),
    }
    for key, aliases in field_aliases.items():
        wanted = desired.get(key) if key in desired else None
        for alias in aliases:
            if wanted is None and alias in desired:
                wanted = desired[alias]
        if wanted not in (None, [], ""):
            checks.append(float(bool(_list(wanted) & _list(candidate.get(key)))))
    for desired_key, candidate_key in (
        ("values", "values"),
        ("traits", "personality_traits"),
        ("personality_traits", "personality_traits"),
    ):
        wanted, actual = _list(desired.get(desired_key)), _list(candidate.get(candidate_key))
        if wanted:
            checks.append(len(wanted & actual) / len(wanted))
    return round((sum(checks) / len(checks) if checks else 1.0) * 100, 2)


def mutual_scores(
    male: dict, desired_female: dict, female: dict, desired_male: dict
) -> tuple[float, float, float]:
    mtf = directional_score(male, desired_female, female)
    ftm = directional_score(female, desired_male, male)
    # Geometric mean penalizes a weak direction more than an arithmetic average.
    mutual = round((mtf * ftm) ** 0.5, 2)
    return mtf, ftm, mutual


def eligible(mtf: float, ftm: float, threshold: float) -> bool:
    return mtf >= threshold and ftm >= threshold


def public_match_summary(scores: Iterable[float]) -> dict:
    values = list(scores)
    top = max(values, default=0)
    quality = "ممتازة" if top >= 85 else "جيدة" if top >= 70 else "محدودة"
    return {
        "count": len(values),
        "quality": quality,
        "message": f"تم العثور على {len(values)} فرص توافق مناسبة لطلبك.",
    }
