from urllib.parse import quote

from playwright.sync_api import Page, expect

from conftest import open_settings, seed_verified_deal


def _google_url(name, keyword=None):
    query = f'{name} {keyword}' if keyword is not None else name
    return 'https://www.google.com/search?q=' + quote(query)


DEFAULT_KEYWORD = 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
DEFAULT_UNVERIFIED_QUERY = 'Testberichte zu: Nvidia GeForce RTX 4090 24GB. Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'


def test_review_icon_per_card_default(page: Page):
    """Every card ends its product name with 🌐 linking to '<name> <default keyword>'."""
    btns = page.locator('a.tp-review-search-btn')
    assert btns.count() >= 2

    first = page.locator('#card-cheapest a.tp-review-search-btn')
    assert first.count() == 1
    assert first.text_content() == '🌐'
    assert first.get_attribute('target') == '_blank'
    # Default question clause with {preis} is gracefully dropped on unverified card
    assert first.get_attribute('href') == _google_url(DEFAULT_UNVERIFIED_QUERY)

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
        _google_url(DEFAULT_UNVERIFIED_QUERY)
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == DEFAULT_KEYWORD
    page.click('#tp-root >> #tp-btn-close')


def test_review_ai_mode_appends_udm50(page: Page):
    """AI checkbox keeps the keyword suffix and opens Google AI Mode."""
    open_settings(page)
    page.click('#tp-root >> #tp-review-ai-mode-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    first = page.locator('#card-cheapest a.tp-review-search-btn')
    assert first.get_attribute('href') == \
        _google_url(DEFAULT_UNVERIFIED_QUERY) + '&udm=50'

    # Uncheck -> suffix gone
    open_settings(page)
    page.click('#tp-root >> #tp-review-ai-mode-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url(DEFAULT_UNVERIFIED_QUERY)


def test_review_legacy_ki_modus_migrates(page: Page, userscript_content):
    """Stored legacy 'KI-Modus' migrates to checkbox-on plus new default keyword."""
    page.evaluate("localStorage.setItem('tp_suite_v2_REVIEW_SEARCH_KEYWORD', '\"KI-Modus\"')")
    page.reload()
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url(DEFAULT_UNVERIFIED_QUERY) + '&udm=50'
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-ai-mode-toggle').is_checked()
    assert page.locator('#tp-root >> #tp-review-keyword-input').input_value() == DEFAULT_KEYWORD
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


def test_review_keyword_reset_to_default(page: Page):
    """The ↺ Standard button resets the keyword input and preview back to default."""
    open_settings(page)
    input_el = page.locator('#tp-root >> #tp-review-keyword-input')
    preview_el = page.locator('#tp-root >> #tp-review-keyword-preview')

    input_el.fill('Eigene Suche')
    assert preview_el.inner_text() == 'Sony WH-1000XM5 Eigene Suche'

    page.click('#tp-root >> #tp-review-keyword-reset')
    assert input_el.input_value() == 'Testberichte zu: [Produkt]. Ist der Preis von {preis} ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    assert preview_el.inner_text() == 'Testberichte zu: Sony WH-1000XM5. Ist der Preis von CHF 279.00 ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    page.click('#tp-root >> #tp-btn-close')


def test_review_keyword_live_preview(page: Page):
    """Live preview reacts immediately to input, showing/hiding no-price variant."""
    open_settings(page)
    preview_price = page.locator('#tp-root >> #tp-review-keyword-preview')
    preview_noprice = page.locator('#tp-root >> #tp-review-keyword-preview-noprice')
    noprice_row = page.locator('#tp-root >> #tp-review-keyword-preview-noprice-row')

    assert preview_price.inner_text() == 'Testberichte zu: Sony WH-1000XM5. Ist der Preis von CHF 279.00 ein guter Deal? Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    assert preview_noprice.inner_text() == 'Testberichte zu: Sony WH-1000XM5. Bewerte Preis-Leistung, Stärken und Schwächen kurz auf Deutsch.'
    assert noprice_row.is_visible()

    page.fill('#tp-root >> #tp-review-keyword-input', 'Kaufberatung')
    assert preview_price.inner_text() == 'Sony WH-1000XM5 Kaufberatung'
    assert not noprice_row.is_visible()
    page.click('#tp-root >> #tp-btn-close')


def test_review_section_renamed_web_suche(page: Page):
    open_settings(page)
    expect(page.locator('#tp-root >> #tp-section-review .tp-section-title')).to_have_text('🌐 Web-Suche')
    page.click('#tp-root >> #tp-btn-close')


def test_tavily_key_settings_lifecycle(page: Page):
    """Tavily key can be revealed, entered, saved, and displayed as configured."""
    open_settings(page)
    status = page.locator('#tp-root >> #tp-tavily-api-key-status')
    assert status.text_content() == 'Kein Key hinterlegt'

    reveal_btn = page.locator('#tp-root >> #tp-tavily-api-key-reveal')
    editor = page.locator('#tp-root >> #tp-tavily-api-key-editor')
    input_field = page.locator('#tp-root >> #tp-tavily-api-key-input')

    assert reveal_btn.is_visible()
    expect(editor).to_be_hidden()

    reveal_btn.click()
    expect(editor).to_be_visible()
    expect(reveal_btn).to_be_hidden()

    input_field.fill('tvly-testkey-123456')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    # Reopen and check status indicator (Bearer secrets stay masked in page window.ToppreiseSuite.CONFIG)
    open_settings(page)
    assert page.locator('#tp-root >> #tp-tavily-api-key-status').text_content() == '✅ Key hinterlegt'
    page.click('#tp-root >> #tp-btn-close')


def test_review_ai_popover_open_and_close(page: Page):
    """Clicking 🌐 with configured Tavily key opens AI popover; Escape key closes it."""
    btn = page.locator('#card-cheapest a.tp-review-search-btn')
    assert btn.count() == 1

    # Negative path: without Tavily key, clicking 🌐 emits guidance toast and does not mount popover
    btn.dispatch_event('click')
    assert page.locator('#tp-ai-popout').count() == 0
    assert 'Kostenlosen Tavily-Key' in page.evaluate("() => window.ToppreiseSuite?.lastToast?.() || ''")

    # Positive path: seed key into userscript internal CONFIG via updateConfig harness
    page.evaluate("() => window.ToppreiseSuite?.updateConfig?.('TAVILY_API_KEY', 'tvly-mock-test')")

    # Clicking 🌐 intercepts default navigation and opens #tp-ai-popout
    btn.dispatch_event('click')
    popout = page.locator('#tp-ai-popout')
    page.wait_for_selector('#tp-ai-popout', state='visible')
    assert popout.is_visible()
    assert 'KI-Kurzfazit' in popout.text_content()
    assert 'Nvidia GeForce RTX 4090 24GB' in popout.text_content()

    # Escape closes popover
    page.keyboard.press('Escape')
    page.wait_for_selector('#tp-ai-popout', state='detached')
    assert page.locator('#tp-ai-popout').count() == 0


def test_tavily_parameters_settings_lifecycle(page: Page):
    """Tavily search depth and max results can be configured and persisted."""
    open_settings(page)
    depth_select = page.locator('#tp-root >> #tp-tavily-search-depth')
    max_select = page.locator('#tp-root >> #tp-tavily-max-results')

    assert depth_select.input_value() == 'basic'
    assert max_select.input_value() == '5'

    depth_select.select_option('advanced')
    max_select.select_option('8')

    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.TAVILY_SEARCH_DEPTH") == 'advanced'
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.TAVILY_MAX_RESULTS") == 8

    # Reopen and check UI state
    open_settings(page)
    assert page.locator('#tp-root >> #tp-tavily-search-depth').input_value() == 'advanced'
    assert page.locator('#tp-root >> #tp-tavily-max-results').input_value() == '8'
    page.click('#tp-root >> #tp-btn-close')

