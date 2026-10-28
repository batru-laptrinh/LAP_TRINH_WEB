"""Functional browser checks. Requires Node.js, Python Playwright and Chromium.

Setup: python -m pip install playwright
       python -m playwright install chromium
Run from the project root: python tests/browser_smoke.py
An existing system Chromium is also supported. Set CHROMIUM_PATH to select a
specific browser executable; otherwise system Chromium/Chrome or Playwright's
installed Chromium will be used automatically.
Starts and stops its own Node static server on port 3001; uses isolated browser
storage, so registrations in your normal browser are not affected.
Screenshots are saved in the ignored test-results/ directory.
"""
from pathlib import Path
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:3001"
RESULTS = ROOT / "test-results"


def fill_form(page, *, name="Nguyễn An", email="an@example.com", attendance="in-person", organization="Trường Đại học Minh Họa"):
    page.locator('[name="fullName"]').fill(name)
    page.locator('[name="email"]').fill(email)
    page.locator('[name="phone"]').fill("0901234567")
    page.locator('[name="organization"]').fill(organization)
    page.locator('[name="audience"]').select_option("student")
    page.locator(f'[name="attendance"][value="{attendance}"]').check()
    page.locator('[name="topics"][value="digital-transformation"]').check()
    page.locator('[name="consent"]').check()


def submit(page):
    page.locator('#registration-form button[type="submit"]').click()


def stats(page, total, in_person, online):
    expect(page.locator("#total-count")).to_have_text(str(total))
    expect(page.locator("#in-person-count")).to_have_text(str(in_person))
    expect(page.locator("#online-count")).to_have_text(str(online))


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Page overflows horizontally"


def run_checks():
    checks = []
    failures = []
    RESULTS.mkdir(exist_ok=True)
    with sync_playwright() as p:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("google-chrome")
        options = {"args": ["--no-sandbox"]}
        if executable:
            options["executable_path"] = executable
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda error: failures.append(str(error)))
        page.on("console", lambda msg: failures.append(msg.text) if msg.type == "error" and "favicon" not in msg.text and "404" not in msg.text else None)
        response = page.goto(BASE_URL, wait_until="networkidle")
        assert response and response.status == 200
        expect(page.locator("#registration-form")).to_be_visible()
        stats(page, 0, 0, 0)
        assert page.locator('#dien-gia img').count() >= 4
        page.locator('#dien-gia').scroll_into_view_if_needed()
        page.wait_for_function("Array.from(document.querySelectorAll('#dien-gia img')).every(image => image.complete && image.naturalWidth > 0)")
        assert page.evaluate("Array.from(document.querySelectorAll('#dien-gia img')).every(image => image.complete && image.naturalWidth > 0)")
        assert page.locator('#chuong-trinh tbody tr').count() >= 6
        no_overflow(page)
        checks.append("Desktop loads with four local speaker images and at least six schedule activities")

        submit(page)
        for field in ["fullName", "email", "phone", "organization", "audience", "attendance", "topics", "consent"]:
            assert page.locator(f'[data-error="{field}"]').inner_text().strip(), f"Missing {field} error"
        expect(page.locator('[name="fullName"]')).to_be_focused()
        stats(page, 0, 0, 0)
        checks.append("Empty form shows all eight required-field errors and focuses first invalid field")

        fill_form(page)
        page.locator('[name="fullName"]').fill(" A ")
        page.locator('[name="email"]').fill("invalid")
        page.locator('[name="phone"]').fill("1901234567")
        page.locator('[name="organization"]').fill("  ")
        submit(page)
        for field in ["fullName", "email", "phone", "organization"]:
            assert page.locator(f'[data-error="{field}"]').inner_text().strip()
        expect(page.locator('[name="fullName"]')).to_have_value(" A ")
        expect(page.locator('[name="phone"]')).to_have_value("1901234567")
        expect(page.locator('[name="topics"][value="digital-transformation"]')).to_be_checked()
        checks.append("Invalid values fail validation without erasing form fields or selected topics")

        fill_form(page, email=" AN@Example.COM ")
        page.locator('[name="notes"]').fill("Thông tin minh họa")
        expect(page.locator('#notes-count')).to_have_text(f"{len('Thông tin minh họa')}/300")
        submit(page)
        stats(page, 1, 1, 0)
        result = page.locator('#registration-result')
        for expected in ["Nguyễn An", "an@example.com", "Trường Đại học Minh Họa", "Trực tiếp"]:
            expect(result).to_contain_text(expected)
        expect(page.locator('[name="fullName"]')).to_have_value("")
        checks.append("Valid in-person registration saves normalized email and displays required confirmation")

        fill_form(page, name="Người trùng", email=" An@EXAMPLE.com ")
        submit(page)
        expect(page.locator('[data-error="email"]')).to_contain_text("đã đăng ký")
        expect(page.locator('[name="fullName"]')).to_have_value("Người trùng")
        stats(page, 1, 1, 0)
        checks.append("Duplicate emails are rejected regardless of case and surrounding whitespace")

        malicious = '<img src=x onerror="window.__injected=true">'
        fill_form(page, name="Trần Bình", email="binh@example.com", attendance="online", organization=malicious)
        submit(page)
        stats(page, 2, 1, 1)
        expect(page.locator('#registration-result')).to_contain_text(malicious)
        assert page.locator('#registration-result img').count() == 0
        assert not page.evaluate("Boolean(window.__injected)")
        checks.append("Online registration updates statistics; user content renders as text without HTML execution")

        page.reload(wait_until="networkidle")
        stats(page, 2, 1, 1)
        expect(page.locator('#registrations-list .registration-card')).to_have_count(2)
        expect(page.locator('#registrations-list')).to_contain_text("an@example.com")
        checks.append("Reload restores both saved registrations and statistics from localStorage")

        page.once("dialog", lambda dialog: dialog.dismiss())
        page.locator('button[data-delete-id]').first.click()
        stats(page, 2, 1, 1)
        expect(page.locator('#registrations-list .registration-card')).to_have_count(2)
        page.once("dialog", lambda dialog: dialog.accept())
        page.locator('button[data-delete-id]').first.click()
        stats(page, 1, 1, 0)
        expect(page.locator('#registrations-list .registration-card')).to_have_count(1)
        page.reload(wait_until="networkidle")
        stats(page, 1, 1, 0)
        expect(page.locator('#registrations-list')).not_to_contain_text("binh@example.com")
        checks.append("Delete requires confirmation; cancel preserves data and accept persists deletion after reload")

        for width in [390, 768]:
            page.set_viewport_size({"width": width, "height": 900})
            page.goto(BASE_URL, wait_until="networkidle")
            toggle = page.locator('#menu-toggle')
            expect(toggle).to_be_visible()
            expect(toggle).to_have_attribute("aria-expanded", "false")
            toggle.click()
            expect(toggle).to_have_attribute("aria-expanded", "true")
            expect(page.locator('#primary-menu')).to_be_visible()
            page.keyboard.press("Escape")
            expect(toggle).to_have_attribute("aria-expanded", "false")
            toggle.click()
            page.locator('#primary-menu a[href="#dang-ky"]').click()
            expect(toggle).to_have_attribute("aria-expanded", "false")
            assert page.url.endswith("#dang-ky")
            no_overflow(page)
        page.screenshot(path=str(RESULTS / "conference-mobile.png"), full_page=True)
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(BASE_URL, wait_until="networkidle")
        no_overflow(page)
        page.screenshot(path=str(RESULTS / "conference-desktop.png"), full_page=True)
        checks.append("Mobile/tablet menu opens, closes with Escape and closes after navigation; no horizontal page overflow at 390/768/1440px")
        assert not failures, f"Browser errors: {failures}"
        checks.append("No uncaught JavaScript errors or application console errors")
        browser.close()
    for index, check in enumerate(checks, start=1):
        print(f"PASS {index}: {check}")
    print(f"Browser smoke test passed: {len(checks)} groups.")


if __name__ == "__main__":
    env = {**os.environ, "PORT": "3001"}
    server = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        for _ in range(40):
            if server.poll() is not None:
                stdout, stderr = server.communicate()
                raise RuntimeError(f"Static server failed: {stdout}{stderr}")
            try:
                with urllib.request.urlopen(BASE_URL, timeout=1) as response:
                    if response.status == 200:
                        break
            except (urllib.error.URLError, OSError):
                time.sleep(0.1)
        else:
            raise RuntimeError("Static server did not become ready")
        run_checks()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
