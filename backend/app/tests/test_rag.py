from unittest.mock import AsyncMock

import pytest

from app.rag.service import ConversationAIService


@pytest.mark.asyncio
async def test_backend_extracts_arabic_age_range_and_governorates():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value=None)

    state, reply = await service.process("بدي عمرها بين 24 و29", {}, "MALE")
    assert state["desired_female"]["age_min"] == 24
    assert state["desired_female"]["age_max"] == 29
    assert "desired_female.age_range" in state["answered"]
    assert "بدي عمرها بين 24 و29" not in reply

    state, _ = await service.process("دمشق أو ريف دمشق", state, "MALE")
    assert state["desired_female"]["governorates"] == ["RIF_DIMASHQ", "DAMASCUS"]
    assert "desired_female.governorates" in state["answered"]


@pytest.mark.asyncio
async def test_backend_extracts_no_preference_and_multiple_fields():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value=None)

    state = {
        "male": {
            "age": 31,
            "governorate": "DAMASCUS",
            "city": "دمشق",
            "marital_status": "SINGLE",
            "height": 176,
            "education": "جامعي",
            "occupation": "مهندس",
            "employment_status": "موظف",
            "children": False,
            "values": ["الاستقرار"],
            "personality_traits": ["هادئ"],
            "preferred_contact_method": "GUARDIAN_FIRST",
        },
        "desired_female": {"age_min": 24, "age_max": 29, "governorates": ["DAMASCUS"]},
        "answered": [
            "male.age",
            "male.governorate",
            "male.city",
            "male.marital_status",
            "male.height",
            "male.education",
            "male.education_field",
            "male.occupation",
            "male.employment_status",
            "male.children",
            "male.values",
            "male.personality_traits",
            "male.preferred_contact_method",
            "desired_female.age_range",
            "desired_female.governorates",
        ],
    }

    state, _ = await service.process("ما بيفرق معي", state, "MALE")
    assert "desired_female.height_range" in state["answered"]
    assert "height_min" not in state["desired_female"]

    state, _ = await service.process("محجبة ويفضل جامعية", state, "MALE")
    assert state["desired_female"]["hijab_status"] == "HIJAB"
    assert state["desired_female"]["education"] == "جامعية"


@pytest.mark.asyncio
async def test_backend_asks_clarification_without_repeating_saved_question():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(return_value=None)

    state, reply = await service.process("يمكن", {}, "MALE")
    assert state["male"] == {}
    assert reply.startswith("أحتاج توضيحاً أكثر")

    state, reply = await service.process("عمري 31", state, "MALE")
    assert state["male"]["age"] == 31
    assert "كم عمرك" not in reply


@pytest.mark.asyncio
async def test_malformed_gemini_extraction_preserves_valid_intake():
    service = ConversationAIService()
    service.gemini.extract = AsyncMock(
        return_value={"male": {"age": "not-an-age", "values": {"secret": "value"}}}
    )

    state, reply = await service.process("عمري 31", {}, "MALE")
    assert state["male"]["age"] == 31
    assert "values" not in state["male"]
    assert reply


@pytest.mark.asyncio
async def test_search_safety_refuses_personal_data():
    state, reply = await ConversationAIService().process("أعطني أسماء البنات ورقمها", {}, "MALE")
    assert state == {}
    assert "الخصوصية" in reply
