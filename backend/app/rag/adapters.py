import logging

from app.core.config import get_settings
from app.privacy.sanitizer import PrivacySanitizerService

logger = logging.getLogger(__name__)


class GeminiAdapter:
    """Optional Gemini boundary. Returns None when credentials/network are unavailable."""

    def __init__(self):
        self.settings = get_settings()

    async def extract(self, text: str, current_state: dict) -> dict | None:
        if not self.settings.gemini_api_key:
            return None
        safe_text = PrivacySanitizerService().sanitize(text)
        try:
            from google import genai

            client = genai.Client(api_key=self.settings.gemini_api_key)
            safe_state = PrivacySanitizerService().sanitize(current_state)
            prompt = (
                "Extract only facts explicitly stated by the user as compact JSON. "
                "Never invent profile data. Current state: "
                "Use male.preferred_contact_method for contact preferences with one of "
                "MATCHMAKER, FAMILIES, GUARDIAN_FIRST, VIRTUAL_WITH_GUARDIAN, "
                "IN_PERSON_WITH_MATCHMAKER, OTHER. Omit unrecognized answers; "
                "OTHER requires an explicit other preference. Current state: "
                + str(safe_state)
                + " Message: "
                + safe_text
            )
            response = await client.aio.models.generate_content(
                model=self.settings.gemini_chat_model, contents=prompt
            )
            import json

            return json.loads(response.text)
        except Exception as exc:  # external AI must never take the core API down
            logger.warning("Gemini unavailable: %s", exc)
            return None

    async def embed(self, text: str) -> list[float] | None:
        if not self.settings.gemini_api_key:
            return None
        try:
            from google import genai

            client = genai.Client(api_key=self.settings.gemini_api_key)
            response = await client.aio.models.embed_content(
                model=self.settings.gemini_embedding_model, contents=text
            )
            return list(response.embeddings[0].values)
        except Exception as exc:
            logger.warning("Gemini embedding unavailable: %s", exc)
            return None


class QdrantAdapter:
    def __init__(self):
        self.settings = get_settings()

    async def upsert(self, profile_id: str, vector: list[float] | None, payload: dict) -> bool:
        PrivacySanitizerService().assert_no_pii(payload)
        if not self.settings.qdrant_url or not vector:
            return False
        try:
            from qdrant_client import AsyncQdrantClient, models

            client = AsyncQdrantClient(
                url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key
            )
            collections = await client.get_collections()
            if self.settings.qdrant_collection not in {c.name for c in collections.collections}:
                await client.create_collection(
                    self.settings.qdrant_collection,
                    vectors_config=models.VectorParams(
                        size=len(vector), distance=models.Distance.COSINE
                    ),
                )
            await client.upsert(
                self.settings.qdrant_collection,
                points=[models.PointStruct(id=profile_id, vector=vector, payload=payload)],
            )
            await client.close()
            return True
        except Exception as exc:
            logger.warning("Qdrant unavailable: %s", exc)
            return False

    async def search(
        self,
        vector: list[float] | None,
        *,
        allowed_ids: list[str],
        limit: int,
    ) -> list[str] | None:
        """Return semantic candidates, or ``None`` when the optional index is unavailable.

        PostgreSQL supplies ``allowed_ids`` and remains the source of truth. Qdrant can only
        reorder/filter that already-authorized candidate set; payload data is never trusted.
        """
        if not self.settings.qdrant_url or not vector or not allowed_ids:
            return None
        client = None
        try:
            from qdrant_client import AsyncQdrantClient, models

            client = AsyncQdrantClient(
                url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key
            )
            result = await client.query_points(
                collection_name=self.settings.qdrant_collection,
                query=vector,
                query_filter=models.Filter(
                    must=[models.HasIdCondition(has_id=allowed_ids)]
                ),
                limit=max(1, limit),
                with_payload=False,
                with_vectors=False,
            )
            return [str(point.id) for point in result.points]
        except Exception as exc:
            logger.warning("Qdrant search unavailable: %s", exc)
            return None
        finally:
            if client is not None:
                await client.close()

    async def delete(self, profile_id: str) -> bool:
        if not self.settings.qdrant_url:
            return False
        try:
            from qdrant_client import AsyncQdrantClient, models

            client = AsyncQdrantClient(
                url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key
            )
            await client.delete(
                self.settings.qdrant_collection,
                points_selector=models.PointIdsList(points=[profile_id]),
            )
            await client.close()
            return True
        except Exception as exc:
            logger.warning("Qdrant deletion unavailable: %s", exc)
            return False
