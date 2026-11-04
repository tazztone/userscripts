"""Integration tests for In-Place Feed Refresh (check for new deals without F5)."""

from playwright.sync_api import Page

from conftest import mock_pricechart


def test_feed_refresh_button_present(page: Page):
    """The 🔄 refresh button is present and visible in the floating CTA."""
    btn = page.locator('#tp-floating-refresh-btn')
    assert btn.is_visible()
    assert 'Feed nach neuen Deals durchsuchen' in (btn.get_attribute('title') or '')


def test_feed_refresh_adds_new_card_and_updates_cta(page: Page):
    """Clicking 🔄 fetches latest HTML, prepends newly arrived deals, and updates CTA."""
    # Set up mock fetch for feed refresh to return existing page + 1 new deal
    page.evaluate("""() => {
        const origFetch = window.fetch;
        window.fetch = async (url, opts) => {
            if (typeof url === 'string' && (url.includes('mock_toppreise.html') || url === location.href)) {
                // Return HTML with a new product card prepended
                const currentHtml = document.documentElement.outerHTML;
                const newCardHtml = `
                    <a href="/preisvergleich/Audio/Sony-WH-1000XM5-p888123" class="Plugin_Product medium-box mixedBrowsingList col-12 col-sm-6 col-lg-4 col-xxxl-3" data-entity-id="888123">
                      <div class="row h-100">
                        <div class="product-name">Sony WH-1000XM5</div>
                        <div class="priceContainer productPrice">
                          <span class="currency">CHF</span>
                          <div class="Plugin_Price">250.00</div>
                        </div>
                        <div class="badge badge-dif"><p>-45%</p></div>
                      </div>
                    </a>
                `;
                const modifiedHtml = currentHtml.replace(
                    /(<a[^>]*id="card-iphone")/,
                    `${newCardHtml}$1`
                );
                return {
                    ok: true,
                    status: 200,
                    text: async () => modifiedHtml
                };
            }
            return origFetch(url, opts);
        };
    }""")

    initial_cards = page.locator('.Plugin_Product').count()

    # Click the refresh button
    page.click('#tp-floating-refresh-btn')

    # Wait for the new card to be attached to the DOM
    page.wait_for_selector('a[data-entity-id="888123"]')
    assert page.locator('.Plugin_Product').count() == initial_cards + 1

    # New card should have the arrival highlight class
    new_card = page.locator('a[data-entity-id="888123"]')
    assert 'tp-fresh-arrival' in (new_card.get_attribute('class') or '')

    # Toast confirms 1 new deal loaded
    last_toast = page.evaluate("() => window.ToppreiseSuite.lastToast()")
    assert '1 neuer Deal' in last_toast


def test_empty_cta_click_triggers_feed_refresh(page: Page):
    """When all deals are checked (0 Tiefstpreise prüfen), clicking the CTA refreshes the feed."""
    mock_pricechart(page, {'797571': 500, '797572': 500, '797573': 500, '797574': 500, '797575': 500, '1003795': 500})

    # Complete initial batch scan so CTA reaches empty state
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#tp-floating-check-cta.tp-empty')
    assert '0 Tiefstpreise prüfen' in (page.locator('#tp-floating-check-main').text_content() or '')

    # Set up mock fetch returning a brand new deal
    page.evaluate("""() => {
        const origFetch = window.fetch;
        window.fetch = async (url, opts) => {
            if (typeof url === 'string' && (url.includes('mock_toppreise.html') || url === location.href)) {
                const currentHtml = document.documentElement.outerHTML;
                const newCardHtml = `
                    <a href="/preisvergleich/Audio/Bose-QC45-p888999" class="Plugin_Product medium-box mixedBrowsingList col-12 col-sm-6 col-lg-4 col-xxxl-3" data-entity-id="888999">
                      <div class="row h-100">
                        <div class="product-name">Bose QC45</div>
                        <div class="priceContainer productPrice">
                          <span class="currency">CHF</span>
                          <div class="Plugin_Price">199.00</div>
                        </div>
                        <div class="badge badge-dif"><p>-50%</p></div>
                      </div>
                    </a>
                `;
                const modifiedHtml = currentHtml.replace(
                    /(<a[^>]*id="card-iphone")/,
                    `${newCardHtml}$1`
                );
                return {
                    ok: true,
                    status: 200,
                    text: async () => modifiedHtml
                };
            }
            return origFetch(url, opts);
        };
    }""")

    # Click the empty CTA main button
    page.click('#tp-floating-check-btn')

    # Wait for the new card to arrive
    page.wait_for_selector('a[data-entity-id="888999"]')

    # The CTA should no longer be in .tp-empty state and should offer to check the new deal!
    page.wait_for_selector('#tp-floating-check-cta:not(.tp-empty)')
    assert '1 Tiefstpreis prüfen' in (page.locator('#tp-floating-check-main').text_content() or '')


def test_feed_refresh_no_new_deals_shows_toast(page: Page):
    """When remote feed has no changes, shows 'Keine neuen Deals gefunden' without DOM churn."""
    page.evaluate("""() => {
        const origFetch = window.fetch;
        window.fetch = async (url, opts) => {
            if (typeof url === 'string' && (url.includes('mock_toppreise.html') || url === location.href)) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => document.documentElement.outerHTML
                };
            }
            return origFetch(url, opts);
        };
    }""")

    initial_count = page.locator('.Plugin_Product').count()
    page.click('#tp-floating-refresh-btn')

    # Verify toast
    page.wait_for_function("() => window.ToppreiseSuite.lastToast() === 'Keine neuen Deals gefunden'")
    assert page.locator('.Plugin_Product').count() == initial_count
