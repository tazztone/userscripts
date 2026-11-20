"""Playwright helper to capture Toppreise category view fixtures (box / expe).

Usage:
    venv/bin/python toppreise/tools/capture-view-fixtures.py <category_url> <box|expe> [--out PATH]
"""

import argparse
import os
import re
import sys
from pathlib import Path

local_browsers = Path(__file__).resolve().parents[2] / '.playwright-browsers'
if local_browsers.is_dir():
    os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(local_browsers))

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

COOKIE_RE = re.compile(r"akzeptieren|einverstanden|zustimmen|accept", re.I)

VIEW_CONFIG = {
    'box': {
        'click_selector': '.f_listIcon.f_gallery, [data-value="box"]',
        'wait_selector': '.standardList.box .Plugin_Product, .standardList.box .Plugin_ProductCollItem',
    },
    'expe': {
        'click_selector': '.f_listIcon.f_expert, [data-value="expe"]',
        'wait_selector': '.standardList.expert .Plugin_Product, .standardList.expert .Plugin_ProductCollItem',
    },
}


def dismiss_cookie_banner(page):
    try:
        btn = page.get_by_role('button', name=COOKIE_RE).first
        if btn.is_visible(timeout=2000):
            btn.click(timeout=2000)
            page.wait_for_timeout(300)
    except Exception:
        pass


def capture_view(url: str, view: str) -> str:
    cfg = VIEW_CONFIG[view]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                user_agent='Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
                locale='de-CH',
                viewport={'width': 1440, 'height': 900},
            )
            page = context.new_page()
            page.goto(url, wait_until='domcontentloaded', timeout=30000)

            body_text = page.locator('body').inner_text(timeout=5000) if page.locator('body').count() else ''
            if 'Attention Required' in body_text or 'cf-challenge' in page.content():
                raise RuntimeError('Blocked by WAF/Cloudflare challenge in headless browser')

            dismiss_cookie_banner(page)

            toggle = page.locator(cfg['click_selector']).first
            toggle.wait_for(state='visible', timeout=10000)
            toggle.click()

            page.locator(cfg['wait_selector']).first.wait_for(state='visible', timeout=15000)
            page.wait_for_load_state('networkidle', timeout=5000)
            return '<!DOCTYPE html>\n' + page.evaluate('() => document.documentElement.outerHTML')
        except PlaywrightTimeoutError as exc:
            raise RuntimeError(f'Timed out switching to {view} view on {url}: {exc}') from exc
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(description='Capture Toppreise category view HTML via Playwright')
    parser.add_argument('url', help='Category browsing URL')
    parser.add_argument('view', choices=['box', 'expe'], help='Target view mode')
    parser.add_argument('--out', help='Optional output file path (defaults to stdout)')
    args = parser.parse_args()

    html = capture_view(args.url, args.view)
    if args.out:
        Path(args.out).write_text(html, encoding='utf-8')
    else:
        sys.stdout.write(html)


if __name__ == '__main__':
    main()
