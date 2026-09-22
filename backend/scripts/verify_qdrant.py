"""Exercise real PostgreSQL and Qdrant with a controlled embedding fixture."""
import asyncio
import json
from uuid import uuid4

from qdrant_client import AsyncQdrantClient
from sqlalchemy import select

from app.core.config import get_settings
from app.database.session import SessionLocal
from app.models import MatchCandidate, Matchmaker, Role, User
from app.rag.adapters import GeminiAdapter
from app.schemas.domain import FemaleProfileIn, MaleRequestIn
from app.services.domain import DomainService


async def main():
    cfg = get_settings()
    assert cfg.database_url.rsplit("/", 1)[-1].startswith("farah_verify_")
    cfg.qdrant_collection = "farah_verify_" + uuid4().hex

    async def controlled_embedding(self, text):
        return [1.0, 0.0, 0.5]

    GeminiAdapter.embed = controlled_embedding
    client = AsyncQdrantClient(url=cfg.qdrant_url)
    try:
        async with SessionLocal() as db:
            mm = await db.scalar(select(Matchmaker))
            user = User(first_name="Review", phone=uuid4().hex[:20], password_hash="unused", role=Role.MALE_USER)
            db.add(user)
            await db.commit()
            service = DomainService(db)
            profile = await service.create_female_profile(mm.id, FemaleProfileIn(
                first_name="PrivateSentinel", last_name="PrivateSurname",
                phone="+963988776655", email="private-sentinel@example.com",
                exact_address="Private Exact Street", private_notes="Private Notes Sentinel",
                age=26, governorate="Damascus", status="ACTIVE",
                desired_male={"age_min": 28, "age_max": 35},
            ), mm.user_id)
            records = await client.retrieve(cfg.qdrant_collection, ids=[profile.id], with_payload=True)
            assert len(records) == 1
            rendered = json.dumps(records[0].payload)
            for secret in ["PrivateSentinel", "PrivateSurname", "+963988776655", "private-sentinel@example.com", "Private Exact Street", "Private Notes Sentinel"]:
                assert secret not in rendered
            request, _ = await service.create_or_get_request(user, MaleRequestIn(
                male_characteristics={"age": 31, "governorate": "Damascus"},
                desired_female_characteristics={"age_min": 25, "age_max": 27, "governorates": ["Damascus"]},
            ))
            result = await service.run_matching(request)
            assert result["count"] == 1
            candidate = await db.scalar(select(MatchCandidate).where(MatchCandidate.male_request_id == request.id))
            assert candidate.female_profile_id == profile.id
            assert candidate.mutual_score == 100
            print(json.dumps({"postgres_qdrant_integration": "passed", "matching_count": 1, "privacy": "passed", "embeddings": "controlled fixture; no external Gemini call"}))
    finally:
        if await client.collection_exists(cfg.qdrant_collection):
            await client.delete_collection(cfg.qdrant_collection)
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
