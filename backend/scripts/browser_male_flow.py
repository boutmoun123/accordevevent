"""Real browser registration, progressive chat, request, matching, and logout."""
import json
import re
import secrets

from playwright.sync_api import expect, sync_playwright

from browser_review import BASE, ENV, OUT


def main():
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("pageerror", lambda error: errors.append(str(error)))

        def register():
            page.goto(BASE + "/auth/register?next=/chat", wait_until="networkidle")
            page.locator('[name="first_name"]').fill("مستخدم اختبار متصفح")
            page.locator('[name="phone"]').fill("+9639" + str(secrets.randbelow(10**8)).zfill(8))
            page.locator('[name="governorate"]').select_option("دمشق")
            page.locator('[name="date_of_birth"]').fill("1995-01-01")
            page.locator('[name="password"]').fill(secrets.token_urlsafe(18))
            with page.expect_response(lambda r: r.url.endswith("/auth/register")) as response:
                page.get_by_role("button", name="إنشاء حساب آمن").click()
            assert response.value.status == 201
            page.wait_for_url("**/chat")
            page.wait_for_load_state("networkidle")

        register()
        answers = ["31", "دمشق", "مدينة اختبار معزولة", "أعزب", "180", "جامعي", "تخطي", "مهندس", "موظف", "لا", "العائلة", "هادئ", "هاتف", "24 إلى 30", "لا يهم", "تخطي", "لا يهم", "لا يهم", "لا يهم", "لا", "لا يهم", "لا يهم", "العائلة", "هادئة", "لا يوجد"]
        for answer in answers:
            page.locator("textarea").fill(answer)
            with page.expect_response(lambda r: r.url.endswith("/chat/message")) as received:
                page.get_by_role("button", name="إرسال", exact=True).click()
            assert received.value.status == 200
        state = received.value.json()["data"]["structured_state"]
        expect(page.get_by_role("button", name="إنشاء طلب التوفيق")).to_be_visible()
        with page.expect_response(lambda r: r.url.endswith("/male/request") and r.request.method == "POST") as request:
            page.get_by_role("button", name="إنشاء طلب التوفيق").click()
        assert request.value.status == 201
        saved = request.value.json()["data"]
        code = saved["request_code"]
        expect(page.get_by_text(code, exact=True)).to_be_visible()
        page.wait_for_load_state("networkidle")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        page.screenshot(path=str(OUT / "male-request-mobile.png"), full_page=True)
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(code, exact=True)).to_be_visible()
        token = page.evaluate("localStorage.getItem('farah_access_token')")
        headers = {"Authorization": "Bearer " + token}
        api = ENV["NEXT_PUBLIC_API_URL"]
        duplicate = page.request.post(api + "/male/request", headers=headers, data={"male_characteristics": state["male"], "desired_female_characteristics": state["desired_female"]})
        assert duplicate.status == 201
        assert duplicate.json()["data"]["id"] == saved["id"]
        count = page.request.get(api + "/matching/count", headers=headers)
        assert count.status == 200
        assert set(count.json()["data"]) == {"count", "quality", "message"}
        assert page.request.get(api + "/matchmaker/female-profiles", headers=headers).status == 403
        page.goto(BASE + "/account", wait_until="networkidle")
        page.get_by_role("button", name=re.compile("خروج")).click()
        page.wait_for_url("**/auth/login")
        assert page.request.get(api + "/me", headers=headers).status == 401
        register()
        expect(page.get_by_text("مدينة اختبار معزولة", exact=True)).to_have_count(0)
        assert not errors, errors
        browser.close()
    result = {"male_registration_chat_request_matching": "passed", "duplicate_request": "passed", "female_pii_access": "403", "logout_revocation": "passed", "cross_account_chat_isolation": "passed", "request_restoration": "passed", "page_errors": errors}
    (OUT / "male-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
