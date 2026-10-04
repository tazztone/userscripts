from playwright.sync_api import Page


def test_floating_cta_visible_with_unchecked_deals(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()
    # Mock page ships 3 deals with site discount >= 30% (-67%, -35%, -50%)
    assert '3 Deals prüfen' in (cta.text_content() or '')
    assert 'Echte Tiefstpreise verifizieren' in (cta.text_content() or '')


def test_floating_cta_threshold_syncs_with_toolbar(page: Page):
    thresh_btn = page.locator('#tp-floating-threshold-btn')
    assert '≥30%' in (thresh_btn.text_content() or '')

    # Change threshold via floating CTA popover
    thresh_btn.click()
    page.click('#tp-floating-threshold-popover .tp-floating-option[data-val="40"]')
    assert '≥40%' in (thresh_btn.text_content() or '')

    # Shared config dispatcher persists the choice
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.REAL_DEAL_MIN_DISCOUNT") == 40


def test_floating_cta_runs_batch_check_and_hides_when_done(page: Page):
    def handle_pricechart(route):
        route.fulfill(
            status=200,
            headers={'access-control-allow-origin': '*'},
            content_type='text/html',
            body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">500.00</div></div>'
        )

    page.route('**/plugins/product/pricechart*', handle_pricechart)

    page.click('#tp-floating-check-btn')
    # Scanning state with cancel hint
    page.wait_for_selector('#tp-floating-check-cta.tp-scanning')
    assert 'Abbrechen' in (page.locator('#tp-floating-check-cta').text_content() or '')

    # Completes and auto-hides once nothing is left to check
    page.wait_for_selector('#tp-floating-check-cta', state='hidden')
    assert not page.locator('#tp-floating-check-cta').is_visible()


def test_floating_cta_dismiss_with_undo(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()

    page.click('#tp-floating-cta-dismiss')
    assert not cta.is_visible()

    # Undo toast restores it within the same session
    toast = page.locator('#tp-root >> .tp-toast').last
    assert 'ausgeblendet' in (toast.text_content() or '')
    page.click('#tp-root >> .tp-toast-undo')
    assert cta.is_visible()
