from playwright.sync_api import Page


def test_floating_cta_visible_with_unchecked_deals(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()
    # Mock page ships 3 deals with site discount >= 30% (-67%, -35%, -50%)
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')
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


def test_floating_cta_runs_batch_check_and_stays_visible_dimmed_when_done(page: Page):
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

    # Completes and stays visible in dimmed empty form (never auto-hides)
    page.wait_for_selector('#tp-floating-check-cta.tp-empty')
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()
    assert '0 Tiefstpreise prüfen' in (page.locator('#tp-floating-check-main').text_content() or '')


def test_floating_cta_collapses_but_never_closes(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()

    # No dismiss affordance anymore — only collapse
    assert page.locator('#tp-floating-cta-dismiss').count() == 0
    collapse = page.locator('#tp-floating-cta-collapse')

    # Collapse: pill shrinks to a 🔍 N count, threshold tucks away
    collapse.click()
    assert 'tp-collapsed' in (cta.get_attribute('class') or '')
    assert cta.is_visible()
    assert page.locator('#tp-floating-check-count').text_content() == '🔍 3'
    assert not page.locator('#tp-floating-threshold-btn').is_visible()

    # Clicking the collapsed pill expands instead of checking
    page.locator('#tp-floating-check-btn').click()
    assert 'tp-collapsed' not in (cta.get_attribute('class') or '')
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')

    # The chevron toggles both ways
    collapse.click()
    assert 'tp-collapsed' in (cta.get_attribute('class') or '')
    collapse.click()
    assert 'tp-collapsed' not in (cta.get_attribute('class') or '')
