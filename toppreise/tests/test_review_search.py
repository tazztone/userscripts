from urllib.parse import quote

from playwright.sync_api import Page, expect

from conftest import open_settings


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


def test_review_toggle_and_keyword_persist(page: Page, userscript_content):
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-search-toggle').is_checked()
    assert page.locator('#tp-root >> #tp-review-keyword-testbericht').is_checked()

    # Disable -> icons gone without reload
    page.click('#tp-root >> #tp-review-search-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.locator('a.tp-review-search-btn').count() == 0

    # Re-enable with Review keyword -> hrefs switch
    open_settings(page)
    page.click('#tp-root >> #tp-review-search-toggle + .tp-slider')
    page.click('#tp-root >> label[for="tp-review-keyword-review"]')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    first = page.locator('#card-cheapest a.tp-review-search-btn')
    assert first.count() == 1
    assert first.get_attribute('href') == _google_url('Nvidia GeForce RTX 4090 24GB', 'Review')

    # Reload: setting + keyword persist via the localStorage mirror
    page.reload()
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    assert page.locator('#card-cheapest a.tp-review-search-btn').get_attribute('href') == \
        _google_url('Nvidia GeForce RTX 4090 24GB', 'Review')
    open_settings(page)
    assert page.locator('#tp-root >> #tp-review-search-toggle').is_checked()
    assert page.locator('#tp-root >> #tp-review-keyword-review').is_checked()
    page.click('#tp-root >> #tp-btn-close')
