from playwright.sync_api import Page

from conftest import open_settings, mock_pricechart


def test_floating_cta_visible_with_unchecked_deals(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()
    # Mock page ships 3 deals with site discount >= 30% (-67%, -35%, -50%)
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')
    assert 'Echte Tiefstpreise verifizieren' in (cta.text_content() or '')


def test_floating_cta_threshold_syncs_with_toolbar(page: Page):
    thresh_input = page.locator('#tp-floating-threshold-input')
    assert thresh_input.is_visible()
    assert thresh_input.input_value() == '≥30%'

    # Change threshold via floating CTA text input
    thresh_input.fill('40')
    thresh_input.press('Enter')
    assert thresh_input.input_value() == '≥40%'

    # Shared config dispatcher persists the choice
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.REAL_DEAL_MIN_DISCOUNT") == 40

def test_floating_cta_dealer_toggle_syncs_with_settings(page: Page):
    batch_btn = page.locator('#tp-floating-batch-btn')
    assert batch_btn.is_visible()
    batch_btn.click()

    popover = page.locator('#tp-batch-popover')
    assert popover.is_visible()
    toggle = page.locator('#tp-batch-dealer-autofetch')
    assert toggle.is_visible()
    assert not toggle.is_checked()

    # Toggle ON in the batch popover: shared config key flips immediately
    toggle.click()
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.DEALER_AUTOFETCH") is True

    # Settings modal mirrors the same key without a save round-trip
    open_settings(page)
    assert page.locator('#tp-root >> #tp-dealer-autofetch-toggle').is_checked()


def test_floating_cta_runs_batch_check_and_stays_visible_dimmed_when_done(page: Page):
    mock_pricechart(page, {'797571': 500, '797572': 500, '797573': 500, '797574': 500, '797575': 500, '1003795': 500})

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
    assert not page.locator('#tp-floating-threshold-input').is_visible()

    # Clicking the collapsed pill expands instead of checking
    page.locator('#tp-floating-check-btn').click()
    assert 'tp-collapsed' not in (cta.get_attribute('class') or '')
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')

    # The chevron toggles both ways
    collapse.click()
    assert 'tp-collapsed' in (cta.get_attribute('class') or '')
    collapse.click()
    assert 'tp-collapsed' not in (cta.get_attribute('class') or '')


def test_floating_cta_popover_threshold_change_updates_count_and_runs_batch(page: Page):
    # Initial: 3 deals with >= 30% (-67%, -35%, -50%)
    cta = page.locator('#tp-floating-check-cta')
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')

    # Change to >=50% via floating CTA text input
    thresh_input = page.locator('#tp-floating-threshold-input')
    thresh_input.fill('50')
    thresh_input.press('Enter')
    assert thresh_input.input_value() == '≥50%'

    # Count immediately updates: -67% and -50% qualify -> 2
    assert '2 Tiefstpreise prüfen' in (cta.text_content() or '')

    # Clicking runs batch check without "Keine ungeprüften Deals vorhanden" toast
    mock_pricechart(page, {'797571': 500, '797573': 500})
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#tp-floating-check-cta.tp-scanning')
    assert page.locator('#tp-root >> .tp-toast', has_text='Keine ungeprüften Deals vorhanden').count() == 0


def test_floating_cta_clicking_positive_count_never_toasts_no_deals(page: Page):
    # Whenever the floating CTA displays >0 deals, clicking it must launch the scan,
    # never showing "Keine ungeprüften Deals vorhanden" toast.
    cta = page.locator('#tp-floating-check-cta')
    assert '3 Tiefstpreise prüfen' in (cta.text_content() or '')

    mock_pricechart(page, {'797571': 500, '797572': 500, '797573': 500})
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#tp-floating-check-cta.tp-scanning')
    assert page.locator('#tp-root >> .tp-toast', has_text='Keine ungeprüften Deals vorhanden').count() == 0


def test_floating_cta_compact_labels_on_mobile_viewport(page: Page):
    page.set_viewport_size({'width': 390, 'height': 844})
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()

    short_label = page.locator('#tp-floating-check-main .tp-label-short')
    full_label = page.locator('#tp-floating-check-main .tp-label-full')
    assert short_label.is_visible()
    assert not full_label.is_visible()
    assert 'prüfen' in (short_label.text_content() or '')
    assert page.locator('#tp-floating-batch-btn').is_visible()


def test_floating_cta_clears_recent_searches_tray_on_mobile(page: Page):
    page.set_viewport_size({'width': 390, 'height': 844})
    margin = page.evaluate("""() => {
        const div = document.createElement('div');
        div.className = 'Plugin_LastSearchTerms';
        document.body.appendChild(div);
        const style = window.getComputedStyle(div);
        const mb = parseFloat(style.marginBottom);
        div.remove();
        return mb;
    }""")
    assert margin >= 48


def test_floating_cta_no_overflow_or_fab_overlap_on_narrow_coarse_mobile(browser, userscript_content):
    """Narrow coarse viewports (360px, 390px) keep CTA children inside container without FAB collision."""
    from conftest import MOCK_HTML

    for vw, vh in ((360, 640), (390, 844)):
        context = browser.new_context(is_mobile=True, has_touch=True, viewport={'width': vw, 'height': vh})
        m_page = context.new_page()
        try:
            m_page.set_default_timeout(2500)
            m_page.goto(MOCK_HTML)
            m_page.evaluate("""() => {
                localStorage.clear();
                localStorage.setItem('tp_suite_v2_DEBUG', 'true');
                localStorage.setItem('tp_suite_v2_MIGRATED_DEBUG_OFF', 'true');
            }""")
            m_page.evaluate(userscript_content)
            m_page.wait_for_selector('#tp-root >> #tp-settings-fab')
            m_page.wait_for_selector('#tp-floating-check-cta')

            metrics = m_page.evaluate("""() => {
                const cta = document.getElementById('tp-floating-check-cta');
                const ctaRect = cta.getBoundingClientRect();
                const fabRect = document.getElementById('tp-root').shadowRoot.getElementById('tp-settings-fab').getBoundingClientRect();
                const visibleChildren = Array.from(cta.querySelectorAll('#tp-floating-check-btn, #tp-floating-batch-btn, #tp-floating-refresh-btn, #tp-floating-threshold-input, #tp-floating-cta-collapse'))
                    .map(el => ({ id: el.id, right: el.getBoundingClientRect().right, left: el.getBoundingClientRect().left }));
                return {
                    scrollW: cta.scrollWidth,
                    clientW: cta.clientWidth,
                    ctaRight: ctaRect.right,
                    fabLeft: fabRect.left,
                    clipped: visibleChildren.filter(c => c.right > ctaRect.right + 1 || c.left < ctaRect.left - 1)
                };
            }""")
            assert metrics['scrollW'] <= metrics['clientW'], f"CTA overflows at {vw}px: {metrics}"
            assert metrics['clipped'] == [], f"CTA children clipped at {vw}px: {metrics}"
            assert metrics['ctaRight'] <= metrics['fabLeft'] + 1, f"CTA overlaps FAB at {vw}px: {metrics}"
        finally:
            m_page.close()
            context.close()




