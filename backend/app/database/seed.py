import asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.auth.identifiers import request_code_digest
from app.auth.security import hash_password
from app.core.config import get_settings
from app.database.session import SessionLocal
from app.models import (
    FemaleProfile,
    FemaleProfileStatus,
    MaleRequest,
    MaleRequestAccessCode,
    MatchCandidate,
    MatchCase,
    MatchCaseStatus,
    Matchmaker,
    Payment,
    PaymentStatus,
    Role,
    SystemSetting,
    User,
    VerificationStatus,
)
from app.services.domain import DomainService

GOVERNORATES = [
    "دمشق",
    "ريف دمشق",
    "حلب",
    "حمص",
    "حماة",
    "اللاذقية",
    "طرطوس",
    "درعا",
    "السويداء",
    "إدلب",
    "دير الزور",
    "الحسكة",
    "الرقة",
]
DEFAULT_SETTINGS = {
    "minimum_match_score": 70,
    "maximum_candidates": 10,
    "contact_opening_fee": 50,
    "success_fee": 0,
    "allow_multiple_serious_matches": False,
    "male_registration_enabled": True,
    "female_leads_enabled": True,
    "support_phone": "+963000000000",
    "support_whatsapp": "+963000000000",
    "default_matchmaker_assignment": None,
    "maintenance_mode": False,
}


async def seed():
    cfg = get_settings()
    if cfg.environment == "production":
        raise RuntimeError("Development seed is disabled in production")
    if not cfg.dev_seed_password and not all(
        (cfg.seed_admin_password, cfg.seed_matchmaker_password, cfg.seed_male_password)
    ):
        raise RuntimeError(
            "Set DEV_SEED_PASSWORD or all three SEED_*_PASSWORD values before seeding"
        )
    async with SessionLocal() as db:
        if await db.scalar(select(User.id).where(User.email == "admin@farah.local")):
            profiles = list(
                await db.scalars(
                    select(FemaleProfile).where(FemaleProfile.status == FemaleProfileStatus.ACTIVE)
                )
            )
            synced = sum([await DomainService(db).sync_profile(profile) for profile in profiles])
            print("Development seed already exists")
            print(f"Qdrant profiles synchronized: {synced}/{len(profiles)}")
            return
        admin_password = hash_password(cfg.seed_admin_password or cfg.dev_seed_password)
        matchmaker_password = hash_password(cfg.seed_matchmaker_password or cfg.dev_seed_password)
        male_password = hash_password(cfg.seed_male_password or cfg.dev_seed_password)
        admin = User(
            first_name="مدير النظام",
            phone="+963000000001",
            email="admin@farah.local",
            password_hash=admin_password,
            governorate="دمشق",
            date_of_birth=date(1990, 1, 1),
            role=Role.SUPER_ADMIN,
        )
        db.add(admin)
        matchmakers = []
        for i in range(3):
            account = User(
                first_name=f"خطابة تجريبية {i + 1}",
                phone=f"+96300000001{i + 1}",
                email="matchmaker@farah.local" if i == 0 else f"matchmaker{i + 1}@farah.local",
                password_hash=matchmaker_password,
                governorate=GOVERNORATES[i],
                date_of_birth=date(1985, 1, i + 1),
                role=Role.MATCHMAKER,
            )
            db.add(account)
            await db.flush()
            mm = Matchmaker(
                user_id=account.id,
                verification_status=VerificationStatus.VERIFIED,
                governorates=[GOVERNORATES[i]],
            )
            db.add(mm)
            await db.flush()
            matchmakers.append(mm)
        males = []
        for i in range(20):
            male = User(
                first_name=f"مستخدم تجريبي {i + 1}",
                phone=f"+96390000{i + 1:04d}",
                email="male@farah.local" if i == 0 else f"male{i + 1}@farah.local",
                password_hash=male_password,
                governorate=GOVERNORATES[i % len(GOVERNORATES)],
                date_of_birth=date(1990 + i % 10, 1, 1),
                role=Role.MALE_USER,
            )
            db.add(male)
            await db.flush()
            males.append(male)
        females = []
        for i in range(50):
            profile = FemaleProfile(
                public_code=f"FP-2026-{i + 1:06d}",
                matchmaker_id=matchmakers[i % 3].id,
                first_name=f"تجريبية {i + 1}",
                last_name="بيانات غير حقيقية",
                phone=f"+96391100{i + 1:04d}",
                age=22 + i % 14,
                governorate=GOVERNORATES[i % len(GOVERNORATES)],
                city="مدينة تجريبية",
                height=155 + i % 20,
                education="جامعية",
                occupation="عمل تجريبي",
                marital_status="SINGLE",
                children=False,
                hijab_status="HIJAB",
                personality_traits=["هادئة", "اجتماعية"],
                interests=["قراءة"],
                values=["العائلة", "الاحترام"],
                public_summary="ملف تجريبي لغرض التطوير فقط.",
                desired_male={"age_min": 25, "age_max": 45, "values": ["العائلة", "الاحترام"]},
                status=FemaleProfileStatus.ACTIVE,
            )
            db.add(profile)
            await db.flush()
            females.append(profile)
        requests = []
        for i in range(15):
            req = MaleRequest(
                male_user_id=males[i].id,
                male_characteristics={
                    "age": 28 + i % 10,
                    "governorate": males[i].governorate,
                    "height": 170 + i % 10,
                    "values": ["العائلة", "الاحترام"],
                },
                desired_female_characteristics={
                    "age_min": 20,
                    "age_max": 38,
                    "values": ["العائلة"],
                },
                assigned_matchmaker_id=matchmakers[i % 3].id,
                verification_status=VerificationStatus.VERIFIED,
            )
            db.add(req)
            await db.flush()
            db.add(
                MaleRequestAccessCode(
                    male_request_id=req.id,
                    code_digest=request_code_digest(req.request_code),
                    is_primary=True,
                )
            )
            await db.flush()
            requests.append(req)
        for i in range(10):
            candidate = MatchCandidate(
                male_request_id=requests[i].id,
                female_profile_id=females[i].id,
                matchmaker_id=matchmakers[i % 3].id,
                male_to_female_score=88,
                female_to_male_score=84,
                mutual_score=85.95,
                status="SELECTED",
            )
            db.add(candidate)
            await db.flush()
            payment = Payment(
                male_request_id=requests[i].id,
                amount=Decimal("50"),
                currency="USD",
                status=PaymentStatus.PAID,
                reference=f"DEV-PAY-{i + 1:04d}",
            )
            db.add(payment)
            case = MatchCase(
                candidate_id=candidate.id,
                male_request_id=requests[i].id,
                female_profile_id=females[i].id,
                matchmaker_id=matchmakers[i % 3].id,
                status=MatchCaseStatus.READY_TO_CONTACT_FEMALE,
            )
            db.add(case)
        for key, value in DEFAULT_SETTINGS.items():
            db.add(SystemSetting(key=key, value=value))
        await db.commit()
        synced = sum([await DomainService(db).sync_profile(profile) for profile in females])
        print("Seeded 1 admin, 3 matchmakers, 20 males, 50 female profiles, 15 requests, 10 cases")
        print("Accounts: admin@farah.local, matchmaker@farah.local, male@farah.local")
        print(f"Qdrant profiles synchronized: {synced}/{len(females)}")


if __name__ == "__main__":
    asyncio.run(seed())
