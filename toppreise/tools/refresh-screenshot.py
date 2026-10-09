"""Regenerate toppreise/Screenshot.webp from the live feed with the current bundle.

Usage (repo root): toppreise/tools/refresh-screenshot.sh

Requires an active display (headed Chrome: the site's WAF 403s automated
clients) and pillow in the venv (run prerequisite, not a repo dependency):
    venv/bin/pip install pillow
"""

import os
import re
import sys
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(os.path.dirname(BASE_DIR), "toppreise.user.js")
OUT_PATH = os.path.join(os.path.dirname(BASE_DIR), "Screenshot.webp")
FEED_URL = "https://www.toppreise.ch/neue-toppreise"
MOUNT_SELECTOR = "#tp-root >> #tp-settings-fab"
RESULT_SELECTOR = ".tp-is-verified, .tp-deal-alltime-low, .tp-deal-not-low, .tp-deal-new-record"
UNVERIFIED_BADGE = (
    ".badge-dif:not(.tp-deal-alltime-low):not(.tp-deal-not-low)"
    ":not(.tp-deal-new-record):not(.tp-deal-loading)"
)


def main():
    with open(BUNDLE_PATH, encoding="utf-8") as f:
        bundle = f.read()

    with sync_playwright() as p:
        # Headed with automation flags stripped: the site's WAF 403s
        # headless/automated clients even from allowed networks.
        # Requires an active display (this workstation's :0).
        browser = p.chromium.launch(
            channel="chrome",
            headless=False,
            ignore_default_args=["--enable-automation"],
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
        try:
            page.goto(FEED_URL)
            try:
                page.get_by_role(
                    "button",
                    name=re.compile(r"akzeptieren|einverstanden|zustimmen|accept", re.I),
                ).first.click(timeout=5000)
            except Exception:
                pass
            page.add_script_tag(content=bundle)
            page.wait_for_selector(MOUNT_SELECTOR, timeout=30000)
            # Fail fast on bot-wall pages: the FAB is suite DOM so mount
            # succeeds even when the feed renders no deal cards.
            page.wait_for_selector(".badge-dif", timeout=30000)
            badges = page.locator(UNVERIFIED_BADGE)
            for i in range(min(3, badges.count())):
                badge = badges.nth(i)
                if badge.is_visible():
                    badge.click()
            page.wait_for_selector(RESULT_SELECTOR, timeout=120000)
            page.wait_for_timeout(1000)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = tmp.name
            page.screenshot(path=tmp_path, type="png")
        finally:
            browser.close()

    with Image.open(tmp_path) as img:
        img.save(OUT_PATH, "WEBP", quality=90, method=6)
    os.unlink(tmp_path)
    print(f"Screenshot written to {OUT_PATH}")


if __name__ == "__main__":
    sys.exit(main())
