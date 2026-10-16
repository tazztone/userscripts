"""Lifecycle regression suite for the review-fixes plan (steps 2/5/6/7/16).

Bundle-first: the shared `page` fixture evaluates the built bundle, so rebuild
(`node tools/build.js`) before running.
"""
import json
import time

from playwright.sync_api import Page

from conftest import open_filter_popover, seed_verified_deal

CARD = '#card-cheapest'
BADGE = '#card-cheapest .badge-dif'
DIALOG = '#mock-alarm-dialog'


def _shipping_series(low=1700, high=1900):
    now = int(time.time() * 1000)
    day = 86400 * 1000
    return [
        [[now - 5 * day, high], [now - 4 * day, high - 50], [now - 3 * day, high - 100],
         [now - 2 * day, high - 150], [now - 1 * day, high - 180], [now, low]],
        [[now - 5 * day, high], [now - 4 * day, high - 50], [now - 3 * day, high - 100],
         [now - 2 * day, high - 150], [now - 1 * day, high - 180], [now, low]],
    ]


def test_price_node_replacement_invalidates_memo(page: Page):
    """Step 2: replacing the host price node rebuilds the memo (no stale repaint)."""
    seed_verified_deal(page, '797571', {'tiefstpreis': 1700, 'hoechstpreis': 2600, 'medianPrice': 3600})
    old = page.evaluate("""() => {
        const card = document.querySelector('#card-cheapest');
        const info = card._tpPriceInfo;
        return { has: !!info, text: info?.mainShipping?.textContent?.trim() || null };
    }""")
    assert old['has'] is True
    assert old['text'] == '1800.00'

    page.evaluate("""() => {
        const card = document.querySelector('#card-cheapest');
        const container = card.querySelector('.priceContainer.shippingPrice');
        const fresh = document.createElement('div');
        fresh.className = 'Plugin_Price';
        fresh.textContent = '1700.00';
        container.replaceChild(fresh, container.querySelector('.Plugin_Price'));
    }""")
    page.wait_for_function("""() => {
        const info = document.querySelector('#card-cheapest')._tpPriceInfo;
        return !!info && (info.mainShipping?.textContent || '').trim() === '1700.00';
    }""")

    badge_cls = page.locator(BADGE).get_attribute('class') or ''
    badge_text = page.locator(BADGE).text_content() or ''
    card_cls = page.locator(CARD).get_attribute('class') or ''
    assert 'tp-deal-alltime-low' in badge_cls or 'tp-is-verified' in card_cls or '⚖️' in badge_text


def test_reused_card_rejects_earlier_request_badge(page: Page):
    """Step 5: a card re-keyed mid-request never paints the earlier pid's badge."""
    series = _shipping_series()
    held_routes = []
    page.route('**/plugins/product/pricechart', lambda route: held_routes.append(route))

    with page.expect_request('**/plugins/product/pricechart'):
        page.locator(BADGE).click()
    page.wait_for_function("() => true")
    assert len(held_routes) == 1

    # Re-key the card to another product while the 797571 request is in flight.
    page.evaluate("""() => {
        const card = document.querySelector('#card-cheapest');
        card.dataset.entityId = '797572';
        card.setAttribute('href', '/preisvergleich/Grafikkarten/Nvidia-RTX-4080-p797572');
    }""")
    held_routes[0].fulfill(status=200, content_type='application/json', body=json.dumps(series))
    page.wait_for_function("() => window.ToppreiseSuite.memoryCache.size > 0")
    badge_cls = page.locator(BADGE).get_attribute('class') or ''
    assert 'tp-deal-alltime-low' not in badge_cls

def test_alarm_missing_controls_schedules_nothing(page: Page):
    """Step 6: without a price input there is no fill, no submit, no processed flag."""
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ALARM_AUTO_SUBMIT = true;
        document.querySelector('#mock-alarm-dialog input#f_NewInfoMailForm_priceFrom')?.remove();
        delete document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm').dataset.tpAlarmProcessed;
        delete document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm').dataset.tpAlarmState;
        document.querySelector('#mock-alarm-dialog').style.display = 'block';
        window.ToppreiseSuite.processPriceAlarmModal();
    }""")
    page.evaluate("() => new Promise(r => setTimeout(r, 50))")
    state = page.evaluate("""() => ({
        submitted: document.querySelector('#mock-alarm-dialog').dataset.submitted || null,
        processed: document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm').dataset.tpAlarmProcessed || null,
    })""")
    assert state['submitted'] is None
    assert state['processed'] is None


def test_alarm_unconfirmed_submit_keeps_dialog_open_with_warning(page: Page):
    """Step 7: detachment-without-success never closes; the 5s fallback warns instead."""
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ALARM_FALLBACK_TIMEOUT_MS = 50;
        window.ToppreiseSuite.CONFIG.ALARM_AUTO_SUBMIT = true;
        // Unconfirmed path: mock detaches the button without AJAX success.
        window.__tpMockAlarmSuccess = false;
        delete document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm').dataset.tpAlarmProcessed;
        delete document.querySelector('#mock-alarm-dialog .Plugin_NewInfoMailForm').dataset.tpAlarmState;
        document.querySelector('#mock-alarm-dialog').style.display = 'block';
    }""")
    # Fill-only proof: 1000.00 * 60% target lands in the input.
    assert page.locator(f'{DIALOG} input#f_NewInfoMailForm_priceFrom').input_value() == '600.00'
    page.wait_for_function(
        "() => document.querySelector('#mock-alarm-dialog').dataset.submitted === 'true'")
    page.wait_for_selector(f'{DIALOG} .tp-alarm-status', state='visible', timeout=2000)
    status = page.locator(f'{DIALOG} .tp-alarm-status').text_content() or ''
    assert 'nicht bestätigt' in status
    dialog = page.locator(DIALOG)
    assert dialog.is_visible()
    assert page.evaluate("() => document.querySelector('#mock-alarm-dialog').dataset.dialogClosed || null") is None


def test_escape_blurs_negative_input(page: Page):
    """Step 16: Escape leaves the negative input even while typing in it."""
    open_filter_popover(page)
    page.locator('#tp-inline-negative-input').click()
    page.keyboard.type('gar')
    assert page.evaluate("() => document.activeElement?.id") == 'tp-inline-negative-input'
    page.keyboard.press('Escape')
    assert page.evaluate("() => document.activeElement?.id") != 'tp-inline-negative-input'
