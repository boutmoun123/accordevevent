from types import SimpleNamespace

from app.privacy.sanitizer import PrivacySanitizerService
from app.services.matching import eligible, mutual_scores, public_match_summary


def test_privacy_sanitizer_removes_all_pii_before_qdrant_or_male_output():
    raw = {
        "first_name_private": "PrivateFirst",
        "last_name_private": "PrivateLast",
        "full_name": "سارة أحمد",
        "phone": "+963 999 123 456",
        "email": "sara@example.com",
        "exact_address": "دمشق شارع الاختبار",
        "private_notes": "خاص",
        "nested": {"identifier": "ABC", "bio": "راسلني test@example.com"},
    }
    safe = PrivacySanitizerService().sanitize(raw)
    rendered = str(safe)
    for secret in (
        "PrivateFirst",
        "PrivateLast",
        "سارة أحمد",
        "+963 999 123 456",
        "sara@example.com",
        "شارع الاختبار",
        "خاص",
        "ABC",
        "test@example.com",
    ):
        assert secret not in rendered


def test_qdrant_projection_excludes_free_text_and_private_fields():
    profile = SimpleNamespace(
        age=26,
        governorate="دمشق",
        height=165,
        education="جامعية",
        marital_status="SINGLE",
        children=False,
        hijab_status="HIJAB",
        personality_traits=["هادئة"],
        interests=["قراءة"],
        values=["العائلة"],
        public_summary="اسمي سارة وأسكن في شارع سري",
        phone="+963999999999",
        first_name="SecretName",
        exact_address="SecretAddress",
        education_field="SecretName SecretAddress",
    )
    safe = PrivacySanitizerService().searchable_female(profile)
    assert "public_summary" not in safe
    assert "phone" not in safe
    assert "SecretName" not in str(safe)
    assert "SecretAddress" not in str(safe)


def test_mutual_matching_requires_both_directions():
    male = {"age": 32, "governorate": "دمشق", "values": ["العائلة", "الاحترام"]}
    desired_female = {"age_min": 24, "age_max": 30, "governorates": ["دمشق"], "values": ["العائلة"]}
    female = {"age": 27, "governorate": "دمشق", "values": ["العائلة"]}
    desired_male = {"age_min": 30, "age_max": 35, "governorates": ["حلب"]}
    mtf, ftm, mutual = mutual_scores(male, desired_female, female, desired_male)
    assert mtf == 100
    assert ftm < 70
    assert not eligible(mtf, ftm, 70)
    summary = public_match_summary([mutual])
    assert set(summary) == {"count", "quality", "message"}
