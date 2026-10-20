from urllib.parse import quote

from playwright.sync_api import Page, expect

from conftest import open_settings, seed_verified_deal


def _google_url(name, keyword):
    return 'https://www.google.com/search?q=' + quote(f'{name} {keyword}')


def test_review_icon_per_card_default_testbericht(page: Page):
    """Every card ends its product name with 🌐 linking to '<name> Testbericht'."""
    btns = page.locator('a.tp-review-search-btn')
    assert btns.count() >= 2

    first = page.locator('#card-cheapest a.tp-review-search-btn')
    assert first.count() == 1
    assert first.text_content() == '🌐'
    assert first.get_attribute('target') == '_blank'
    assert first.get_attribute('href') == _google_url('Nvidia GeForce RTX 4090 24GB', 'Testbericht')

    # Icon sits at the end of the product name, not floating on the card
    assert page.evaluate(
        "() => document.querySelector('#card-cheapest .product-name').lastElementChild?.className"
    ) == 'tp-review-search-btn'


def test_review_section_visible(page: Page):
    open_settings(page)
    assert page.locator('#tp-root >> #tp-section-review').is_visible()


def test_review_toggle_removes_buttons(page: Page):
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-search-toggle').is_checked()

    # Disable -> icons gone without reload
    page.click('#tp-root >> #tp-review-search-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('a.tp-review-search-btn').count() == 0


def test_review_custom_keyword_persists(page: Page, userscript_content):
    open_settings(page)
    page.fill('#tp-root >> #tp-review-keyword-input', 'Erfahrungen')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Erfahrungen')

    # Reload: keyword persists via the localStorage mirror
    page.reload()
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Erfahrungen')
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == 'Erfahrungen'
    page.click('#tp-root >> #tp-btn-close')


def test_review_empty_keyword_falls_back_to_default(page: Page):
    open_settings(page)
    page.fill('#tp-root >> #tp-review-keyword-input', '')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Testbericht')
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == 'Testbericht'
    page.click('#tp-root >> #tp-btn-close')


def test_review_ai_mode_appends_udm50(page: Page):
    """AI checkbox keeps the keyword suffix and opens Google AI Mode."""
    open_settings(page)
    page.click('#tp-root >> #tp-review-ai-mode-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    first = page.locator('#card-cheapest a.tp-review-search-btn')
    assert first.get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Testbericht') + '&udm=50'

    # Uncheck -> suffix gone
    open_settings(page)
    page.click('#tp-root >> #tp-review-ai-mode-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Testbericht')


def test_review_legacy_ki_modus_migrates(page: Page, userscript_content):
    """Stored legacy 'KI-Modus' migrates to checkbox-on plus keyword Testbericht."""
    page.evaluate("localStorage.setItem('tp_suite_v2_REVIEW_SEARCH_KEYWORD', '\"KI-Modus\"')")
    page.reload()
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Testbericht') + '&udm=50'
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-ai-mode-toggle').is_checked()
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == 'Testbericht'
    page.click('#tp-root >> #tp-btn-close')


def test_review_price_token_expands_when_verified(page: Page):
    """{preis} expands to the verified card price (CHF) in the search query."""
    seed_verified_deal(page)  # pid 797571, mock card price CHF 1800.00
    open_settings(page)
    page.fill('#tp-root >> #tp-review-keyword-input', 'Preiseinschätzung {preis}')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Preiseinschätzung CHF 1800.00')


def test_review_price_token_dropped_when_unverified(page: Page):
    """Without verified history the token is dropped — no literal, no price."""
    open_settings(page)
    page.fill('#tp-root >> #tp-review-keyword-input', 'Preiseinschätzung {preis}')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    href = page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href')
    assert href == _google_url('Nvidia GeForce RTX 4090 24GB', 'Preiseinschätzung')
    assert 'CHF' not in href
    assert '%7Bpreis%7D' not in href


def test_review_keyword_token_chip_inserts(page: Page):
    """The {preis} chip inserts the token at the input's cursor (end)."""
    open_settings(page)
    page.click('#tp-root >> #tp-search-keyword-chips [data-token]')
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == 'Testbericht{preis}'
    page.click('#tp-root >> #tp-btn-close')


def test_review_keyword_preset_replaces_value(page: Page):
    """Preset click replaces the keyword; save keeps href expansion working."""
    open_settings(page)
    page.click('#tp-root >> #tp-search-keyword-chips [data-preset="Preiseinschätzung {preis}"]')
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == 'Preiseinschätzung {preis}'
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    href = page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href')
    assert href == _google_url('Nvidia GeForce RTX 4090 24GB', 'Preiseinschätzung')


def test_review_section_renamed_web_suche(page: Page):
    open_settings(page)
    expect(page.locator('#tp-root >> #tp-section-review .tp-section-title')).to_have_text('🌐 Web-Suche')
    page.click('#tp-root >> #tp-btn-close')
