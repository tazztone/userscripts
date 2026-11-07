"""Contract & Site Drift Test Suite

Verifies that userscript SELECTORS and card extraction operate correctly
on real, sanitized Toppreise.ch HTML snapshots (captured via update-fixtures.js).
This test runs completely offline and catches DOM/class drift early.
"""

import os
import re
import pytest
from playwright.sync_api import Page, expect

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
LIVE_NEUE_PATH = os.path.join(FIXTURES_DIR, 'live_neue_toppreise.html')
LIVE_CATEGORY_PATH = os.path.join(FIXTURES_DIR, 'live_category_browsing.html')
LIVE_PRODUCT_PATH = os.path.join(FIXTURES_DIR, 'live_product_detail.html')


def _init_live_page(browser, userscript_content, file_path):
    page = browser.new_page()
    page.set_default_timeout(3000)
    page.on("pageerror", lambda err: pytest.fail(f"Unhandled browser exception: {err}"))
    page.goto(f"file://{file_path}")
    page.add_style_tag(content="*, *::before, *::after { transition: none !important; animation: none !important; }")
    page.evaluate("() => localStorage.clear()")
    page.evaluate("() => { localStorage.setItem('tp_suite_v2_DEBUG', 'true'); localStorage.setItem('tp_suite_v2_MIGRATED_DEBUG_OFF', 'true'); }")
    page.evaluate(userscript_content)
    return page


def test_live_neue_toppreise_structure_and_selectors(browser, userscript_content):
    """Verifies that the live feed layout matches expected card, price, and badge selectors."""
    assert os.path.exists(LIVE_NEUE_PATH), "live_neue_toppreise.html snapshot must exist"

    page = _init_live_page(browser, userscript_content, LIVE_NEUE_PATH)

    # 1. Product cards detection
    cards = page.locator('a.Plugin_Product.medium-box')
    card_count = cards.count()
    assert card_count >= 10, f"Expected at least 10 cards on live feed, found {card_count}"

    # 2. Card internal structure: title, price info, discount badge
    first_card = cards.first
    title = first_card.locator('.product-name').inner_text().strip()
    assert len(title) > 0, "Card title (.product-name) should not be empty"

    price_info = first_card.locator('.Plugin_PriceInformation')
    assert price_info.count() >= 1, "Card should contain .Plugin_PriceInformation"

    price_val = first_card.locator('.Plugin_Price').first.inner_text().strip()
    assert re.search(r'\d+\.\d{2}', price_val), f"Expected numeric price, got '{price_val}'"

    badge = first_card.locator('.badge-dif')
    assert badge.count() >= 1, "Live feed card should carry .badge-dif"
    badge_text = badge.inner_text()
    assert '%' in badge_text, f"Expected discount percentage in badge, got '{badge_text}'"

    # 3. Userscript processing pass
    page.evaluate("() => window.ToppreiseSuite?.processListings?.()")
    # Verify suite chrome is injected and active
    assert page.locator('#tp-root >> #tp-settings-fab').is_visible()

    page.close()


def test_live_category_browsing_structure_and_selectors(browser, userscript_content):
    """Verifies that the live category browsing page matches expected layout and product selectors."""
    assert os.path.exists(LIVE_CATEGORY_PATH), "live_category_browsing.html snapshot must exist"

    page = _init_live_page(browser, userscript_content, LIVE_CATEGORY_PATH)

    # Product cards and/or collections
    products = page.locator('.Plugin_Product, .Plugin_ProductCollItem')
    count = products.count()
    assert count >= 5, f"Expected at least 5 category items, found {count}"

    # Ensure price information is found
    prices = page.locator('.Plugin_PriceInformation, .priceContainer')
    assert prices.count() >= 5, "Expected price information containers on category items"

    # Userscript execution on category view
    page.evaluate("() => window.ToppreiseSuite?.processListings?.()")
    assert page.locator('#tp-root >> #tp-settings-fab').is_visible()

    page.close()


def test_live_product_detail_structure_and_selectors(browser, userscript_content):
    """Verifies that the live product comparison detail page contains expected price and title containers."""
    assert os.path.exists(LIVE_PRODUCT_PATH), "live_product_detail.html snapshot must exist"

    page = _init_live_page(browser, userscript_content, LIVE_PRODUCT_PATH)

    # Price container presence
    prices = page.locator('.Plugin_PriceInformation, .priceContainer')
    assert prices.count() >= 1, "Expected at least one price container on product page"

    # Product heading or name
    title = page.locator('.product-name, h1, .Plugin_ProductHeading').first
    assert title.count() >= 1, "Expected product title container on product detail page"
    assert len(title.inner_text().strip()) > 0

    page.close()


def test_live_neue_toppreise_relevance_hint_and_section_split(browser, userscript_content):
    """Catches live feed layout drift: relevance notice, Weitere Preissenkungen separator,

    and verifies that userscript processes and decorates cards across both sections.
    """
    assert os.path.exists(LIVE_NEUE_PATH), "live_neue_toppreise.html snapshot must exist"

    page = _init_live_page(browser, userscript_content, LIVE_NEUE_PATH)

    # 1. Relevance notice at top of feed
    hint = page.locator('.relevanceHint')
    assert hint.is_visible(), "Expected .relevanceHint notice on live feed"
    hint_text = hint.inner_text().strip()
    assert 'Ohne Kategorie zeigen wir nur gefragte Produkte' in hint_text
    assert 'Kategorie wählen' in hint_text

    # 2. Section divider further down
    sep = page.locator('.fillUpSeparator')
    assert sep.is_visible(), "Expected .fillUpSeparator divider on live feed"
    sep_text = sep.inner_text().strip()
    assert 'Weitere Preissenkungen' in sep_text

    # 3. Verify cards exist in both sections (before and after separator)
    cards = page.locator('a.Plugin_Product.medium-box')
    total = cards.count()
    assert total >= 20, f"Expected at least 20 feed cards, got {total}"

    sep_y = sep.bounding_box()['y']
    before_count = 0
    after_count = 0
    for i in range(total):
        card_y = cards.nth(i).bounding_box()['y']
        if card_y < sep_y:
            before_count += 1
        else:
            after_count += 1

    assert before_count >= 10, f"Expected >= 10 popular cards before separator, got {before_count}"
    assert after_count >= 10, f"Expected >= 10 cards after 'Weitere Preissenkungen', got {after_count}"

    # 4. Run userscript processing pass
    page.evaluate("() => window.ToppreiseSuite?.processListings?.()")

    # 5. Verify cards in both sections are decorated with alarm bells and badges
    for i in range(min(5, before_count)):
        assert cards.nth(i).locator('.tp-card-alarm-btn').count() == 1
    for i in range(before_count, before_count + min(5, after_count)):
        assert cards.nth(i).locator('.tp-card-alarm-btn').count() == 1

    page.close()
