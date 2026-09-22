"""Arabic contact answers must persist canonically and advance both intake paths."""

from unittest.mock import AsyncMock

import pytest
from pydantic import TypeAdapter, ValidationError

from app.rag.service import ConversationAIService
from app.schemas.characteristics import PreferredContactMethod


CONTACT_ANSWERS = [
    ("عن طريق الخطابة", "MATCHMAKER"),
    ("عن طريق الخطّابة", "MATCHMAKER"),
    ("الخطابة", "MATCHMAKER"),
    ("الخطّابة", "MATCHMAKER"),
    ("يتواصل أهلي مع أهلها", "FAMILIES"),
    ("أهلي مع أهلها", "FAMILIES"),
    ("الأهل مع الأهل", "FAMILIES"),
    ("العائلتين", "FAMILIES"),
    ("بين الأهل", "FAMILIES"),
    ("ولي الأمر", "GUARDIAN_FIRST"),
    ("التواصل مع ولي الأمر", "GUARDIAN_FIRST"),
    ("يتواصل مع أهلها أولاً", "GUARDIAN_FIRST"),
    ("لقاء افتراضي بحضور ولي الأمر", "VIRTUAL_WITH_GUARDIAN"),
    ("افتراضي مع ولي الأمر", "VIRTUAL_WITH_GUARDIAN"),
    ("مكالمة بحضور ولي الأمر", "VIRTUAL_WITH_GUARDIAN"),
    ("لقاء حضوري بحضور الخطابة", "IN_PERSON_WITH_MATCHMAKER"),
    ("لقاء حضوري مع الخطابة", "IN_PERSON_WITH_MATCHMAKER"),
    ("لقاء حضوري بحضور الخطّابة", "IN_PERSON_WITH_MATCHMAKER"),
    ("لقاء حضوري بإشراف الخطّابة", "IN_PERSON_WITH_MATCHMAKER"),
    ("  لِقاء   إِفْتِراضي  مع وَليّ الأَمْر  ", "VIRTUAL_WITH_GUARDIAN"),
    ("أفضل أن يتم التواصل عن طريق الخطّابة", "MATCHMAKER"),
    ("طريقة أخرى", "OTHER"),
]


def contact_state():
    return {
        "male": {"age": 31, "governorate": "دمشق"},
        "desired_female": {},
        "answered": [f"male.{item['field']}" for item in ConversationAIService.MALE_QUESTIONS[:-1]],
    }


@pytest.mark.parametrize("answer,expected", CONTACT_ANSWERS)
@pytest.mark.parametrize("gemini", [False, True])
async def test_contact_answer_saved_and_question_advances(answer, expected, gemini):
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value=(
        {"male": {"preferred_contact_method": answer}} if gemini else None
    ))
    state, reply = await service.process(answer, contact_state(), "MALE")
    assert state["male"]["preferred_contact_method"] == expected
    assert "male.preferred_contact_method" in state["answered"]
    assert "المجال العمري" in reply
    assert "ما طريقة التواصل" not in reply
    service.gemini.extract = AsyncMock(return_value=None)
    state, reply = await service.process("24 إلى 30", state, "MALE")
    assert state["male"]["preferred_contact_method"] == expected
    assert state["desired_female"]["age_min"] == 24
    assert "ما طريقة التواصل" not in reply


@pytest.mark.parametrize("answer", ["لا أعرف", "موز", "", 12, ["MATCHMAKER"]])
def test_unknown_contact_is_not_silently_other(answer):
    with pytest.raises(ValidationError):
        TypeAdapter(PreferredContactMethod).validate_python(answer)


async def test_unknown_answer_shows_choices_then_recovers():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value={"male": {"preferred_contact_method": "unknown"}})
    state, reply = await service.process("لا أعرف", contact_state(), "MALE")
    assert "preferred_contact_method" not in state["male"]
    assert reply == "اختر طريقة التواصل الأقرب لك:\n\n- " + "\n- ".join(service.CONTACT_CHOICES)
    assert service.quick_replies(state) == service.CONTACT_CHOICES
    state, reply = await service.process("بين الأهل", state, "MALE")
    assert state["male"]["preferred_contact_method"] == "FAMILIES"
    assert "المجال العمري" in reply


async def test_legacy_session_and_gemini_key_are_supported():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value={"male": {"preferred_contact": "عن طريق الخطّابة"}})
    state, _ = await service.process("عن طريق الخطّابة", contact_state(), "MALE")
    assert state["male"]["preferred_contact_method"] == "MATCHMAKER"
    legacy = contact_state()
    legacy["male"]["preferred_contact"] = "MATCHMAKER"
    service.gemini.extract = AsyncMock(return_value=None)
    state, _ = await service.process("24 إلى 30", legacy, "MALE")
    assert state["desired_female"]["age_min"] == 24


def test_gemini_canonical_fields_are_saved_even_in_partial_sections():
    state = ConversationAIService._merge({}, {
        "male": {"marital_status": "أَعْزَب", "preferred_contact_method": "بين الأهل"},
        "desired_female": {"hijab_status": "مُحَجَّبة"},
    })
    assert state["male"]["marital_status"] == "SINGLE"
    assert state["male"]["preferred_contact_method"] == "FAMILIES"
    assert state["desired_female"]["hijab_status"] == "HIJAB"
