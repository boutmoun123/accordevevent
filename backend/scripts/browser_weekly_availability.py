"""Real UI/API booking flow against an isolated database, leaving local users untouched."""
import asyncio
import json
import os
import secrets
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "test-results" / ("weekly-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
OUT.mkdir(parents=True)
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + (OUT / "browser.db").as_posix()
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)
os.environ["ENVIRONMENT"] = "test"
os.environ["GEMINI_API_KEY"] = ""
os.environ["QDRANT_URL"] = ""

from playwright.sync_api import expect, sync_playwright
from app.auth.security import hash_password
from app.database.base import Base
from app.database.session import engine, SessionLocal
from app.models import Matchmaker, User, Role, VerificationStatus

PASSWORD = secrets.token_urlsafe(20)


async def prepare():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        user = User(first_name="اختبار الجدول", email="weekly@example.test", phone="+963000999888",
                    password_hash=hash_password(PASSWORD), role=Role.MATCHMAKER)
        db.add(user)
        await db.flush()
        owner = Matchmaker(user_id=user.id, verification_status=VerificationStatus.VERIFIED)
        db.add(owner)
        await db.commit()
        owner_id = owner.id
    await engine.dispose()
    return owner_id


def main():
    owner_id = asyncio.run(prepare())
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    api_base = f"http://127.0.0.1:{port}"
    with (OUT / "api.log").open("w", encoding="utf-8") as log:
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT / "backend", env=os.environ.copy(), stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        try:
            for _ in range(60):
                try:
                    with urlopen(api_base + "/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.2)
            with sync_playwright() as pw:
                browser = pw.chromium.launch(channel="chrome", headless=True)
                errors = []

                def context():
                    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
                    def redirect(route):
                        suffix = route.request.url.split("/api/v1/", 1)[1]
                        response = route.fetch(url=api_base + "/api/v1/" + suffix)
                        route.fulfill(response=response)
                    ctx.route("**/api/v1/**", redirect)
                    ctx.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                    return ctx

                mm = context()
                page = mm.new_page()
                page.goto("http://localhost:3000/auth/login", wait_until="networkidle")
                page.locator('[name="phone"]').fill("weekly@example.test")
                page.locator('[name="password"]').fill(PASSWORD)
                page.get_by_role("button", name="تسجيل الدخول", exact=True).click()
                page.wait_for_url("**/matchmaker", timeout=30000)
                page.goto("http://localhost:3000/matchmaker/availability", wait_until="networkidle")
                expect(page.get_by_role("switch")).to_have_count(7)
                expect(page.get_by_label("مدة موعد التواصل")).to_have_value("30")
                expect(page.get_by_label("عرض المواعيد القادمة لمدة")).to_have_value("14")
                for day, ranges in [("الأحد", [("17:00", "19:00"), ("21:00", "22:00")]), ("الاثنين", [("17:00", "19:00")])]:
                    page.get_by_role("switch", name="التوفر يوم " + day).click()
                    section = page.get_by_role("region", name=day, exact=True)
                    for i, (start, end) in enumerate(ranges, 1):
                        section.get_by_role("button", name="+ إضافة فترة أخرى").click()
                        page.get_by_label(f"{day} بداية الفترة {i}").fill(start)
                        page.get_by_label(f"{day} نهاية الفترة {i}").fill(end)
                with page.expect_response(lambda response: response.request.method == "PATCH" and response.url.endswith("/availability")) as saved:
                    page.get_by_role("button", name="حفظ جدول المواعيد").click()
                assert saved.value.status == 200
                page.screenshot(path=str(OUT / "weekly-dashboard.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.screenshot(path=str(OUT / "weekly-dashboard-mobile.png"), full_page=True)

                female = context()
                girl = female.new_page()
                girl.goto(f"http://localhost:3000/female?matchmaker_id={owner_id}", wait_until="networkidle")
                girl.get_by_role("button", name="تواصلي مع خطّابة", exact=True).click()
                girl.get_by_role("radio").first.wait_for()
                slots = json.loads(urlopen(api_base + f"/api/v1/contact-availability?matchmaker_id={owner_id}").read())["data"]
                sunday = next(slot for slot in slots if datetime.fromisoformat(slot["scheduled_at"]).weekday() == 6 and "T17:30:" in slot["scheduled_at"])
                same_day = [slot for slot in slots if slot["appointment_date"] == sunday["appointment_date"]]
                assert [slot["scheduled_at"][11:16] for slot in same_day] == ["17:00", "17:30", "18:00", "18:30", "21:00", "21:30"]
                girl.locator('input[type="radio"]').evaluate_all("(nodes, id) => nodes.find(n => n.value === id).click()", sunday["id"])
                girl.get_by_label("رقم الهاتف *").fill("+963000123456")
                girl.get_by_label("المحافظة *").select_option("دمشق")
                girl.get_by_role("checkbox").check()
                girl.set_viewport_size({"width": 390, "height": 844})
                assert girl.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                girl.screenshot(path=str(OUT / "female-slots-mobile.png"), full_page=True)
                girl.get_by_role("button", name="إرسال الطلب بأمان").click()
                expect(girl.get_by_text("وصل طلبك بأمان")).to_be_visible()

                second_context = context()
                second = second_context.new_page()
                second.goto(f"http://localhost:3000/female?matchmaker_id={owner_id}", wait_until="networkidle")
                second.get_by_role("button", name="تواصلي مع خطّابة", exact=True).click()
                second.get_by_role("radio").first.wait_for()
                visible = second.get_by_role("radio").evaluate_all("nodes => nodes.map(n => n.value)")
                assert sunday["id"] not in visible
                assert all(slot["id"] in visible for slot in same_day if slot["id"] != sunday["id"])
                page.reload(wait_until="networkidle")
                expect(page.get_by_text("محجوز", exact=True)).to_be_visible()
                expect(page.get_by_text("+963000123456", exact=True)).to_be_visible()
                page.screenshot(path=str(OUT / "booked-dashboard-mobile.png"), full_page=True)
                assert not errors, errors
                browser.close()
                print(json.dumps({"weekly_ui": "passed", "sunday_slots": 6, "booked": "17:30", "hidden_from_second_visitor": True, "mobile_overflow": False, "page_errors": errors, "artifacts": str(OUT)}))
        finally:
            server.terminate()
            server.wait(timeout=10)


if __name__ == "__main__":
    main()
