import json
from datetime import datetime, timezone
from random import randint

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.identifiers import request_code_digest
from app.core.errors import AppError, NotFoundError
from app.models import (
    ContactAppointment,
    FemaleLead,
    FemaleProfile,
    FemaleProfileStatus,
    MaleRequest,
    MaleRequestAccessCode,
    MatchCandidate,
    MatchCase,
    MatchCaseHistory,
    MatchCaseStatus,
    Matchmaker,
    Payment,
    PaymentStatus,
    SuccessFeeStatus,
    SystemSetting,
    User,
    UserStatus,
    VerificationStatus,
)
from app.notifications import NotificationService
from app.privacy.sanitizer import PrivacySanitizerService
from app.rag.adapters import GeminiAdapter, QdrantAdapter
from app.schemas.domain import (
    FemaleLeadIn,
    FemaleProfileIn,
    FemaleProfileUpdate,
    MaleRequestIn,
    MaleRequestUpdate,
)
from app.services.audit import audit
from app.services.matching import eligible, mutual_scores, public_match_summary
from app.services.payment import ensure_contact_allowed
from app.services.state_machine import ensure_transition


class DomainService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def default_matchmaker_id(self) -> str | None:
        candidate = await self.setting("default_matchmaker_assignment", None)
        if not candidate:
            return None
        return await self.db.scalar(
            select(Matchmaker.id)
            .join(User, User.id == Matchmaker.user_id)
            .where(
                Matchmaker.id == candidate,
                Matchmaker.verification_status == VerificationStatus.VERIFIED,
                User.status == UserStatus.ACTIVE,
            )
        )

    async def notify_matchmakers(
        self,
        matchmaker_id: str | None,
        kind: str,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        stmt = (
            select(Matchmaker.user_id)
            .join(User, User.id == Matchmaker.user_id)
            .where(
                Matchmaker.verification_status == VerificationStatus.VERIFIED,
                User.status == UserStatus.ACTIVE,
            )
        )
        if matchmaker_id:
            stmt = stmt.where(Matchmaker.id == matchmaker_id)
        recipients = list(await self.db.scalars(stmt))
        service = NotificationService(self.db)
        for user_id in recipients:
            await service.create(user_id, kind, title, body, data)

    async def create_lead(self, data: FemaleLeadIn) -> FemaleLead:
        from app.services.availability import LOCAL_ZONE, reserve_slot

        try:
            slot = await reserve_slot(self.db, data.matchmaker_id, data.scheduled_at)
            if not bool(await self.setting("female_leads_enabled", True)):
                raise AppError("FEMALE_LEADS_DISABLED", "استقبال طلبات التواصل متوقف مؤقتًا.", 503)
            lead = FemaleLead(
                **data.model_dump(exclude={"matchmaker_id", "scheduled_at"}),
                assigned_matchmaker_id=data.matchmaker_id,
            )
            self.db.add(lead)
            await self.db.flush()
            start = datetime.fromisoformat(slot["scheduled_at"]).astimezone(LOCAL_ZONE)
            end = datetime.fromisoformat(slot["ends_at"]).astimezone(LOCAL_ZONE)
            self.db.add(
                ContactAppointment(
                    matchmaker_id=data.matchmaker_id,
                    female_lead_id=lead.id,
                    appointment_date=start.date(),
                    start_time=start.time(),
                    end_time=end.time(),
                    status="BOOKED",
                )
            )
            await self.db.flush()
            await self.notify_matchmakers(
                data.matchmaker_id,
                "female_lead_created",
                "طلب تواصل جديد",
                "وصل طلب تواصل خاص من فتاة ويحتاج إلى متابعة.",
                {"lead_id": lead.id},
            )
            await self.db.commit()
            await self.db.refresh(lead)
            return lead
        except Exception:
            await self.db.rollback()
            raise

    async def get_active_request(self, user_id: str) -> MaleRequest | None:
        return await self.db.scalar(
            select(MaleRequest).where(
                MaleRequest.male_user_id == user_id, MaleRequest.is_active.is_(True)
            )
        )

    async def create_or_get_request(
        self, user: User, data: MaleRequestIn
    ) -> tuple[MaleRequest, bool]:
        user_id = user.id
        existing = await self.get_active_request(user_id)
        if existing:
            return existing, False
        payload = data.model_dump(mode="json")
        request = MaleRequest(
            male_user_id=user.id,
            male_characteristics=payload["male_characteristics"],
            desired_female_characteristics=payload["desired_female_characteristics"],
            assigned_matchmaker_id=await self.default_matchmaker_id(),
        )
        self.db.add(request)
        try:
            await self.db.flush()
            self.db.add(
                MaleRequestAccessCode(
                    male_request_id=request.id,
                    code_digest=request_code_digest(request.request_code),
                    is_primary=True,
                )
            )
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            existing = await self.get_active_request(user_id)
            if existing:
                return existing, False
            raise AppError(
                "REQUEST_CODE_CONFLICT",
                "طھط¹ط°ط± طھظˆظ„ظٹط¯ ط±ظ‚ظ… ط·ظ„ط¨ ظپط±ظٹط¯. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.",
                409,
            ) from exc
        await audit(
            self.db,
            actor_id=user.id,
            action="male_request.created",
            entity_type="male_request",
            entity_id=request.id,
            new_values={
                "request_code": request.request_code,
                "sections": ["male_characteristics", "desired_female_characteristics"],
            },
        )
        await self.notify_matchmakers(
            request.assigned_matchmaker_id,
            "new_male_request",
            "ط·ظ„ط¨ ط´ط§ط¨ ط¬ط¯ظٹط¯",
            f"ظˆطµظ„ ط·ظ„ط¨ طھظˆظپظٹظ‚ ط¬ط¯ظٹط¯ ط¨ط±ظ‚ظ… {request.request_code} ظˆظٹط­طھط§ط¬ ط¥ظ„ظ‰ ط§ظ„طھط­ظ‚ظ‚.",
            {"request_code": request.request_code},
        )
        await self.db.commit()
        await self.db.refresh(request)
        return request, True

    async def update_request(self, user: User, data: MaleRequestUpdate) -> MaleRequest:
        request = await self.get_active_request(user.id)
        if not request:
            raise NotFoundError("REQUEST_NOT_FOUND", "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯.")
        old = {
            "male_characteristics": dict(request.male_characteristics or {}),
            "desired_female_characteristics": dict(request.desired_female_characteristics or {}),
        }
        changes = data.model_dump(exclude_unset=True, mode="json")
        for key, value in changes.items():
            setattr(request, key, value)
        new = {
            "male_characteristics": dict(request.male_characteristics or {}),
            "desired_female_characteristics": dict(request.desired_female_characteristics or {}),
        }
        field_changes = {}
        for section, old_section in old.items():
            new_section = new[section]
            for field in sorted(set(old_section) | set(new_section)):
                if old_section.get(field) != new_section.get(field):
                    field_changes[f"{section}.{field}"] = {
                        "old_value": old_section.get(field),
                        "new_value": new_section.get(field),
                    }
        await audit(
            self.db,
            actor_id=user.id,
            action="male_request.updated",
            entity_type="male_request",
            entity_id=request.id,
            old_values=old,
            new_values={
                "request_code": request.request_code,
                "changed_fields": sorted(field_changes),
                "field_changes": field_changes,
            },
        )
        await self.db.flush()
        await self.run_matching(request)
        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def update_matchmaker_request(
        self, request: MaleRequest, data: MaleRequestUpdate, actor_id: str
    ) -> MaleRequest:
        old = {
            "male_characteristics": dict(request.male_characteristics or {}),
            "desired_female_characteristics": dict(request.desired_female_characteristics or {}),
        }
        changes = data.model_dump(exclude_unset=True, mode="json")
        for key, value in changes.items():
            setattr(request, key, value)
        new = {
            "male_characteristics": dict(request.male_characteristics or {}),
            "desired_female_characteristics": dict(request.desired_female_characteristics or {}),
        }
        field_changes = {}
        for section, old_section in old.items():
            new_section = new[section]
            for field in sorted(set(old_section) | set(new_section)):
                if old_section.get(field) != new_section.get(field):
                    field_changes[f"{section}.{field}"] = {
                        "old_value": old_section.get(field),
                        "new_value": new_section.get(field),
                    }
        await audit(
            self.db,
            actor_id=actor_id,
            action="male_request.matchmaker_updated",
            entity_type="male_request",
            entity_id=request.id,
            old_values=old,
            new_values={
                "request_code": request.request_code,
                "changed_fields": sorted(field_changes),
                "field_changes": field_changes,
            },
        )
        await self.db.flush()
        await self.run_matching(request)
        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def create_female_profile(
        self, matchmaker_id: str, data: FemaleProfileIn, actor_id: str
    ) -> FemaleProfile:
        code = f"FP-{datetime.now().year}-{randint(1, 999999):06d}"
        profile = FemaleProfile(
            public_code=code,
            matchmaker_id=matchmaker_id,
            **data.model_dump(),
        )
        self.db.add(profile)
        await self.db.flush()
        await audit(
            self.db,
            actor_id=actor_id,
            action="female_profile.created",
            entity_type="female_profile",
            entity_id=profile.id,
            new_values={"status": profile.status.value, "public_code": code},
        )
        await self.db.commit()
        if profile.status == FemaleProfileStatus.ACTIVE:
            await self.sync_profile(profile)
        return profile

    async def update_female_profile(
        self, profile: FemaleProfile, data: FemaleProfileUpdate, actor_id: str
    ) -> FemaleProfile:
        old = {"status": profile.status.value}
        changes = data.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(profile, key, value)
        await audit(
            self.db,
            actor_id=actor_id,
            action="female_profile.updated",
            entity_type="female_profile",
            entity_id=profile.id,
            old_values=old,
            new_values={
                "status": profile.status.value,
                "changed_fields": sorted(changes),
            },
        )
        await self.db.commit()
        if profile.status == FemaleProfileStatus.ACTIVE:
            await self.sync_profile(profile)
        else:
            await QdrantAdapter().delete(profile.id)
        return profile

    async def sync_profile(self, profile: FemaleProfile) -> bool:
        safe = PrivacySanitizerService().searchable_female(profile)
        text = "طŒ ".join(str(value) for value in safe.values() if value not in (None, [], ""))
        vector = await GeminiAdapter().embed(text)
        return await QdrantAdapter().upsert(profile.id, vector, safe)

    async def setting(self, key: str, default):
        value = await self.db.scalar(select(SystemSetting.value).where(SystemSetting.key == key))
        return default if value is None else value

    async def run_matching(self, request: MaleRequest) -> dict:
        try:
            MaleRequestIn.model_validate(
                {
                    "male_characteristics": request.male_characteristics,
                    "desired_female_characteristics": request.desired_female_characteristics,
                }
            )
        except ValidationError as exc:
            raise AppError(
                "INVALID_REQUEST_DATA",
                "ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ظ„ط¨ طھط­طھط§ط¬ ط¥ظ„ظ‰ طھطµط­ظٹط­ ظ‚ط¨ظ„ ط§ظ„ظ…ط·ط§ط¨ظ‚ط©.",
                422,
            ) from exc
        threshold = float(await self.setting("minimum_match_score", 70))
        maximum = int(await self.setting("maximum_candidates", 10))
        desired = request.desired_female_characteristics or {}
        stmt = select(FemaleProfile).where(FemaleProfile.status == FemaleProfileStatus.ACTIVE)
        if desired.get("age_min") is not None:
            stmt = stmt.where(FemaleProfile.age >= int(desired["age_min"]))
        if desired.get("age_max") is not None:
            stmt = stmt.where(FemaleProfile.age <= int(desired["age_max"]))
        if desired.get("height_min") is not None:
            stmt = stmt.where(FemaleProfile.height >= int(desired["height_min"]))
        if desired.get("height_max") is not None:
            stmt = stmt.where(FemaleProfile.height <= int(desired["height_max"]))
        governorates = desired.get("governorates") or desired.get("governorate")
        if isinstance(governorates, str):
            governorates = [governorates]
        if governorates:
            stmt = stmt.where(FemaleProfile.governorate.in_(governorates))
        females = list(await self.db.scalars(stmt))

        # Semantic retrieval may narrow and order the SQL-authorized set. Failure is an
        # explicit graceful-degradation path; deterministic mutual matching still works.
        safe_query = PrivacySanitizerService().sanitize(
            {
                "male": request.male_characteristics,
                "desired_female": desired,
            }
        )
        query_text = json.dumps(safe_query, ensure_ascii=False, sort_keys=True)
        query_vector = await GeminiAdapter().embed(query_text)
        semantic_ids = await QdrantAdapter().search(
            query_vector,
            allowed_ids=[female.id for female in females],
            limit=max(maximum * 5, maximum),
        )
        if semantic_ids is not None:
            by_id = {female.id: female for female in females}
            females = [
                by_id[profile_id]
                for profile_id in dict.fromkeys(semantic_ids)
                if profile_id in by_id
            ]

        await self.db.execute(
            update(MatchCandidate)
            .where(
                MatchCandidate.male_request_id == request.id,
                MatchCandidate.status.in_(["AVAILABLE", "NOT_SHORTLISTED"]),
            )
            .values(status="STALE")
        )
        created: list[MatchCandidate] = []
        for female in females:
            public = PrivacySanitizerService().searchable_female(female)
            mtf, ftm, mutual = mutual_scores(
                request.male_characteristics,
                request.desired_female_characteristics,
                public,
                female.desired_male,
            )
            if not eligible(mtf, ftm, threshold):
                continue
            candidate = await self.db.scalar(
                select(MatchCandidate).where(
                    MatchCandidate.male_request_id == request.id,
                    MatchCandidate.female_profile_id == female.id,
                )
            )
            if not candidate:
                candidate = MatchCandidate(
                    male_request_id=request.id,
                    female_profile_id=female.id,
                    matchmaker_id=request.assigned_matchmaker_id or female.matchmaker_id,
                    male_to_female_score=mtf,
                    female_to_male_score=ftm,
                    mutual_score=mutual,
                )
                self.db.add(candidate)
            else:
                if candidate.status not in {"STALE", "AVAILABLE", "NOT_SHORTLISTED"}:
                    continue
                (
                    candidate.male_to_female_score,
                    candidate.female_to_male_score,
                    candidate.mutual_score,
                ) = mtf, ftm, mutual
                candidate.matchmaker_id = request.assigned_matchmaker_id or female.matchmaker_id
            candidate.status = "AVAILABLE"
            created.append(candidate)
        created.sort(key=lambda item: item.mutual_score, reverse=True)
        for excess in created[maximum:]:
            excess.status = "NOT_SHORTLISTED"
        summary = public_match_summary(x.mutual_score for x in created[:maximum])
        if summary["count"]:
            await NotificationService(self.db).create(
                request.male_user_id,
                "match_found",
                "طھظˆط¬ط¯ ظپط±طµ طھظˆط§ظپظ‚",
                summary["message"],
                {"request_code": request.request_code, "count": summary["count"]},
            )
        await self.db.commit()
        return summary

    async def create_case(
        self, candidate: MatchCandidate, matchmaker_id: str, actor_id: str
    ) -> MatchCase:
        existing_case = await self.db.scalar(
            select(MatchCase).where(MatchCase.candidate_id == candidate.id)
        )
        if existing_case:
            return existing_case
        profile = await self.db.get(FemaleProfile, candidate.female_profile_id)
        if (
            candidate.status != "AVAILABLE"
            or not profile
            or profile.status != FemaleProfileStatus.ACTIVE
        ):
            raise AppError(
                "CANDIDATE_UNAVAILABLE", "ظپط±طµط© ط§ظ„طھظˆط§ظپظ‚ ظ„ظ… طھط¹ط¯ ظ…طھط§ط­ط©.", 409
            )
        request = await self.db.get(MaleRequest, candidate.male_request_id)
        payment = await self.db.scalar(
            select(Payment)
            .where(
                Payment.male_request_id == request.id,
                Payment.status.in_([PaymentStatus.PAID, PaymentStatus.WAIVED]),
            )
            .order_by(Payment.created_at.desc())
        )
        ensure_contact_allowed(
            request.verification_status, payment.status if payment else PaymentStatus.PENDING
        )
        allow_multiple = bool(await self.setting("allow_multiple_serious_matches", False))
        if not allow_multiple:
            serious = await self.db.scalar(
                select(MatchCase.id).where(
                    MatchCase.male_request_id == request.id,
                    MatchCase.status == MatchCaseStatus.SERIOUS_CONTACT,
                )
            )
            if serious:
                raise AppError(
                    "SERIOUS_CASE_EXISTS",
                    "ظٹظˆط¬ط¯ طھظˆط§طµظ„ ط¬ط¯ظٹ ظپط¹ط§ظ„ ظ„ظ‡ط°ط§ ط§ظ„ط´ط§ط¨.",
                    409,
                )
        case = MatchCase(
            candidate_id=candidate.id,
            male_request_id=request.id,
            female_profile_id=candidate.female_profile_id,
            matchmaker_id=matchmaker_id,
            status=MatchCaseStatus.READY_TO_CONTACT_FEMALE,
        )
        self.db.add(case)
        candidate.status = "SELECTED"
        await self.db.flush()
        self.db.add(
            MatchCaseHistory(
                match_case_id=case.id,
                from_status=None,
                to_status=case.status.value,
                actor_id=actor_id,
            )
        )
        await audit(
            self.db,
            actor_id=actor_id,
            action="match_case.created",
            entity_type="match_case",
            entity_id=case.id,
            new_values={"status": case.status.value},
        )
        await self.db.commit()
        return case

    async def transition_case(
        self, case: MatchCase, target: MatchCaseStatus, actor_id: str, reason: str | None = None
    ) -> MatchCase:
        if target in {MatchCaseStatus.READY_TO_CONTACT_FEMALE, MatchCaseStatus.WAITING_FEMALE}:
            request = await self.db.get(MaleRequest, case.male_request_id)
            payment = await self.db.scalar(
                select(Payment).where(
                    Payment.male_request_id == case.male_request_id,
                    Payment.status.in_([PaymentStatus.PAID, PaymentStatus.WAIVED]),
                )
            )
            ensure_contact_allowed(
                request.verification_status,
                payment.status if payment else PaymentStatus.PENDING,
            )
        if target == MatchCaseStatus.FEMALE_ACCEPTED and case.female_decision.value != "ACCEPTED":
            raise AppError(
                "FEMALE_DECISION_REQUIRED", "ظٹظ„ط²ظ… طھط³ط¬ظٹظ„ ظ…ظˆط§ظپظ‚ط© ط§ظ„ظپطھط§ط©.", 409
            )
        if target == MatchCaseStatus.MUTUAL_ACCEPTANCE and not (
            case.female_decision.value == "ACCEPTED" and case.male_decision.value == "ACCEPTED"
        ):
            raise AppError(
                "MUTUAL_DECISIONS_REQUIRED",
                "ظٹظ„ط²ظ… ظ‚ط¨ظˆظ„ ط§ظ„ط·ط±ظپظٹظ† ظ‚ط¨ظ„ طھط³ط¬ظٹظ„ ط§ظ„ظ‚ط¨ظˆظ„ ط§ظ„ظ…طھط¨ط§ط¯ظ„.",
                409,
            )
        if target == MatchCaseStatus.SERIOUS_CONTACT and not bool(
            await self.setting("allow_multiple_serious_matches", False)
        ):
            existing = await self.db.scalar(
                select(MatchCase.id).where(
                    MatchCase.male_request_id == case.male_request_id,
                    MatchCase.status == MatchCaseStatus.SERIOUS_CONTACT,
                    MatchCase.id != case.id,
                )
            )
            if existing:
                raise AppError(
                    "SERIOUS_CASE_EXISTS",
                    "ظٹظˆط¬ط¯ طھظˆط§طµظ„ ط¬ط¯ظٹ ظپط¹ط§ظ„ ظ„ظ‡ط°ط§ ط§ظ„ط´ط§ط¨.",
                    409,
                )
        ensure_transition(case.status, target)
        old = case.status
        case.status = target
        now = datetime.now(timezone.utc)
        if target == MatchCaseStatus.ENGAGED:
            case.engaged_at = now
            success_fee = float(await self.setting("success_fee", 0))
            case.success_fee_status = (
                SuccessFeeStatus.PENDING if success_fee > 0 else SuccessFeeStatus.NONE
            )
        if target == MatchCaseStatus.MARRIED:
            case.married_at = now
            request = await self.db.get(MaleRequest, case.male_request_id)
            if request:
                request.is_active = False
                request.workflow_status = MatchCaseStatus.MARRIED.value
        candidate = await self.db.get(MatchCandidate, case.candidate_id)
        if candidate and target in {MatchCaseStatus.REJECTED, MatchCaseStatus.CLOSED}:
            candidate.status = target.value
        if target in {MatchCaseStatus.ENGAGED, MatchCaseStatus.MARRIED}:
            profile = await self.db.get(FemaleProfile, case.female_profile_id)
            if profile:
                profile.status = FemaleProfileStatus.MATCHED
        self.db.add(
            MatchCaseHistory(
                match_case_id=case.id,
                from_status=old.value,
                to_status=target.value,
                actor_id=actor_id,
                reason=reason,
            )
        )
        await audit(
            self.db,
            actor_id=actor_id,
            action="match_case.status_changed",
            entity_type="match_case",
            entity_id=case.id,
            old_values={"status": old.value},
            new_values={"status": target.value},
        )
        request = await self.db.get(MaleRequest, case.male_request_id)
        if request and target in {
            MatchCaseStatus.FEMALE_ACCEPTED,
            MatchCaseStatus.MUTUAL_ACCEPTANCE,
            MatchCaseStatus.ENGAGED,
            MatchCaseStatus.MARRIED,
        }:
            messages = {
                MatchCaseStatus.FEMALE_ACCEPTED: (
                    "female_accepted",
                    "طھط­ط¯ظٹط« ط¹ظ„ظ‰ ط·ظ„ط¨ظƒ",
                    "ط³ط¬ظ‘ظ„طھ ط§ظ„ط®ط·ظ‘ط§ط¨ط© ظ…ظˆط§ظپظ‚ط© ط£ظˆظ„ظٹط©طŒ ظˆط³طھطھظˆط§طµظ„ ظ…ط¹ظƒ ظ„ظ„ط®ط·ظˆط© ط§ظ„طھط§ظ„ظٹط©.",
                ),
                MatchCaseStatus.MUTUAL_ACCEPTANCE: (
                    "male_accepted",
                    "طھظ… ط§ظ„ظ‚ط¨ظˆظ„ ط§ظ„ظ…طھط¨ط§ط¯ظ„",
                    "ط§ظƒطھظ…ظ„طھ ظ…ظˆط§ظپظ‚ط© ط§ظ„ط·ط±ظپظٹظ†طŒ ظˆط³طھظ†ط³ظ‚ ط§ظ„ط®ط·ظ‘ط§ط¨ط© ط§ظ„ظ„ظ‚ط§ط، ط¨ط·ط±ظٹظ‚ط© ط¢ظ…ظ†ط©.",
                ),
                MatchCaseStatus.ENGAGED: (
                    "engagement_recorded",
                    "طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط®ط·ط¨ط©",
                    "ظ…ط¨ط§ط±ظƒ! طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط®ط·ط¨ط© ظپظٹ ظ…ط³ط§ط± ط§ظ„ط­ط§ظ„ط©.",
                ),
                MatchCaseStatus.MARRIED: (
                    "marriage_recorded",
                    "طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط²ظˆط§ط¬",
                    "ظ…ط¨ط§ط±ظƒ! طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط²ظˆط§ط¬ ظˆط¥ظƒظ…ط§ظ„ ط·ظ„ط¨ ط§ظ„طھظˆظپظٹظ‚.",
                ),
            }
            kind, title, body = messages[target]
            await NotificationService(self.db).create(
                request.male_user_id,
                kind,
                title,
                body,
                {"request_code": request.request_code},
            )
        await self.db.commit()
        return case
