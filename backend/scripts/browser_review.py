"""Chrome smoke/E2E checks against the running Compose frontend and API."""
import json
import re
import secrets
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ENV = dict(line.split("=", 1) for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines() if line and not line.startswith("#") and "=" in line)
BASE = f"http://localhost:{ENV['FRONTEND_PORT']}"
OUT = ROOT / "test-results" / "browser"
OUT.mkdir(parents=True, exist_ok=True)


def main():
    results = []
    errors = []
    api_errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: api_errors.append({"url": response.url, "status": response.status}) if "/api/v1/" in response.url and response.status >= 400 and response.status not in {401, 404} else None)
        for route in ["/", "/female", "/auth/login", "/auth/register", "/account", "/chat"]:
            response = page.goto(BASE + route, wait_until="networkidle")
            assert response.status == 200, route
            assert page.locator("html").get_attribute("dir") == "rtl"
            assert page.locator("body").inner_text().strip()
            results.append({"route": route, "status": "passed"})
        # The anonymous account page must reach the sign-in action, not spin forever.
        page.goto(BASE + "/account", wait_until="networkidle")
        expect(page.get_by_role("link", name="تسجيل الدخول", exact=True)).to_be_visible()
        page.set_viewport_size({"width": 390, "height": 844})
        for route, name in [("/", "home-mobile"), ("/female", "female-mobile")]:
            page.goto(BASE + route, wait_until="networkidle")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), route
            page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
        page.get_by_role("button", name=re.compile("اتركي رقمك")).click()
        page.locator('[name="first_name"]').fill("اختبار متصفح")
        page.locator('[name="phone"]').fill("+9639" + str(secrets.randbelow(10**8)).zfill(8))
        page.locator('[name="governorate"]').select_option("دمشق")
        page.locator('[name="consent"]').check()
        with page.expect_response(lambda r: r.url.endswith("/female-leads")) as sent:
            page.get_by_role("button", name="إرسال الطلب بأمان").click()
        assert sent.value.status == 201
        results.append({"female_browser_lead": "passed"})
        page.set_viewport_size({"width": 1440, "height": 1000})

        def login(role):
            page.goto(BASE + "/auth/login", wait_until="networkidle")
            page.locator('[name="phone"]').fill(f"{role}@farah.local")
            page.locator('[name="password"]').fill(ENV[f"SEED_{role.upper()}_PASSWORD"])
            page.get_by_role("button", name="تسجيل الدخول", exact=True).click()
            page.wait_for_url(f"**/{'admin' if role == 'admin' else 'matchmaker'}")
            page.wait_for_load_state("networkidle")

        login("admin")
        for route in ["", "users", "matchmakers", "female-profiles", "male-requests", "cases", "meetings", "payments", "notifications", "reports", "settings", "audit-logs"]:
            page.goto(BASE + "/admin" + ("/" + route if route else ""), wait_until="networkidle")
            expect(page.get_by_text("تعذر تحميل البيانات", exact=False)).to_have_count(0)
            assert "/auth/login" not in page.url
            expect(page.locator("aside")).to_be_visible()
            results.append({"route": "/admin/" + route, "status": "passed"})
        page.screenshot(path=str(OUT / "admin-desktop.png"), full_page=True)
        print("Public/mobile/female lead/admin pages passed", flush=True)
        # Let the configured per-IP window expire before the next account's workflow.
        time.sleep(60)
        login("matchmaker")
        for route in ["", "female-profiles", "female-leads", "male-requests", "cases", "meetings", "payments", "notifications", "settings"]:
            page.goto(BASE + "/matchmaker" + ("/" + route if route else ""), wait_until="networkidle")
            assert "/auth/login" not in page.url
            expect(page.locator("aside")).to_be_visible()
            expect(page.get_by_text("تعذر تحميل البيانات", exact=False)).to_have_count(0)
            results.append({"route": "/matchmaker/" + route, "status": "passed"})
        page.goto(BASE + "/matchmaker/female-profiles", wait_until="networkidle")
        page.get_by_role("button", name="إضافة جديد").click()
        page.locator('[name="first_name"]').fill("اختبار متصفح")
        page.locator('[name="phone"]').fill("+9639" + str(secrets.randbelow(10**8)).zfill(8))
        page.locator('[name="age"]').fill("26")
        page.locator('[name="governorate"]').select_option("دمشق")
        page.locator('[name="status"]').select_option("DRAFT")
        page.locator('[name="contact_preference"]').select_option("MATCHMAKER")
        with page.expect_response(lambda r: r.url.endswith("/matchmaker/female-profiles") and r.request.method == "POST") as saved:
            page.get_by_role("button", name="حفظ الملف").click()
        assert saved.value.status == 201
        results.append({"female_profile_blank_optional_fields": "passed"})
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/matchmaker", wait_until="networkidle")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        page.screenshot(path=str(OUT / "matchmaker-mobile.png"), full_page=True)
        assert not errors, errors
        assert not api_errors, api_errors
        browser.close()
    (OUT / "results.json").write_text(json.dumps({"checks": results, "page_errors": errors}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"browser_checks": len(results), "page_errors": len(errors), "status": "passed"}), flush=True)


if __name__ == "__main__":
    main()
