from playwright.sync_api import Page, expect

from conftest import open_settings, seed_verified_deal, open_filter_popover, import_config



def test_shadow_dom_settings_dialog_open_and_close(page: Page):
    fab = page.locator('#tp-root >> #tp-settings-fab')
    dialog = page.locator('#tp-root >> #tp-settings-dialog')

    assert not dialog.is_visible()

    fab.click()
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    assert dialog.is_visible()

    # Close with close button
    page.click('#tp-root >> #tp-btn-close')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert not dialog.is_visible()


def test_settings_dialog_does_not_close_on_backdrop_click(page: Page):
    dialog = page.locator('#tp-root >> #tp-settings-dialog')
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    assert dialog.bounding_box()  # viewport corner sits outside the dialog box

    # Clicking outside should NOT dismiss settings modal
    page.mouse.click(5, 5)
    page.wait_for_timeout(200)
    assert dialog.is_visible()

    # Abbrechen closes the modal
    page.click('#tp-root >> #tp-btn-close')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')



def test_modal_has_no_display_mode_radios(page: Page):
    open_settings(page)

    # Display-mode radios are gone: Filtern removes, Ansicht paints — zero tp-mode inputs
    assert page.locator('#tp-root >> input[name="tp-mode"]').count() == 0
    page.click('#tp-root >> #tp-btn-save')

    # Dialog still closes normally
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')



def test_pruef_vorauswahl_threshold_persists(page: Page):
    # Strictness lives in the Tiefstpreise mode now: no separate filter toggle
    # in the modal anymore, but the Prüf-Vorauswahl threshold must persist.
    open_settings(page)

    # Removed strictness toggle stays gone
    assert page.locator('#tp-root >> #tp-real-deal-filter-toggle').count() == 0

    # Threshold still exists with default 30
    min_discount_input = page.locator('#tp-root >> #tp-real-deal-min-val')
    assert min_discount_input.input_value() == '30'

    # Set threshold to 40 and save
    min_discount_input.fill('40')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    open_settings(page)
    assert page.locator('#tp-root >> #tp-real-deal-min-val').input_value() == '40'
    page.click('#tp-root >> #tp-btn-close')

def test_shipping_basis_toggle_persists(page: Page):
    open_settings(page)
    toggle = page.locator('#tp-root >> #tp-shipping-toggle')
    initial = toggle.is_checked()
    # Toggle via slider click (checkbox itself is visually hidden)
    page.click('#tp-root >> #tp-shipping-toggle + .tp-slider')
    assert toggle.is_checked() != initial
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.USE_SHIPPING_PRICE") != initial
    open_settings(page)
    assert page.locator('#tp-root >> #tp-shipping-toggle').is_checked() != initial
    page.click('#tp-root >> #tp-btn-close')


def test_hide_ads_toggle_persists(page: Page):
    # Default is enabled: html has .tp-hide-ads and ad container is hidden
    assert page.evaluate("() => document.documentElement.classList.contains('tp-hide-ads')")
    ad_box = page.locator('#advertising_mobile')
    expect(ad_box).to_be_hidden()

    open_settings(page)
    toggle = page.locator('#tp-root >> #tp-hide-ads-toggle')
    assert toggle.is_checked() is True

    # Turn off via slider click
    page.click('#tp-root >> #tp-hide-ads-toggle + .tp-slider')
    assert toggle.is_checked() is False
    # Live preview immediately removes .tp-hide-ads
    assert not page.evaluate("() => document.documentElement.classList.contains('tp-hide-ads')")

    # Save and verify persistence
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.HIDE_ADS") is False

    open_settings(page)
    assert page.locator('#tp-root >> #tp-hide-ads-toggle').is_checked() is False
    # Turn back on and save
    page.click('#tp-root >> #tp-hide-ads-toggle + .tp-slider')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.HIDE_ADS") is True
    expect(ad_box).to_be_hidden()


def test_escape_clears_webhook_editor(page: Page):
    open_settings(page)
    page.click('#tp-root >> #tp-discord-webhook-reveal')
    page.fill('#tp-root >> #tp-discord-webhook-input', 'https://discord.com/api/webhooks/123/abc')
    page.keyboard.press('Escape')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    open_settings(page)
    page.click('#tp-root >> #tp-discord-webhook-reveal')
    assert page.locator('#tp-root >> #tp-discord-webhook-input').input_value() == ''
    page.click('#tp-root >> #tp-btn-close')



def test_slash_key_focuses_negative_filter(page: Page):
    filter_bar = page.locator('#tp-suite-filter-bar')
    assert filter_bar.is_visible()

    # Make sure focus is on body
    page.evaluate("() => document.body.focus()")
    page.keyboard.press('/')

    assert 'tp-show' in (page.locator('#tp-bar-filter-popover').get_attribute('class') or '')
    is_focused = page.evaluate("() => document.activeElement?.id === 'tp-inline-negative-input'")
    assert is_focused



def test_escape_blurs_negative_filter(page: Page):
    open_filter_popover(page)
    input_el = page.locator('#tp-inline-negative-input')
    input_el.focus()
    assert page.evaluate("() => document.activeElement?.id === 'tp-inline-negative-input'")

    page.keyboard.press('Escape')
    assert not page.evaluate("() => document.activeElement?.id === 'tp-inline-negative-input'")



def test_slash_key_noop_when_typing_in_input(page: Page):
    page.evaluate("""() => {
        const inp = document.createElement('input');
        inp.id = 'native-test-input';
        document.body.appendChild(inp);
        inp.focus();
    }""")
    assert page.evaluate("() => document.activeElement?.id === 'native-test-input'")

    page.keyboard.press('/')
    assert page.evaluate("() => document.activeElement?.id === 'native-test-input'")



def test_config_export_produces_valid_json(page: Page):
    open_settings(page)

    # Setup export interception
    exported_data = page.evaluate("""() => {
        return new Promise(resolve => {
            const originalCreateObjectURL = URL.createObjectURL;
            URL.createObjectURL = blob => {
                const reader = new FileReader();
                reader.onload = () => {
                    const captured = JSON.parse(reader.result);
                    URL.createObjectURL = originalCreateObjectURL;
                    resolve(captured);
                };
                reader.readAsText(blob);
                return 'blob:mock-url';
            };
            const shadow = document.getElementById('tp-root').shadowRoot;
            shadow.getElementById('tp-export-config-btn').click();
        });
    }""")

    assert exported_data is not None
    assert '_meta' in exported_data
    assert 'config' in exported_data
    assert 'BESTPREISE_MODE_ACTIVE' in exported_data['config']
    assert 'MARGIN_PERCENT' in exported_data['config']
    assert 'NEGATIVE_TERMS' in exported_data['config']



def test_config_import_applies_settings(page: Page):
    open_settings(page)

    # Trigger file import via DataTransfer / File
    import_config(page, {
        '_meta': {'version': '2.13.0'},
        'config': {
            'MARGIN_PERCENT': 7.5,
            'NEGATIVE_TERMS': 'ImportedNegativeTerm',
            'REAL_DEAL_MIN_DISCOUNT': 45,
            'MODE': 'hide',
            'BESTPREISE_MODE_ACTIVE': True,
        },
    })

    # Wait for FileReader to process import
    page.wait_for_function("() => window.ToppreiseSuite?.CONFIG?.MARGIN_PERCENT === 7.5")

    # Check updated CONFIG and UI fields
    config_state = page.evaluate("""() => ({
        margin: window.ToppreiseSuite?.CONFIG?.MARGIN_PERCENT,
        neg: window.ToppreiseSuite?.CONFIG?.NEGATIVE_TERMS,
        minDiscount: window.ToppreiseSuite?.CONFIG?.REAL_DEAL_MIN_DISCOUNT,
        mode: window.ToppreiseSuite?.CONFIG?.BESTPREISE_MODE_ACTIVE,
        inlineNegInput: document.getElementById('tp-inline-negative-input')?.value
    })""")

    assert config_state['margin'] == 7.5
    assert config_state['neg'] == 'ImportedNegativeTerm'
    assert config_state['minDiscount'] == 45
    assert config_state['mode'] is True
    assert config_state['inlineNegInput'] == 'ImportedNegativeTerm'



def test_config_import_invalid_json_shows_error_toast(page: Page):
    open_settings(page)

    import_config(page, '{ this is not valid json...', filename='corrupt.json')

    page.wait_for_function("() => (window.ToppreiseSuite.lastToast() || '').includes('Import fehlgeschlagen')")



def test_config_import_ignores_unknown_and_debug_keys(page: Page):
    open_settings(page)

    page.evaluate("() => { if (window.ToppreiseSuite) window.ToppreiseSuite.CONFIG.DEBUG = true; }")
    import_config(page, {'config': {'UNRECOGNIZED_SECURITY_KEY': 'exploit', 'DEBUG': False, 'MARGIN_PERCENT': 4.2}}, filename='safe_config.json')

    page.wait_for_function("() => Boolean(window.ToppreiseSuite.lastToast && window.ToppreiseSuite.lastToast())")
    res = page.evaluate("""() => ({
        margin: window.ToppreiseSuite?.CONFIG?.MARGIN_PERCENT,
        unknown: window.ToppreiseSuite?.CONFIG?.UNRECOGNIZED_SECURITY_KEY,
        debug: window.ToppreiseSuite?.CONFIG?.DEBUG
    })""")

    assert res['margin'] == 4.2
    assert res['unknown'] is None
    # DEBUG is preserved and not overwritten
    assert res['debug'] is True



def test_sparklines_settings_toggle(page: Page):
    open_settings(page)

    toggle = page.locator('#tp-root >> #tp-sparklines-toggle')
    assert toggle.is_checked()

    # Toggle sparklines off via slider click
    page.click('#tp-root >> #tp-sparklines-toggle + .tp-slider')
    assert not toggle.is_checked()

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.ENABLE_SPARKLINES") is False

def test_dealer_autofetch_settings_toggle(page: Page):
    open_settings(page)

    toggle = page.locator('#tp-root >> #tp-dealer-autofetch-toggle')
    assert not toggle.is_checked()

    # Toggle auto-fetch on via slider click
    page.click('#tp-root >> #tp-dealer-autofetch-toggle + .tp-slider')
    assert toggle.is_checked()

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.DEALER_AUTOFETCH") is True


def test_data_reset_clears_cache_and_settings(page: Page):
    seed_verified_deal(page, 'item1', {'tiefstpreis': 100})
    page.evaluate("() => window.ToppreiseSuite.updateConfig('REAL_DEAL_MIN_DISCOUNT', 40, {skipRender: true})")
    open_settings(page)

    page.on('dialog', lambda dialog: dialog.accept())
    page.click('#tp-root >> #tp-data-reset-btn')

    stats_label = page.locator('#tp-root >> #tp-cache-stats-label')
    assert '0 Einträge' in (stats_label.text_content() or '')
    assert page.evaluate("() => localStorage.getItem('tp_hist_v1_item1')") is None
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.REAL_DEAL_MIN_DISCOUNT") == 30



def test_bestpreise_settings_weight_slider(page: Page):
    # Open settings modal in Shadow DOM
    open_settings(page)

    toggle = page.locator('#tp-root >> #tp-bestpreise-mode-toggle')
    assert not toggle.is_checked()

    # Toggle on -> Weight slider group should become visible
    page.click('#tp-root >> #tp-bestpreise-mode-toggle + .tp-slider')
    assert toggle.is_checked()

    weight_group = page.locator('#tp-root >> #tp-bestpreise-weight-group')
    assert weight_group.is_visible()

    # Set slider to 70% Record / 30% Median
    page.fill('#tp-root >> #tp-bestpreise-weight-val', '70')
    page.dispatch_event('#tp-root >> #tp-bestpreise-weight-val', 'input')

    desc = page.locator('#tp-root >> #tp-bestpreise-weight-desc')
    desc_text = desc.text_content() or ''
    assert '70% Rekord / 30% Ø-Preis' in desc_text
    assert 'Farb-Emphase' in desc_text
    # Worked example moves with the slider: 0.7*10 + 0.3*25 = 15
    assert 'Gewichtete Differenz 15' in desc_text

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE") is True
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD") == 0.70



def test_bestpreise_settings_horizon_selection_persistence(page: Page):
    # Open settings dialog in Shadow DOM
    open_settings(page)

    # Toggle Bestpreise on if not active
    toggle = page.locator('#tp-root >> #tp-bestpreise-mode-toggle')
    if not toggle.is_checked():
        page.click('#tp-root >> #tp-bestpreise-mode-toggle + .tp-slider')

    horizon_group = page.locator('#tp-root >> #tp-bestpreise-horizon-group')
    assert horizon_group.is_visible()

    # Type 180 days into the horizon number input (6 months)
    page.fill('#tp-root >> #tp-bestpreise-horizon-val', '180')

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS") == 180


def test_horizon_change_recomputes_cached_price_stats(page: Page):
    # Cached analyses bake in the old horizon (median window + Ø label), so a
    # horizon change + Save must recompute them from the retained series —
    # entries survive with the new window median, no refetch till TTL.
    import time
    now_ms = int(time.time() * 1000)
    day_ms = 86400 * 1000
    page.evaluate("""([now_ms, day_ms]) => {
        localStorage.clear();
        const series = [
            [now_ms - 200 * day_ms, 2600],
            [now_ms - 120 * day_ms, 2500],
            [now_ms - 60 * day_ms, 2100],
            [now_ms - 30 * day_ms, 2000],
            [now_ms, 1900],
        ];
        const stats = { tiefstpreis: 1800, medianPrice: 2100, horizonDays: 365, medianFallback: false, dataPointCount: 5, timeSeries: series, time: Date.now() };
        // Card-backed pid: the post-save render re-reads it, firing the lazy
        // cold-entry recompute (storage orphans recompute on next read).
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(stats));
        window.ToppreiseSuite.CONFIG.OUTLIER_REJECTION_ENABLED = false;
    }""", [now_ms, day_ms])
    open_settings(page)

    toggle = page.locator('#tp-root >> #tp-bestpreise-mode-toggle')
    if not toggle.is_checked():
        page.click('#tp-root >> #tp-bestpreise-mode-toggle + .tp-slider')
    page.fill('#tp-root >> #tp-bestpreise-horizon-val', '90')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS") == 90
    entry = page.evaluate("() => JSON.parse(localStorage.getItem(window.ToppreiseSuite.statsKey('797571')))")
    assert entry['horizonDays'] == 90
    assert entry['medianPrice'] == 2000
    assert entry['medianFallback'] is False


def test_cache_settings_and_clear_button(page: Page):
    # Seed local storage with 2 fake cache items
    seed_verified_deal(page, 'item1', {'tiefstpreis': 100})
    seed_verified_deal(page, 'item2', {'tiefstpreis': 200}, clear=False)

    # Open settings modal
    open_settings(page)

    # Verify cache count label displays 2 items with disk limit
    stats_label = page.locator('#tp-root >> #tp-cache-stats-label')
    assert '2 / 300 Einträge' in (stats_label.text_content() or '')

    # Change Cache TTL to 72 hours and Neg TTL to 6 hours
    page.select_option('#tp-root >> #tp-cache-ttl-select', '72')
    page.select_option('#tp-root >> #tp-cache-neg-ttl-select', '6')

    # Change RAM and Disk cache limits
    page.fill('#tp-root >> #tp-cache-memory-val', '750')
    page.fill('#tp-root >> #tp-cache-disk-val', '400')
    assert '2 / 400 Einträge' in (stats_label.text_content() or '')

    # Click Clear Cache button
    page.click('#tp-root >> #tp-cache-clear-btn')
    assert '0 / 400 Einträge' in (stats_label.text_content() or '')

    # Verify localStorage items were removed
    remaining_keys = page.evaluate("""() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('tp_hist_v1_')) keys.push(k);
        }
        return keys;
    }""")
    assert len(remaining_keys) == 0

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.REAL_DEAL_CACHE_HOURS") == 72
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.NEGATIVE_CACHE_HOURS") == 6
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.CACHE_MEMORY_LIMIT") == 750
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.CACHE_DISK_LIMIT") == 400



def test_gewichtete_differenz_weight_slider_zero_persistence(page: Page):
    """
    Validates that setting the Gewichtete-Differenz weight slider to 0% in settings dialog
    persists as 0.0 (100% Median / 0% Neuer Rekord) without resetting to 0.50 (50%).
    """
    page.evaluate("""() => {
        const root = document.getElementById('tp-root');
        const fab = root.shadowRoot.getElementById('tp-settings-fab');
        fab.click();
        const weightVal = root.shadowRoot.getElementById('tp-bestpreise-weight-val');
        weightVal.value = '0';
        const saveBtn = root.shadowRoot.getElementById('tp-btn-save');
        saveBtn.click();
    }""")

    stored_weight = page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD")
    assert stored_weight == 0.0



def test_config_dispatcher_syncs_toolbar_and_modal(page: Page):
    # Ensure modal is constructed by opening it
    open_settings(page)

    # 1. Update config via updateConfig for HEATMAP_ENABLED (canonical home: bar only)
    res = page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('HEATMAP_ENABLED', false);
        const barHeatActive = document.getElementById('tp-bar-heat-btn')?.classList.contains('tp-active');
        const modalHeatToggle = document.getElementById('tp-root').shadowRoot.getElementById('tp-heatmap-enabled-toggle');
        return {
            config: window.ToppreiseSuite.CONFIG.HEATMAP_ENABLED,
            barHeatActive,
            modalHeatToggleGone: modalHeatToggle === null
        };
    }""")
    assert res['config'] is False
    assert res['barHeatActive'] is False
    assert res['modalHeatToggleGone'] is True

    # 2. Update config for MIN_OFFERS (toolbar) and REAL_DEAL_MIN_DISCOUNT (toolbar & modal)
    res_sync = page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('MIN_OFFERS', 5);
        window.ToppreiseSuite.updateConfig('REAL_DEAL_MIN_DISCOUNT', 25);
        window.ToppreiseSuite.updateConfig('BESTPREISE_INCLUDE_VORTIEF', false);
        const barMinVal = document.getElementById('tp-bar-min-val')?.textContent;
        const barThreshBtn = document.getElementById('tp-floating-threshold-btn')?.textContent;
        const modalThreshVal = document.getElementById('tp-root').shadowRoot.getElementById('tp-real-deal-min-val')?.value;
        const vortiefBtn = document.querySelector('button[data-mode-key="VORTIEF_MODE"]');
        const vortiefRowCount = document.querySelector('[data-row-count="vortief"]');
        return {
            minConfig: window.ToppreiseSuite.CONFIG.MIN_OFFERS,
            barMinVal,
            threshConfig: window.ToppreiseSuite.CONFIG.REAL_DEAL_MIN_DISCOUNT,
            barThreshBtn,
            modalThreshVal,
            vortiefText: vortiefBtn?.textContent,
            vortiefRowCountPresent: vortiefRowCount !== null
        };
    }""")
    assert res_sync['minConfig'] == 5
    assert res_sync['barMinVal'] == '5'
    assert res_sync['threshConfig'] == 25
    assert res_sync['barThreshBtn'] == '≥25% ▾'
    assert res_sync['modalThreshVal'] == '25'
    assert res_sync['vortiefText'] == 'Dimmen'
    assert res_sync['vortiefRowCountPresent'] is True
    assert page.locator('button[data-mode-key="VORTIEF_MODE"]').inner_text() == 'Dimmen'

    # Close modal
    page.click('#tp-root >> #tp-btn-close')


def test_settings_grouped_sections_visible_without_expanding(page: Page):
    open_settings(page)

    # Seven toggle-button headers, all expanded on first open (fresh localStorage)
    assert page.locator('#tp-root >> button.tp-section-header').count() == 7
    for section in ['display', 'review', 'deals', 'filter', 'alarm', 'discord', 'data']:
        header = page.locator(f'#tp-root >> #tp-section-{section} >> button.tp-section-header')
        assert header.count() == 1
        assert header.get_attribute('aria-expanded') == 'true'
        assert page.locator(f'#tp-root >> #tp-section-{section} >> .tp-section-body').is_visible()
    assert page.locator('#tp-root >> #tp-advanced-details').count() == 0

    # Former Feintuning controls need no expanding
    assert page.locator('#tp-root >> #tp-margin-range').is_visible()
    assert page.locator('#tp-root >> #tp-cache-ttl-select').is_visible()
    assert page.locator('#tp-root >> #tp-section-filter >> #tp-margin-range').is_visible()
    assert page.locator('#tp-root >> #tp-section-deals >> label[for="tp-sort-discount"]').is_visible()
    assert page.locator('#tp-root >> #tp-section-data >> #tp-real-deal-min-range').is_visible()
    assert page.locator('#tp-root >> #tp-btn-save').is_visible()

    # Discord controls live in their own section; secret stays collapsed until reveal
    for control in ['#tp-discord-webhook-reveal', '#tp-discord-dealer-embed-toggle', '#tp-discord-product-embed-toggle']:
        assert page.locator(f'#tp-root >> #tp-section-discord >> {control}').count() == 1
    assert not page.locator('#tp-root >> #tp-discord-webhook-input').is_visible()

    # Save roundtrip across sections: webhook + target + weight persist
    page.click('#tp-root >> #tp-discord-webhook-reveal')
    page.fill('#tp-root >> #tp-discord-webhook-input', 'https://discord.com/api/webhooks/123/abc')
    page.fill('#tp-root >> #tp-alarm-target-val', '60')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.ALARM_TARGET_PERCENT") == 0.6
    open_settings(page)
    assert page.locator('#tp-root >> #tp-discord-webhook-status').inner_text() == '✅ Webhook hinterlegt'
    page.click('#tp-root >> #tp-discord-webhook-reveal')
    # Reveal never fills the secret: empty editor, status line is the only indicator.
    assert page.locator('#tp-root >> #tp-discord-webhook-input').input_value() == ''
    assert page.locator('#tp-root >> #tp-alarm-target-val').input_value() == '60'
    page.click('#tp-root >> #tp-btn-close')


def test_settings_sections_collapse_and_remember(page: Page):
    open_settings(page)
    data_header = page.locator('#tp-root >> #tp-section-data >> button.tp-section-header')
    data_body = page.locator('#tp-root >> #tp-section-data >> .tp-section-body')
    assert data_body.is_visible()

    data_header.click()
    assert not data_body.is_visible()
    assert data_header.get_attribute('aria-expanded') == 'false'
    page.click('#tp-root >> #tp-btn-close')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    # Collapse survives close/reopen via the localStorage mirror
    open_settings(page)
    assert not page.locator('#tp-root >> #tp-section-data >> .tp-section-body').is_visible()
    assert page.locator('#tp-root >> #tp-section-data >> button.tp-section-header').get_attribute('aria-expanded') == 'false'
    assert 'tp-section-data' in page.evaluate("() => localStorage.getItem('tp_suite_v2_tp_modal_collapsed')")

    # Save while discord is collapsed still collects its hidden inputs
    page.locator('#tp-root >> #tp-section-discord >> button.tp-section-header').click()
    assert not page.locator('#tp-root >> #tp-section-discord >> .tp-section-body').is_visible()
    page.fill('#tp-root >> #tp-alarm-target-val', '70')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.ALARM_TARGET_PERCENT") == 0.7

    # Expand persists expanded
    open_settings(page)
    page.locator('#tp-root >> #tp-section-data >> button.tp-section-header').click()
    assert page.locator('#tp-root >> #tp-section-data >> .tp-section-body').is_visible()
    page.click('#tp-root >> #tp-btn-close')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    open_settings(page)
    assert page.locator('#tp-root >> #tp-section-data >> .tp-section-body').is_visible()
    page.click('#tp-root >> #tp-btn-close')


def test_open_settings_at_expands_collapsed_section(page: Page):
    open_settings(page)
    page.locator('#tp-root >> #tp-section-alarm >> button.tp-section-header').click()
    assert not page.locator('#tp-root >> #tp-section-alarm >> .tp-section-body').is_visible()
    page.click('#tp-root >> #tp-btn-close')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    page.evaluate("() => window.ToppreiseSuite.openSettingsAt('tp-section-alarm')")
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    assert page.locator('#tp-root >> #tp-section-alarm >> .tp-section-body').is_visible()
    assert page.locator('#tp-root >> #tp-section-alarm.tp-flash').count() == 1
    page.click('#tp-root >> #tp-btn-close')


def test_discord_layout_editor(page: Page):
    open_settings(page)
    preview = page.locator('#tp-root >> #tp-section-discord >> #tp-discord-layout-preview')
    page.fill('#tp-root >> #tp-discord-layout-input', '## {title}\n# {price}')
    expect(preview).to_contain_text('URBANISTA Porto')
    expect(preview).to_contain_text('CHF 16.85')
    expect(page.locator('#tp-root >> #tp-section-discord >> #tp-discord-layout-count')).to_contain_text('Nachricht')
    assert '## [' not in preview.inner_text()
    page.fill('#tp-root >> #tp-discord-layout-input', '# {price}')
    expect(preview).to_contain_text('CHF 16.85')
    page.fill('#tp-root >> #tp-discord-layout-input', '# {price}\n{dealer}')
    expect(preview).to_contain_text('Amazon.de')
    page.fill('#tp-root >> #tp-discord-layout-input', '{foo}')
    expect(page.locator('#tp-root >> #tp-section-discord >> #tp-discord-layout-error')).to_contain_text('Unbekannte Tokens: {foo}')
    assert preview.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    page.click('#tp-root >> #tp-btn-close')




def test_segmented_radios_keyboard_focusable(page: Page):
    open_settings(page)
    radios = page.locator('#tp-root >> input[name="tp-sort-offers"]')
    assert radios.count() >= 2

    # Visually hidden, never display:none — keyboard focus must land
    first = radios.nth(0)
    assert first.evaluate('el => getComputedStyle(el).display') != 'none'
    first.focus()
    assert first.evaluate('el => el.getRootNode().activeElement === el')

    # Arrow key moves checked state within the native radio group
    first.press('ArrowRight')
    assert radios.nth(1).is_checked()
    page.click('#tp-root >> #tp-btn-close')


def test_multi_channel_settings(page: Page):
    open_settings(page)

    # Primary channel
    primary_name = page.locator('#tp-root >> #tp-discord-primary-name')
    assert primary_name.is_visible()
    page.fill('#tp-root >> #tp-discord-primary-name', 'Allgemein')
    page.click('#tp-root >> #tp-discord-webhook-reveal')
    page.fill('#tp-root >> #tp-discord-webhook-input', 'https://discord.com/api/webhooks/111/allgemein')

    # Add extra channel
    page.click('#tp-root >> #tp-discord-add-channel-btn')
    extra_card = page.locator('#tp-root >> .tp-discord-extra-card')
    assert extra_card.count() == 1
    page.fill('#tp-root >> .tp-discord-extra-card .tp-discord-channel-name', 'Gaming Deals')
    page.fill('#tp-root >> .tp-discord-extra-card .tp-discord-extra-url', 'https://discord.com/api/webhooks/222/gaming')

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    # Reopen and check persistence
    open_settings(page)
    assert page.locator('#tp-root >> #tp-discord-primary-name').input_value() == 'Allgemein'
    assert page.locator('#tp-root >> #tp-discord-webhook-status').inner_text() == '✅ Webhook hinterlegt'
    assert page.locator('#tp-root >> .tp-discord-extra-card .tp-discord-channel-name').input_value() == 'Gaming Deals'
    assert page.locator('#tp-root >> .tp-discord-extra-card .tp-discord-extra-status').inner_text() == '✅ Webhook hinterlegt'

    # Remove extra channel
    page.click('#tp-root >> .tp-discord-extra-card .tp-discord-remove-channel-btn')
    assert page.locator('#tp-root >> .tp-discord-extra-card').count() == 0

    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    open_settings(page)
    assert page.locator('#tp-root >> #tp-discord-primary-name').input_value() == 'Allgemein'
    assert page.locator('#tp-root >> .tp-discord-extra-card').count() == 0
    page.click('#tp-root >> #tp-btn-close')

