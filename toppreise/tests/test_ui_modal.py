from playwright.sync_api import Page, expect



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



def test_card_quick_block_button_and_toast_undo(page: Page):
    # Verify quick-block button is injected on cards
    page.wait_for_selector('#card-cheapest .tp-card-quick-block')
    btn = page.locator('#card-cheapest .tp-card-quick-block')
    assert btn.is_visible()
    assert 'Grafikkarten' in (btn.text_content() or '')

    # Click quick-block on cheapest card
    btn.click()

    # Card should be category filtered (display: none -> attached)
    page.wait_for_selector('#card-cheapest.tp-category-filtered', state='attached')
    assert 'tp-category-filtered' in (page.locator('#card-cheapest').get_attribute('class') or '')

    # Blocked chip row should appear on top filter bar
    page.wait_for_selector('#tp-suite-filter-bar .tp-blocked-chip')
    chip = page.locator('#tp-suite-filter-bar .tp-blocked-chip').first
    assert chip.is_visible()
    assert 'Grafikkarten' in (chip.text_content() or '')

    # Toast should appear inside Shadow DOM with undo button
    toast = page.locator('#tp-root >> .tp-toast')
    page.wait_for_selector('#tp-root >> .tp-toast', state='visible')
    assert toast.is_visible()
    assert 'Grafikkarten' in (toast.text_content() or '')

    undo_btn = page.locator('#tp-root >> .tp-toast-undo')
    assert undo_btn.is_visible()

    # Click undo
    undo_btn.click()

    # Card should no longer be filtered (becomes visible again)
    page.wait_for_selector('#card-cheapest:not(.tp-category-filtered)', state='visible')
    assert 'tp-category-filtered' not in (page.locator('#card-cheapest').get_attribute('class') or '')



def test_modal_mode_and_settings_in_shadow_dom(page: Page):
    # Open settings modal
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Toggle mode to 'hide' via segmented control
    page.click('#tp-root >> label[for="tp-mode-hide"]')
    page.click('#tp-root >> #tp-btn-save')

    # Dialog should close and body class updated
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    has_mode_hide = page.evaluate("() => document.body.classList.contains('tp-mode-hide')")
    assert has_mode_hide is True



def test_category_drawer_clear_all_with_undo(page: Page):
    # Block a category
    page.evaluate("""() => {
        window.ToppreiseSuite.saveConfigKey('EXCLUDED_CATEGORIES', ['PATH:Hardware/Grafikkarten']);
        window.ToppreiseSuite.processListings();
    }""")
    page.wait_for_selector('#tp-bar-cats-toggle', state='visible')

    # Open category drawer
    page.click('#tp-bar-cats-toggle')
    page.wait_for_selector('#tp-blocked-clear-all-btn', state='visible')

    # Click "Alle freigeben"
    page.click('#tp-blocked-clear-all-btn')
    page.wait_for_timeout(200)

    # Verify categories are cleared
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.EXCLUDED_CATEGORIES") == []

    # Toast with "Rückgängig" action should appear
    undo_btn = page.locator('#tp-root >> .tp-toast-undo')
    page.wait_for_selector('#tp-root >> .tp-toast-undo', state='visible')
    assert 'Rückgängig' in (undo_btn.text_content() or '')

    # Click "Rückgängig"
    undo_btn.click()
    page.wait_for_timeout(200)

    # Verify categories are restored
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.EXCLUDED_CATEGORIES") == ['PATH:Hardware/Grafikkarten']



def test_blocked_categories_collapse_and_expand(page: Page):
    # Quick block cheapest card to add category
    page.wait_for_selector('#card-cheapest .tp-card-quick-block')
    page.click('#card-cheapest .tp-card-quick-block')

    # Drawer should be visible (auto-expanded on block action)
    drawer = page.locator('#tp-blocked-cats-container')
    page.wait_for_selector('#tp-blocked-cats-container', state='visible')
    assert drawer.is_visible()

    # Click toggle button in top bar to collapse
    toggle_btn = page.locator('#tp-bar-cats-toggle')
    assert toggle_btn.is_visible()
    toggle_btn.click()

    # Drawer should now be hidden
    page.wait_for_selector('#tp-blocked-cats-container', state='hidden')
    assert not drawer.is_visible()

    # Click toggle button again to expand
    toggle_btn.click()
    page.wait_for_selector('#tp-blocked-cats-container', state='visible')
    assert drawer.is_visible()



def test_darkreader_dynamic_mode_compatibility(page: Page):
    # Simulate DarkReader stamping data attributes and check that userscript maintains gradient
    page.wait_for_selector('#card-cheapest.tp-heatmap-active')
    card = page.locator('#card-cheapest')

    # Check that darkreader CSS variables are properly populated with gradient and transparent bg
    dr_bgimage = card.evaluate("el => el.style.getPropertyValue('--darkreader-inline-bgimage')")
    dr_bgcolor = card.evaluate("el => el.style.getPropertyValue('--darkreader-inline-bgcolor')")
    assert 'linear-gradient' in dr_bgimage
    assert dr_bgcolor == 'transparent'

    # Check child element transparent backgrounds
    product_name = page.locator('#card-cheapest .product-name')
    child_bg = product_name.evaluate("el => window.getComputedStyle(el).backgroundColor")
    assert child_bg in ('rgba(0, 0, 0, 0)', 'transparent')



def test_price_alarm_settings_configurable_delays(page: Page):
    # Open settings dialog
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Default delay values should be 300 and 800
    submit_delay_input = page.locator('#tp-root >> #tp-alarm-submit-delay-val')
    close_delay_input = page.locator('#tp-root >> #tp-alarm-close-delay-val')
    assert submit_delay_input.input_value() == '300'
    assert close_delay_input.input_value() == '800'

    # Update delay values
    submit_delay_input.fill('500')
    close_delay_input.fill('1200')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    # Re-open dialog and verify updated delay values persisted
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    assert page.locator('#tp-root >> #tp-alarm-submit-delay-val').input_value() == '500'
    assert page.locator('#tp-root >> #tp-alarm-close-delay-val').input_value() == '1200'

    # Toggle off auto-submit and verify delays group hides
    page.click('#tp-root >> #tp-alarm-autosubmit-toggle + .tp-slider')
    assert not page.locator('#tp-root >> #tp-alarm-delays-group').is_visible()
    page.click('#tp-root >> #tp-btn-close')



def test_real_deal_settings_modal_controls(page: Page):
    # Open settings dialog
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Verify Section 6 controls exist
    real_deal_toggle = page.locator('#tp-root >> #tp-real-deal-filter-toggle')
    min_discount_input = page.locator('#tp-root >> #tp-real-deal-min-val')
    assert not real_deal_toggle.is_checked()
    assert min_discount_input.input_value() == '30'

    # Toggle filter on and set threshold to 40
    page.click('#tp-root >> #tp-real-deal-filter-toggle + .tp-slider')
    min_discount_input.fill('40')
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    # Re-open dialog and verify settings persisted
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    assert page.locator('#tp-root >> #tp-real-deal-filter-toggle').is_checked()
    assert page.locator('#tp-root >> #tp-real-deal-min-val').input_value() == '40'
    page.click('#tp-root >> #tp-btn-close')



def test_slash_key_focuses_negative_filter(page: Page):
    filter_bar = page.locator('#tp-suite-filter-bar')
    assert filter_bar.is_visible()

    # Make sure focus is on body
    page.evaluate("() => document.body.focus()")
    page.keyboard.press('/')

    is_focused = page.evaluate("() => document.activeElement?.id === 'tp-inline-negative-input'")
    assert is_focused



def test_escape_blurs_negative_filter(page: Page):
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
    # Open settings dialog
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

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
    assert 'MODE' in exported_data['config']
    assert 'MARGIN_PERCENT' in exported_data['config']
    assert 'NEGATIVE_TERMS' in exported_data['config']



def test_config_import_applies_settings(page: Page):
    # Open settings dialog
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Trigger file import via DataTransfer / File
    page.evaluate("""() => {
        const shadow = document.getElementById('tp-root').shadowRoot;
        const fileInput = shadow.getElementById('tp-import-config-file');
        const testPayload = {
            _meta: { version: '2.13.0' },
            config: {
                MARGIN_PERCENT: 7.5,
                NEGATIVE_TERMS: 'ImportedNegativeTerm',
                REAL_DEAL_MIN_DISCOUNT: 45,
                MODE: 'hide'
            }
        };
        const blob = new Blob([JSON.stringify(testPayload)], { type: 'application/json' });
        const file = new File([blob], 'config.json', { type: 'application/json' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }""")

    # Give FileReader a tick
    page.wait_for_timeout(200)

    # Check updated CONFIG and UI fields
    config_state = page.evaluate("""() => ({
        margin: window.ToppreiseSuite?.CONFIG?.MARGIN_PERCENT,
        neg: window.ToppreiseSuite?.CONFIG?.NEGATIVE_TERMS,
        minDiscount: window.ToppreiseSuite?.CONFIG?.REAL_DEAL_MIN_DISCOUNT,
        mode: window.ToppreiseSuite?.CONFIG?.MODE,
        inlineNegInput: document.getElementById('tp-inline-negative-input')?.value
    })""")

    assert config_state['margin'] == 7.5
    assert config_state['neg'] == 'ImportedNegativeTerm'
    assert config_state['minDiscount'] == 45
    assert config_state['mode'] == 'hide'
    assert config_state['inlineNegInput'] == 'ImportedNegativeTerm'



def test_config_import_invalid_json_shows_error_toast(page: Page):
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    page.evaluate("""() => {
        const shadow = document.getElementById('tp-root').shadowRoot;
        const fileInput = shadow.getElementById('tp-import-config-file');
        const blob = new Blob(['{ this is not valid json...'], { type: 'application/json' });
        const file = new File([blob], 'corrupt.json', { type: 'application/json' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }""")

    page.wait_for_timeout(200)
    toast = page.locator('#tp-root >> .tp-toast')
    assert toast.is_visible()
    assert 'Import fehlgeschlagen' in (toast.text_content() or '')



def test_config_import_ignores_unknown_and_debug_keys(page: Page):
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    page.evaluate("""() => {
        const shadow = document.getElementById('tp-root').shadowRoot;
        const fileInput = shadow.getElementById('tp-import-config-file');
        const payload = {
            config: {
                UNRECOGNIZED_SECURITY_KEY: 'exploit',
                DEBUG: false,
                MARGIN_PERCENT: 4.2
            }
        };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const file = new File([blob], 'safe_config.json', { type: 'application/json' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }""")

    page.wait_for_timeout(200)
    res = page.evaluate("""() => ({
        margin: window.ToppreiseSuite?.CONFIG?.MARGIN_PERCENT,
        unknown: window.ToppreiseSuite?.CONFIG?.UNRECOGNIZED_SECURITY_KEY,
        debug: window.ToppreiseSuite?.CONFIG?.DEBUG
    })""")

    assert res['margin'] == 4.2
    assert res['unknown'] is None
    # DEBUG is preserved and not overwritten
    assert res['debug'] is True



def test_sparklines_beta_settings_toggle(page: Page):
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    toggle = page.locator('#tp-root >> #tp-sparklines-toggle')
    assert not toggle.is_checked()

    # Toggle sparklines on via slider click
    page.click('#tp-root >> #tp-sparklines-toggle + .tp-slider')
    assert toggle.is_checked()

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.ENABLE_SPARKLINES") is True



def test_bestpreise_settings_weight_slider(page: Page):
    # Open settings modal in Shadow DOM
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

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
    assert '30% Median / 70% Neuer Rekord' in (desc.text_content() or '')

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE") is True
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD") == 0.70



def test_bestpreise_settings_horizon_selection_persistence(page: Page):
    # Open settings dialog in Shadow DOM
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Toggle Bestpreise on if not active
    toggle = page.locator('#tp-root >> #tp-bestpreise-mode-toggle')
    if not toggle.is_checked():
        page.click('#tp-root >> #tp-bestpreise-mode-toggle + .tp-slider')

    horizon_group = page.locator('#tp-root >> #tp-bestpreise-horizon-group')
    assert horizon_group.is_visible()

    # Change horizon select to 180 days (6 months)
    page.select_option('#tp-root >> #tp-bestpreise-horizon-select', '180')

    # Save
    page.click('#tp-root >> #tp-btn-save')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')

    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS") == 180



def test_cache_settings_and_clear_button(page: Page):
    # Seed local storage with 2 fake cache items
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_item1', JSON.stringify({ tiefstpreis: 100, time: Date.now() }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('item1', JSON.parse(localStorage.getItem('tp_hist_v1_item1')));
        localStorage.setItem('tp_hist_v1_item2', JSON.stringify({ tiefstpreis: 200, time: Date.now() }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('item2', JSON.parse(localStorage.getItem('tp_hist_v1_item2')));
    }""")

    # Open settings modal
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Verify cache count label displays 2 items
    stats_label = page.locator('#tp-root >> #tp-cache-stats-label')
    assert '2 Einträge' in (stats_label.text_content() or '')

    # Change Cache TTL to 72 hours and Neg TTL to 6 hours
    page.select_option('#tp-root >> #tp-cache-ttl-select', '72')
    page.select_option('#tp-root >> #tp-cache-neg-ttl-select', '6')

    # Click Clear Cache button
    page.click('#tp-root >> #tp-cache-clear-btn')
    assert '0 Einträge' in (stats_label.text_content() or '')

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



def test_deal_score_weight_slider_zero_persistence(page: Page):
    """
    Validates that setting the Deal-Score weight slider to 0% in settings dialog
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
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # 1. Update config via updateConfig for HEATMAP_ENABLED
    res = page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('HEATMAP_ENABLED', false);
        const barHeatActive = document.getElementById('tp-bar-heat-btn')?.classList.contains('tp-active');
        const modalHeatChecked = document.getElementById('tp-root').shadowRoot.getElementById('tp-heatmap-enabled-toggle')?.checked;
        return {
            config: window.ToppreiseSuite.CONFIG.HEATMAP_ENABLED,
            barHeatActive,
            modalHeatChecked
        };
    }""")
    assert res['config'] is False
    assert res['barHeatActive'] is False
    assert res['modalHeatChecked'] is False

    # 2. Update config for MIN_OFFERS
    res_min = page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('MIN_OFFERS', 5);
        const barVal = document.getElementById('tp-bar-min-val')?.textContent;
        const modalVal = document.getElementById('tp-root').shadowRoot.getElementById('tp-min-offers-val')?.value;
        return {
            config: window.ToppreiseSuite.CONFIG.MIN_OFFERS,
            barVal,
            modalVal
        };
    }""")
    assert res_min['config'] == 5
    assert res_min['barVal'] == '5'
    assert res_min['modalVal'] == '5'

    # Close modal
    page.click('#tp-root >> #tp-btn-close')


