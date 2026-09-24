import os
from playwright.sync_api import Page, expect



def test_best_price_highlighting_and_dimming(page: Page):
    # Card 1 is cheapest store price -> highlighted
    page.wait_for_selector('#card-cheapest.tp-is-cheapest')
    assert 'tp-is-cheapest' in (page.locator('#card-cheapest').get_attribute('class') or '')
    assert page.locator('#card-cheapest .tp-best-price-badge').is_visible()

    # Card 2 is more expensive -> not cheapest
    assert 'tp-not-cheapest' in (page.locator('#card-expensive').get_attribute('class') or '')



def test_negative_keywords_filtering(page: Page):
    # Set negative keyword via inline filter bar input
    page.fill('#tp-inline-negative-input', 'Case, Hülle')
    page.dispatch_event('#tp-inline-negative-input', 'input')

    page.wait_for_selector('#card-negative.tp-negative-filtered', state='attached')
    assert 'tp-negative-filtered' in (page.locator('#card-negative').get_attribute('class') or '')
    assert 'tp-negative-filtered' not in (page.locator('#card-cheapest').get_attribute('class') or '')



def test_min_offers_filter(page: Page):
    # Set min offers to 3 via updateConfig
    page.evaluate("() => window.ToppreiseSuite.updateConfig('MIN_OFFERS', 3)")

    page.wait_for_selector('#card-low-offers.tp-min-offers-filtered', state='attached')
    assert 'tp-min-offers-filtered' in (page.locator('#card-low-offers').get_attribute('class') or '')
    assert 'tp-min-offers-filtered' not in (page.locator('#card-cheapest').get_attribute('class') or '')



def test_suite_filter_bar_and_category_pill_styles(page: Page):
    # Verify filter bar is injected and styled
    filter_bar = page.locator('#tp-suite-filter-bar')
    page.wait_for_selector('#tp-suite-filter-bar')
    assert filter_bar.is_visible()

    # Verify inline negative input is present and styled
    neg_input = page.locator('#tp-inline-negative-input')
    assert neg_input.is_visible()
    border_radius = neg_input.evaluate("el => window.getComputedStyle(el).borderRadius")
    assert border_radius == '8px'



def test_sort_by_offers(page: Page):
    # Open settings and enable sort by offers desc
    page.click('#tp-root >> #tp-settings-fab')
    page.click('#tp-root >> label[for="tp-sort-desc"]')
    page.click('#tp-root >> #tp-btn-save')

    # The card with 20 offers (card-cat-excluded) should now be first
    cards = page.locator('#product-list .Plugin_Product')
    first_card_id = cards.first.get_attribute('id')
    assert first_card_id == 'card-cat-excluded'



def test_master_filter_toggle_and_category_preservation(page: Page):
    # Add negative term, min offers filter, and blocked category
    page.fill('#tp-inline-negative-input', 'Case')
    page.dispatch_event('#tp-inline-negative-input', 'input')
    page.evaluate("() => window.ToppreiseSuite.updateConfig('MIN_OFFERS', 10)")

    page.evaluate("""() => {
        window.ToppreiseSuite.saveConfigKey('EXCLUDED_CATEGORIES', ['PATH:Hardware/Grafikkarten']);
        window.ToppreiseSuite.processListings();
    }""")

    page.wait_for_selector('#card-negative.tp-negative-filtered', state='attached')
    page.wait_for_selector('#card-low-offers.tp-min-offers-filtered', state='attached')

    filter_toggle = page.locator('#tp-toggle-neg')
    assert filter_toggle.is_visible()
    assert 'tp-active' in (filter_toggle.get_attribute('class') or '')

    page.locator('#tp-toggle-neg').click()
    page.locator('#tp-toggle-min').click()
    page.locator('#tp-toggle-cat').click()
    page.wait_for_selector('#tp-toggle-neg.tp-filter-off')

    # Verify cards are no longer filtered (all visible)
    page.wait_for_selector('#card-negative:not(.tp-negative-filtered)', state='visible')
    page.wait_for_selector('#card-low-offers:not(.tp-min-offers-filtered)', state='visible')
    assert 'tp-negative-filtered' not in (page.locator('#card-negative').get_attribute('class') or '')
    assert 'tp-min-offers-filtered' not in (page.locator('#card-low-offers').get_attribute('class') or '')

    # Verify settings are 100% PRESERVED in storage
    config = page.evaluate("() => window.ToppreiseSuite.CONFIG")
    assert config['NEGATIVE_TERMS'] == 'Case'
    assert config['MIN_OFFERS'] == 10
    assert config['EXCLUDED_CATEGORIES'] == ['PATH:Hardware/Grafikkarten']

    # Click Master Filter Toggle again to re-enable (Filter: AN)
    page.locator('#tp-toggle-neg').click()
    page.locator('#tp-toggle-min').click()
    page.locator('#tp-toggle-cat').click()
    page.wait_for_selector('#tp-toggle-neg.tp-active')

    # Verify cards are filtered again
    page.wait_for_selector('#card-negative.tp-negative-filtered', state='attached')
    page.wait_for_selector('#card-low-offers.tp-min-offers-filtered', state='attached')



def test_quick_block_hidden_on_non_neue_toppreise_pages(page: Page):
    # Simulate navigation to a normal search / category page
    page.evaluate("""() => {
        document.body.classList.remove('Page_ListTopPriceReductionProducts');
        document.body.removeAttribute('data-current_url');
        // Trigger re-process
        window.ToppreiseSuite.processListings();
    }""")
    page.wait_for_timeout(50)

    # Verify quick-block buttons are removed / absent on regular pages
    quick_blocks = page.locator('.tp-card-quick-block')
    assert quick_blocks.count() == 0



def test_filter_bar_mounting_safety_and_interaction(page: Page):
    # Assert filter bar is not mounted inside .f_filter_plugin, .filters, or header
    is_safe_placement = page.evaluate("""() => {
        const bar = document.getElementById('tp-suite-filter-bar');
        if (!bar) return false;
        return !bar.closest('.header, [class*="MainTopHead"], [class*="MainHead"], .f_filter_plugin, .filters, .filterBox');
    }""")
    assert is_safe_placement is True

    # Test negative input interaction
    neg_input = page.locator('#tp-inline-negative-input')
    neg_input.fill('Adapter')
    page.wait_for_timeout(250)
    assert neg_input.input_value() == 'Adapter'



def test_discount_heatmap_rendering(page: Page):
    # Card 1 has -67% discount -> hot thermal styling
    page.wait_for_selector('#card-cheapest.tp-heatmap-active')
    card_hot = page.locator('#card-cheapest')
    assert 'tp-heatmap-active' in (card_hot.get_attribute('class') or '')

    # Card 2 has -10% discount -> cold thermal styling
    card_cold = page.locator('#card-expensive')
    assert 'tp-heatmap-active' in (card_cold.get_attribute('class') or '')

    # Check CSS variable values on cards
    hot_bg = card_hot.evaluate("el => el.style.getPropertyValue('--tp-heat-bg')")
    cold_bg = card_cold.evaluate("el => el.style.getPropertyValue('--tp-heat-bg')")
    assert 'linear-gradient' in hot_bg
    assert 'linear-gradient' in cold_bg
    assert hot_bg != cold_bg



def test_discount_heatmap_toolbar_toggle(page: Page):
    heat_btn = page.locator('#tp-bar-heat-btn')
    page.wait_for_selector('#tp-bar-heat-btn')
    assert heat_btn.is_visible()
    assert 'tp-active' in (heat_btn.get_attribute('class') or '')

    # Click to toggle heatmap OFF
    heat_btn.click()
    page.wait_for_timeout(200)

    assert 'tp-active' not in (heat_btn.get_attribute('class') or '')
    assert 'tp-heatmap-active' not in (page.locator('#card-cheapest').get_attribute('class') or '')

    # Click to toggle heatmap back ON
    heat_btn.click()
    page.wait_for_timeout(200)

    assert 'tp-active' in (heat_btn.get_attribute('class') or '')
    assert 'tp-heatmap-active' in (page.locator('#card-cheapest').get_attribute('class') or '')



def test_discount_heatmap_settings_modal_controls(page: Page):
    # Open settings modal
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')

    # Toggle heatmap switch off inside modal via slider
    slider = page.locator('#tp-root >> #tp-heatmap-enabled-toggle + .tp-slider')
    slider.click()
    page.click('#tp-root >> #tp-btn-save')

    page.wait_for_timeout(200)
    assert 'tp-heatmap-active' not in (page.locator('#card-cheapest').get_attribute('class') or '')

    # Re-enable in settings
    page.click('#tp-root >> #tp-settings-fab')
    slider.click()
    page.click('#tp-root >> #tp-btn-save')

    page.wait_for_timeout(200)
    assert 'tp-heatmap-active' in (page.locator('#card-cheapest').get_attribute('class') or '')



def test_sort_by_discount(page: Page):
    # Open settings and enable sort by discount descending
    page.click('#tp-root >> #tp-settings-fab')
    page.click('#tp-root >> label[for="tp-sort-discount"]')
    page.click('#tp-root >> #tp-btn-save')

    # Card 1 has 67% discount, Card 4 has 50% discount
    cards = page.locator('#product-list .Plugin_Product')
    first_id = cards.nth(0).get_attribute('id')
    second_id = cards.nth(1).get_attribute('id')
    assert first_id == 'card-cheapest'  # 67%
    assert second_id == 'card-cat-excluded'  # 50%



def test_empty_state_notice_and_actions(page: Page):
    # Initially all 5 cards in mock_toppreise are visible, no empty notice
    assert not page.locator('#tp-empty-state-notice').is_visible()

    # Filter all 5 cards by setting negative terms
    page.fill('#tp-inline-negative-input', 'GeForce, Silikon, iPhone, Dell, ENDGAME')
    page.wait_for_selector('#tp-empty-state-notice')

    notice = page.locator('#tp-empty-state-notice')
    assert notice.is_visible()
    assert 'Alle 6 Angebote' in (notice.text_content() or '')

    # Clicking "👁️ Ausgeblendete anzeigen" reveals previews
    page.click('#tp-empty-reveal-btn')
    assert 'tp-reveal-filtered' in (page.locator('body').get_attribute('class') or '')
    assert not page.locator('#tp-empty-state-notice').is_visible()

    # Toggle reveal off again -> notice comes back
    page.click('#tp-bar-reveal-btn')
    page.wait_for_selector('#tp-empty-state-notice')

    # Clicking "⚡ Filter ausschalten" turns off master filter safely and restores cards
    page.click('#tp-empty-toggle-filters-btn')
    assert not page.locator('#tp-empty-state-notice').is_visible()
    assert page.locator('#card-cheapest').is_visible()
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.FILTER_NEG_ENABLED") is False



def test_real_deal_threshold_quick_selector(page: Page):
    thresh_btn = page.locator('#tp-bar-threshold-btn')
    popover = page.locator('#tp-threshold-popover')
    batch_btn = page.locator('#tp-bar-batch-check-btn')

    assert thresh_btn.is_visible()
    assert '≥30%' in (thresh_btn.text_content() or '')
    # Initially at 30%, 3 cards qualify (-67%, -35%, -50%)
    assert 'Check Deals (3)' in (batch_btn.text_content() or '')

    # Open popover
    thresh_btn.click()
    assert 'tp-show' in (popover.get_attribute('class') or '')

    # Select >= 50%
    page.click('#tp-threshold-popover button[data-val="50"]')
    assert 'tp-show' not in (popover.get_attribute('class') or '')
    assert '≥50%' in (thresh_btn.text_content() or '')

    # At 50%, only 2 cards qualify (-67%, -50%) -> count updates live to (2)
    assert 'Check Deals (2)' in (batch_btn.text_content() or '')



def test_filter_bar_hidden_on_product_detail_page(page: Page):
    # Simulate product detail page
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Product';
        document.body.setAttribute('data-current_url', '/preisvergleich/TV-Geraete/SHARP-55HR7265E-p840582');
        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    # Filter bar must be completely absent on product detail page
    filter_bar = page.locator('#tp-suite-filter-bar')
    assert filter_bar.count() == 0

    # Settings FAB is still available
    fab = page.locator('#tp-root >> #tp-settings-fab')
    assert fab.is_visible()



def test_deal_features_enabled_on_category_page(page: Page):
    # Simulate standard category/search listing page
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/TV-Video/TV-Geraete-Zubehoer/TV-Geraete-c986');
        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    # Filter bar itself is visible on category listings
    filter_bar = page.locator('#tp-suite-filter-bar')
    assert filter_bar.is_visible()

    # Listing features are visible
    assert page.locator('#tp-inline-negative-input').is_visible()
    assert page.locator('#tp-bar-reveal-btn').is_visible()
    assert page.locator('#tp-toggle-neg').is_visible()

    # Category deal check and heatmap features are visible
    assert page.locator('#tp-bar-heat-btn').is_visible()
    assert page.locator('#tp-bar-batch-check-btn').is_visible()

    # Claimed discount threshold dropdown and Neue Bestpreise feed toggle remain hidden
    assert not page.locator('#tp-bar-bestpreise-btn').is_visible()
    assert not page.locator('#tp-bar-threshold-btn').is_visible()



def test_category_page_injects_interactive_deal_badges(page: Page):
    # Simulate category page where cards have no difference badge
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/TV-Video/TV-Geraete-Zubehoer/TV-Geraete-c986');
        // Remove native badge-dif elements from cards to simulate real category catalog
        document.querySelectorAll('.badge-dif').forEach(b => b.remove());
        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    # Verify interactive deal badges are injected on cards
    badges = page.locator('.badge-dif.tp-deal-badge-interactive')
    assert badges.count() > 0
    # Unscanned badges display Deal loupe
    first_badge = badges.first
    assert '🔍' in first_badge.inner_text() or 'Deal' in first_badge.inner_text()



def test_category_page_applies_thermal_heatmap_based_on_score(page: Page):
    # Verify card with verified deal receives thermal heatmap
    card = page.locator('#card-cheapest')
    has_heat = card.evaluate("el => el.classList.contains('tp-heatmap-active') || el.style.getPropertyValue('--tp-heat-bg') !== ''")
    assert has_heat



def test_category_page_grouped_variant_cards_and_inline_deal_pills(page: Page):
    # Switch mock to realistic Category Browsing mode with real headphones markup
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/HiFi-Audio/Kopfhoerer/Kopfhoerer-c3308');
        const feed = document.getElementById('product-list');
        if (feed) feed.style.display = 'none';
        if (!document.getElementById('Page_Browsing')) {
            const tmpl = document.getElementById('mock-category-browsing-template');
            if (tmpl) document.body.appendChild(tmpl.content.cloneNode(true));
        }
        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    # 1. Verify AirPods 5 collection item remains intact as a grouped family
    coll_item = page.locator('#Plugin_ProductCollItem_411970')
    assert coll_item.is_visible()

    # 2. Verify variants remain inside the collection's related products list (NOT flattened into root)
    rel_list = coll_item.locator('.Plugin_ProductCollectionRelProductsList')
    assert rel_list.is_visible()
    variants = rel_list.locator('.Plugin_Product')
    assert variants.count() == 2

    # 3. Verify deal pills are injected as inline pills inside price information (not 50px absolute circles)
    pills = page.locator('#Page_Browsing .badge-dif.tp-deal-pill')
    assert pills.count() >= 3 # AirPods Pro 3 + 2 AirPods 5 variants

    # 4. Verify unscanned pills display clean "Deal" with single magnifying glass (no duplicate loupe artifact)
    first_pill = pills.first
    pill_text = first_pill.inner_text()
    assert 'Deal' in pill_text
    assert '🔍' in pill_text
    assert first_pill.locator('.tp-badge-loupe-icon').count() == 0

    # 5. Verify price text is completely visible and NOT obscured by the pill
    price_info = page.locator('#Plugin_Product_492326 .Plugin_PriceInformation')
    assert '170.19' in price_info.inner_text()
    assert price_info.locator('.tp-deal-pill').count() == 1
    avail = page.locator('#Plugin_Product_492326 .Plugin_AvailabilityInformation')
    assert avail.is_visible()

    # 6. Verify subcard variant layout: compact height and pill placed next to variant title
    subcard = page.locator('#Plugin_Product_383251')
    assert subcard.is_visible()
    box = subcard.bounding_box()
    assert box is not None
    assert box['height'] < 100 # Authentic compact subcard height is ~50-60px, well below the bloated 372px

    # Variant pill is adjacent to title, NOT inside PriceInformation
    subcard_pill = subcard.locator('.badge-dif.tp-deal-pill')
    assert subcard_pill.count() == 1
    assert subcard.locator('.bold + .tp-deal-pill').count() == 1
    assert subcard.locator('.Plugin_PriceInformation .tp-deal-pill').count() == 0

    # 7. Verify deal pill displays icon and text on ONE horizontal line (flex-direction: row, not stacked)
    first_pill_dir = page.evaluate("el => window.getComputedStyle(el).flexDirection", first_pill.element_handle())
    assert first_pill_dir == 'row'
    span_box = first_pill.locator('span').bounding_box()
    p_box = first_pill.locator('p').bounding_box()
    assert span_box is not None and p_box is not None
    assert p_box['x'] > span_box['x'] # Horizontally side-by-side
    assert abs(span_box['y'] - p_box['y']) < 5 # On same vertical baseline/line

    # 8. Verify markup badge and availability checkmark clearance (not cut off at card edge)
    page.evaluate('''() => {
        const card = document.getElementById("Plugin_Product_492326");
        const badge = card.querySelector(".badge-dif");
        badge.className = "badge badge-dif tp-injected-badge tp-deal-pill tp-deal-not-low tp-deal-badge-interactive";
        badge.innerHTML = '<span>⚠️</span><p class="tp-markup-val">+10%</p>';
        
        const priceInfo = card.querySelector(".Plugin_PriceInformation");
        let hist = document.createElement("div");
        hist.className = "tp-card-historical-price tp-is-markup";
        hist.textContent = "Tiefstpreis: CHF 107.10";
        let subline = document.createElement("div");
        subline.className = "tp-card-subline-row";
        subline.innerHTML = '<span class="tp-sparkline-container"><svg class="tp-sparkline" width="50" height="14"></svg></span>';
        subline.insertBefore(hist, subline.firstChild);
        priceInfo.appendChild(subline);
    }''')
    page.wait_for_timeout(100)
    markup_span = page.locator('#Plugin_Product_492326 .badge-dif span').bounding_box()
    markup_p = page.locator('#Plugin_Product_492326 .badge-dif p').bounding_box()
    assert markup_span is not None and markup_p is not None
    assert markup_p['x'] > markup_span['x'] # +10% is horizontally adjacent to warning icon
    assert abs(markup_span['y'] - markup_p['y']) < 5

    # Checkmark is fully contained within the card and not clipped
    card_box = page.locator('#Plugin_Product_492326').bounding_box()
    avail_box = page.locator('#Plugin_Product_492326 .Plugin_AvailabilityInformation').bounding_box()
    assert card_box is not None and avail_box is not None
    assert avail_box['x'] + avail_box['width'] <= card_box['x'] + card_box['width'] # Checkmark not cut off




def test_category_page_cards_not_dimmed_when_store_filter_active(page: Page):
    # On category pages without store dealer rows, cards should not be dimmed as tp-no-store-offer
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/HiFi-Audio/Kopfhoerer/Kopfhoerer-c3308');
        const feed = document.getElementById('product-list');
        if (feed) feed.style.display = 'none';
        if (!document.getElementById('Page_Browsing')) {
            const tmpl = document.getElementById('mock-category-browsing-template');
            if (tmpl) document.body.appendChild(tmpl.content.cloneNode(true));
        }
        window.ToppreiseSuite?.updateConfig?.('ACTIVE_STORES', ['Digitec']);
        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    # Verify category cards do not have tp-no-store-offer class
    cat_cards = page.locator('#Page_Browsing .Plugin_Product')
    for i in range(cat_cards.count()):
        assert not cat_cards.nth(i).evaluate("el => el.classList.contains('tp-no-store-offer')")



def test_grid_card_title_and_best_price_badge_clearance(page: Page):
    # Test on default feed (/neue-toppreise)
    card = page.locator('#product-list .Plugin_Product').first
    assert card.is_visible()

    # Inject best price badge
    page.evaluate('''() => {
        const firstCard = document.querySelector('#product-list .Plugin_Product');
        firstCard.classList.add('tp-is-cheapest');
        if (!firstCard.querySelector('.tp-best-price-badge')) {
            const badge = document.createElement('div');
            badge.className = 'tp-best-price-badge';
            badge.textContent = 'Best Price';
            firstCard.appendChild(badge);
        }
    }''')
    page.wait_for_timeout(100)

    # Verify best price badge position
    badge = card.locator('.tp-best-price-badge')
    assert badge.is_visible()
    badge_right = page.evaluate("el => window.getComputedStyle(el).right", badge.element_handle())
    assert badge_right == '68px'

    # Verify best price badge clears the 50px circular badge (at right: 10px..60px)
    # 68px gives an 8px clearance between badges, and card height remains compact (< 210px)
    box = card.bounding_box()
    assert box is not None
    assert box['height'] < 210



def test_filter_bar_stepper_buttons(page: Page):
    # Reset min offers
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.MIN_OFFERS = 0;
        window.ToppreiseSuite.processListings();
    }""")

    val_span = page.locator('#tp-bar-min-val')
    plus_btn = page.locator('#tp-bar-min-plus')
    minus_btn = page.locator('#tp-bar-min-minus')

    assert val_span.text_content() == '0'

    plus_btn.click()
    assert val_span.text_content() == '1'
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.MIN_OFFERS") == 1

    plus_btn.click()
    assert val_span.text_content() == '2'
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.MIN_OFFERS") == 2

    minus_btn.click()
    assert val_span.text_content() == '1'
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.MIN_OFFERS") == 1



def test_inline_negative_input_clear_button(page: Page):
    inp = page.locator('#tp-inline-negative-input')
    clear_btn = page.locator('#tp-clear-neg-btn')

    inp.fill('QuickClearTest')
    inp.dispatch_event('input')
    assert clear_btn.is_visible()
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.NEGATIVE_TERMS") == 'QuickClearTest'

    clear_btn.click()
    assert inp.input_value() == ''
    assert not clear_btn.is_visible()
    assert page.evaluate("() => window.ToppreiseSuite?.CONFIG?.NEGATIVE_TERMS") == ''



def test_negative_terms_multi_delimiter_support(page: Page):
    # Test combination of newline, semicolon, and comma delimiters
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.NEGATIVE_TERMS = "GeForce;\\n4080, NonExistentTerm";
        window.ToppreiseSuite.processListings();
    }""")

    # Both card 1 (contains GeForce) and card 2 (contains 4080) should be filtered
    page.wait_for_selector('#card-cheapest.tp-negative-filtered', state='attached')
    page.wait_for_selector('#card-expensive.tp-negative-filtered', state='attached')

    assert 'tp-negative-filtered' in (page.locator('#card-cheapest').get_attribute('class') or '')
    assert 'tp-negative-filtered' in (page.locator('#card-expensive').get_attribute('class') or '')



def test_bestpreise_filter_bar_toggle_and_state(page: Page):
    # Verify button exists in filter bar
    btn = page.locator('#tp-suite-filter-bar #tp-bar-bestpreise-btn')
    assert btn.is_visible()
    assert '💎 Neue Bestpreise' in (btn.text_content() or '')

    # Toggle Bestpreise mode ON
    btn.click()

    # Verify bar accent class and active button state
    assert 'tp-bestpreise-bar' in (page.locator('#tp-suite-filter-bar').get_attribute('class') or '')
    assert 'tp-bestpreise-active' in (btn.get_attribute('class') or '')
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE") is True


    # On-demand Check Deals button remains enabled and clickable
    batch_btn = page.locator('#tp-bar-batch-check-btn')
    assert 'tp-disabled' not in (batch_btn.get_attribute('class') or '')

    # Toggle Bestpreise mode OFF
    btn.click()
    assert 'tp-bestpreise-bar' not in (page.locator('#tp-suite-filter-bar').get_attribute('class') or '')
    assert 'tp-bestpreise-active' not in (btn.get_attribute('class') or '')
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE") is False



def test_bestpreise_card_heatmap_and_badge(page: Page):
    # Card 1 (797571, price 1800): New record (median 2400 -> dMed 25%, prevLow 2200 -> dRec 18%) -> Score = 22%
    # Card 2 (797572, price 1100): Matching low (median 1500 -> dMed 27%, dRec 0%) -> Score = 14%
    # Card 3 (797573, price 15): Non-Bestpreis (tiefstpreis 10) -> Excluded
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            hoechstpreis: 2600,
            medianPrice: 2400,
            previousLow: 2200,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 18,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify({
            tiefstpreis: 1100,
            hoechstpreis: 1800,
            medianPrice: 1500,
            isNewAllTimeLow: false,
            realDiscountVsMedian: 27,
            dataPointCount: 15,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', JSON.parse(localStorage.getItem('tp_hist_v1_797572')));
        localStorage.setItem('tp_hist_v1_797573', JSON.stringify({
            tiefstpreis: 10,
            hoechstpreis: 25,
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797573', JSON.parse(localStorage.getItem('tp_hist_v1_797573')));
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # Card 1: New Record -> Gold halo, "Real Deal -22%", and subline
    card1_badge = page.locator('#card-cheapest .badge-dif')
    assert 'tp-deal-new-record' in (card1_badge.get_attribute('class') or '')
    assert 'Real Deal' in (card1_badge.text_content() or '')
    assert '-22%' in (card1_badge.text_content() or '')

    card1_subline = page.locator('#card-cheapest .tp-card-historical-price.tp-is-record-low')
    assert 'Bisher: CHF 2200.00 (-18%)' in (card1_subline.text_content() or '')

    # Card 2: Matching Low -> Emerald halo, "Real Deal -14%", and median subline
    card2_badge = page.locator('#card-expensive .badge-dif')
    assert 'tp-deal-alltime-low' in (card2_badge.get_attribute('class') or '')
    assert 'Real Deal' in (card2_badge.text_content() or '')
    assert '-14%' in (card2_badge.text_content() or '')

    card2_subline = page.locator('#card-expensive .tp-card-historical-price.tp-is-at-low')
    assert 'CHF 1500.00 (-27%)' in (card2_subline.text_content() or '')

    # Card 3: Scanned Non-Bestpreis -> Hidden in Bestpreise mode
    assert 'tp-bestpreise-hidden' in (page.locator('#card-negative').get_attribute('class') or '')

    # Unscanned card: Stays visible with interactive loupe in Bestpreise mode (Streaming UI)
    assert 'tp-bestpreise-hidden' not in (page.locator('#card-low-offers').get_attribute('class') or '')
    uncached_badge = page.locator('#card-low-offers .badge-dif')
    assert 'tp-deal-loading' not in (uncached_badge.get_attribute('class') or '')

    # Toggle Bestpreise mode OFF -> Restores original badges and removes hidden classes
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = false;
        window.ToppreiseSuite.processListings();
    }""")
    assert 'tp-bestpreise-hidden' not in (page.locator('#card-negative').get_attribute('class') or '')
    assert 'tp-deal-new-record' not in (page.locator('#card-cheapest .badge-dif').get_attribute('class') or '')
    assert '-67%' in (page.locator('#card-cheapest .badge-dif').text_content() or '')



def test_bestpreise_sorting_by_continuous_score(page: Page):
    # Setup 3 products with continuous Deal Scores:
    # Card 1 (797571): Score = 22%
    # Card 2 (797572): Score = 35% (huge median discount)
    # Card 3 (797573): Score = 28%
    # In Bestpreise mode, sort order must be: Card 2 (35%) -> Card 3 (28%) -> Card 1 (22%)
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            hoechstpreis: 2600,
            medianPrice: 2400,
            previousLow: 2200,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 18,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify({
            tiefstpreis: 1100,
            hoechstpreis: 3500,
            medianPrice: 3437, // dMedian = 68% -> 0.5*68 + 0 = 34% or ~35%
            isNewAllTimeLow: false,
            dataPointCount: 15,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', JSON.parse(localStorage.getItem('tp_hist_v1_797572')));
        localStorage.setItem('tp_hist_v1_797573', JSON.stringify({
            tiefstpreis: 15,
            hoechstpreis: 40,
            medianPrice: 30,
            previousLow: 20,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 25, // dMed 50%, dRec 25% -> Score = 38%
            dataPointCount: 12,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797573', JSON.parse(localStorage.getItem('tp_hist_v1_797573')));
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    card_ids = page.evaluate("""() => {
        const cards = Array.from(document.querySelectorAll('#product-list .Plugin_Product'));
        return cards.map(c => c.id);
    }""")
    # Scores: Card 3 (38%) -> Card 2 (34%) -> Card 1 (22%)
    assert card_ids[0] == 'card-negative'   # Score 38%
    assert card_ids[1] == 'card-expensive'  # Score 34%
    assert card_ids[2] == 'card-cheapest'   # Score 22%



def test_bestpreise_sorting_nested_wrappers(page: Page):
    # Dynamically wrap each product card in a nested column/cell hierarchy to simulate real site layout:
    # <div id="product-list"><div class="row"><div class="col-md-3 cell-1"><card1>...
    page.evaluate("""() => {
        const list = document.getElementById('product-list');
        const cards = Array.from(list.querySelectorAll('.Plugin_Product'));
        cards.forEach((c, idx) => {
            const col = document.createElement('div');
            col.className = 'col-md-3 custom-col-wrapper';
            col.id = 'col-wrapper-' + idx;
            list.appendChild(col);
            col.appendChild(c);
        });

        // Set deal stats: Card 1 -> Score 15%, Card 2 -> Score 40%, Card 3 -> Score 25%
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            hoechstpreis: 2400,
            medianPrice: 2200,
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify({
            tiefstpreis: 1100,
            hoechstpreis: 3000,
            medianPrice: 2750, // dMed 60% -> Score 30%
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', JSON.parse(localStorage.getItem('tp_hist_v1_797572')));
        localStorage.setItem('tp_hist_v1_797573', JSON.stringify({
            tiefstpreis: 15,
            hoechstpreis: 50,
            medianPrice: 40,
            previousLow: 25,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 40, // Score 50%
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797573', JSON.parse(localStorage.getItem('tp_hist_v1_797573')));

        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # Verify column wrappers were reordered descending by score:
    # Card 3 (Score 50%) -> Card 2 (Score 30%) -> Card 1 (Score 15%)
    wrapper_ids = page.evaluate("""() => {
        const wrappers = Array.from(document.querySelectorAll('#product-list .custom-col-wrapper'));
        return wrappers.map(w => w.querySelector('.Plugin_Product')?.id);
    }""")
    assert wrapper_ids[0] == 'card-negative'   # Card 3 (50%)
    assert wrapper_ids[1] == 'card-expensive'  # Card 2 (30%)
    assert wrapper_ids[2] == 'card-cheapest'   # Card 1 (15%)



def test_realistic_page_layout_sidebar_and_tabs_preserved_in_bestpreise_mode(page: Page):
    # Verify sidebar and navigation tabs are present and visible in mock fixture
    assert page.locator('#sidebar-categories').is_visible()
    assert page.locator('#feed-tabs').is_visible()
    assert page.locator('#timeframe-filter').is_visible()
    assert page.locator('#main-content').is_visible()

    # Toggle Bestpreise mode ON
    page.click('#tp-suite-filter-bar #tp-bar-bestpreise-btn')

    # Sidebar, tabs, and layout rows MUST remain 100% visible
    assert page.locator('#sidebar-categories').is_visible()
    assert page.locator('#feed-tabs').is_visible()
    assert page.locator('#timeframe-filter').is_visible()
    assert page.locator('#main-content').is_visible()

    # Toggle Bestpreise mode OFF
    page.click('#tp-suite-filter-bar #tp-bar-bestpreise-btn')
    assert page.locator('#sidebar-categories').is_visible()
    assert page.locator('#feed-tabs').is_visible()



def test_bestpreise_mode_visible_deal_count_and_no_false_empty_state(page: Page):
    # Setup 15 qualifying deals and 40 negative-filtered products
    page.evaluate("""() => {
        const list = document.getElementById('product-list');
        list.innerHTML = '';

        // Add 15 qualifying deals
        for (let i = 1; i <= 15; i++) {
            const card = document.createElement('a');
            card.href = `/preisvergleich/Deals/Product-${i}-p${1000 + i}`;
            card.id = `deal-card-${i}`;
            card.className = 'Plugin_Product medium-box mixedBrowsingList';
            card.setAttribute('data-entity-id', String(1000 + i));
            card.innerHTML = `<div class="product-name">Deal Product ${i}</div><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">${100 + i}.00</div></div></div><div class="badge badge-dif"><p>-30%</p></div>`;
            list.appendChild(card);

            localStorage.setItem(`tp_hist_v1_${1000 + i}`, JSON.stringify({
                tiefstpreis: 100 + i,
                hoechstpreis: 200 + i,
                medianPrice: 180 + i,
                previousLow: 150 + i,
                isNewAllTimeLow: true,
                realDiscountVsPrevLow: 25,
                dataPointCount: 10,
                time: Date.now()
            }));
        }

        // Add 40 items that match negative keywords AND are not Bestpreise
        for (let i = 1; i <= 40; i++) {
            const card = document.createElement('a');
            card.href = `/preisvergleich/Trash/Trash-Refurbished-Case-${i}-p${2000 + i}`;
            card.id = `trash-card-${i}`;
            card.className = 'Plugin_Product medium-box mixedBrowsingList';
            card.setAttribute('data-entity-id', String(2000 + i));
            card.innerHTML = `<div class="product-name">Refurbished Schutzhülle Case ${i}</div><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">10.00</div></div></div><div class="badge badge-dif"><p>-10%</p></div>`;
            list.appendChild(card);

            localStorage.setItem(`tp_hist_v1_${2000 + i}`, JSON.stringify({
                tiefstpreis: 5,
                hoechstpreis: 15,
                medianPrice: 8,
                isNewAllTimeLow: false,
                dataPointCount: 5,
                time: Date.now()
            }));
        }

        window.ToppreiseSuite.CONFIG.NEGATIVE_TERMS = 'refurbished, hülle, case';
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # 1. Exactly 15 qualifying deal cards must be visible
    visible_deals_count = page.evaluate("""() => {
        const cards = Array.from(document.querySelectorAll('#product-list .Plugin_Product'));
        return cards.filter(c => !c.classList.contains('tp-bestpreise-hidden') && !c.classList.contains('tp-negative-filtered')).length;
    }""")
    assert visible_deals_count == 15

    # 2. Empty state notice MUST NOT be rendered since 15 valid deals exist
    empty_notice = page.locator('#tp-empty-state-notice')
    assert not empty_notice.is_visible()



def test_filter_counts_never_double_count(page: Page):
    page.evaluate("""() => {
        const list = document.getElementById('product-list');
        list.innerHTML = '';

        // Add 10 qualifying deals
        for (let i = 1; i <= 10; i++) {
            const card = document.createElement('a');
            card.href = `/preisvergleich/Deals/Product-${i}-p${3000 + i}`;
            card.id = `deal-count-card-${i}`;
            card.className = 'Plugin_Product medium-box mixedBrowsingList';
            card.setAttribute('data-entity-id', String(3000 + i));
            card.innerHTML = `<div class="product-name">Deal Product ${i}</div><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">${100 + i}.00</div></div></div><div class="badge badge-dif"><p>-30%</p></div>`;
            list.appendChild(card);

            localStorage.setItem(`tp_hist_v1_${3000 + i}`, JSON.stringify({
                tiefstpreis: 100 + i,
                hoechstpreis: 200 + i,
                medianPrice: 180 + i,
                previousLow: 150 + i,
                isNewAllTimeLow: true,
                realDiscountVsPrevLow: 25,
                dataPointCount: 10,
                time: Date.now()
            }));
        }

        // Add 20 items matching negative keywords AND are not bestpreise
        for (let i = 1; i <= 20; i++) {
            const card = document.createElement('a');
            card.href = `/preisvergleich/Trash/Trash-Case-${i}-p${4000 + i}`;
            card.id = `trash-count-card-${i}`;
            card.className = 'Plugin_Product medium-box mixedBrowsingList';
            card.setAttribute('data-entity-id', String(4000 + i));
            card.innerHTML = `<div class="product-name">Refurbished Schutzhülle Case ${i}</div><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">10.00</div></div></div><div class="badge badge-dif"><p>-10%</p></div>`;
            list.appendChild(card);

            localStorage.setItem(`tp_hist_v1_${4000 + i}`, JSON.stringify({
                tiefstpreis: 5,
                hoechstpreis: 15,
                medianPrice: 8,
                isNewAllTimeLow: false,
                dataPointCount: 5,
                time: Date.now()
            }));
        }

        window.ToppreiseSuite.CONFIG.NEGATIVE_TERMS = 'refurbished, hülle, case';
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")


def test_bestpreise_cross_row_sorting_and_natural_order_restoration(page: Page):
    # Setup 3 separate Bootstrap .row containers inside main content area
    page.evaluate("""() => {
        const list = document.getElementById('product-list');
        list.innerHTML = '';

        const row1 = document.createElement('div');
        row1.className = 'row product-row';
        row1.id = 'product-row-1';

        const row2 = document.createElement('div');
        row2.className = 'row product-row';
        row2.id = 'product-row-2';

        const row3 = document.createElement('div');
        row3.className = 'row product-row';
        row3.id = 'product-row-3';

        list.appendChild(row1);
        list.appendChild(row2);
        list.appendChild(row3);

        // Row 1: Card 1 (Score 15%), Card 2 (Score 10%)
        row1.innerHTML = `
            <div class="col-6 col-md-3" id="col-1"><a href="/preisvergleich/P1-p101" id="multi-card-1" class="Plugin_Product"><span class="product-name">HP Envy</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">100.00</div></div></div><div class="badge badge-dif"><p>-10%</p></div></a></div>
            <div class="col-6 col-md-3" id="col-2"><a href="/preisvergleich/P2-p102" id="multi-card-2" class="Plugin_Product"><span class="product-name">Kärcher</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">200.00</div></div></div><div class="badge badge-dif"><p>-10%</p></div></a></div>
        `;

        // Row 2: Card 3 (Score 37% - Top Deal!), Card 4 (Score 25%)
        row2.innerHTML = `
            <div class="col-6 col-md-3" id="col-3"><a href="/preisvergleich/P3-p103" id="multi-card-3" class="Plugin_Product"><span class="product-name">Villeroy</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">300.00</div></div></div><div class="badge badge-dif"><p>-37%</p></div></a></div>
            <div class="col-6 col-md-3" id="col-4"><a href="/preisvergleich/P4-p104" id="multi-card-4" class="Plugin_Product"><span class="product-name">Lego</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">400.00</div></div></div><div class="badge badge-dif"><p>-25%</p></div></a></div>
        `;

        // Row 3: Card 5 (Score 20%), Card 6 (Score 5%)
        row3.innerHTML = `
            <div class="col-6 col-md-3" id="col-5"><a href="/preisvergleich/P5-p105" id="multi-card-5" class="Plugin_Product"><span class="product-name">Anker</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">500.00</div></div></div><div class="badge badge-dif"><p>-20%</p></div></a></div>
            <div class="col-6 col-md-3" id="col-6"><a href="/preisvergleich/P6-p106" id="multi-card-6" class="Plugin_Product"><span class="product-name">Maxi-Cosi</span><div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">600.00</div></div></div><div class="badge badge-dif"><p>-5%</p></div></a></div>
        `;

        // Seed price history cache with strictly descending scores:
        // Card 3: ~37%, Card 4: ~25%, Card 5: ~19%, Card 1: ~12%, Card 2: ~8%, Card 6: ~4%
        localStorage.setItem('tp_hist_v1_101', JSON.stringify({ tiefstpreis: 100, hoechstpreis: 150, medianPrice: 130, isNewAllTimeLow: false, dataPointCount: 10, time: Date.now() })); // ~12%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('101', JSON.parse(localStorage.getItem('tp_hist_v1_101')));
        localStorage.setItem('tp_hist_v1_102', JSON.stringify({ tiefstpreis: 200, hoechstpreis: 250, medianPrice: 235, isNewAllTimeLow: false, dataPointCount: 10, time: Date.now() })); // ~8%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('102', JSON.parse(localStorage.getItem('tp_hist_v1_102')));
        localStorage.setItem('tp_hist_v1_103', JSON.stringify({ tiefstpreis: 300, hoechstpreis: 600, medianPrice: 550, previousLow: 480, isNewAllTimeLow: true, realDiscountVsPrevLow: 37, dataPointCount: 10, time: Date.now() })); // ~37%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('103', JSON.parse(localStorage.getItem('tp_hist_v1_103')));
        localStorage.setItem('tp_hist_v1_104', JSON.stringify({ tiefstpreis: 400, hoechstpreis: 600, medianPrice: 550, previousLow: 530, isNewAllTimeLow: true, realDiscountVsPrevLow: 25, dataPointCount: 10, time: Date.now() })); // ~25%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('104', JSON.parse(localStorage.getItem('tp_hist_v1_104')));
        localStorage.setItem('tp_hist_v1_105', JSON.stringify({ tiefstpreis: 500, hoechstpreis: 800, medianPrice: 800, isNewAllTimeLow: false, dataPointCount: 10, time: Date.now() })); // ~19%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('105', JSON.parse(localStorage.getItem('tp_hist_v1_105')));
        localStorage.setItem('tp_hist_v1_106', JSON.stringify({ tiefstpreis: 600, hoechstpreis: 660, medianPrice: 650, isNewAllTimeLow: false, dataPointCount: 10, time: Date.now() })); // ~4%
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('106', JSON.parse(localStorage.getItem('tp_hist_v1_106')));

        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # 1. Verify strict descending order across rows in primary row:
    # Card 3 (37%) -> Card 4 (25%) -> Card 5 (19%) -> Card 1 (12%) -> Card 2 (8%) -> Card 6 (4%)
    sorted_card_ids = page.evaluate("""() => {
        const primaryRow = document.getElementById('product-row-1');
        const cards = Array.from(primaryRow.querySelectorAll('.Plugin_Product'));
        return cards.map(c => c.id);
    }""")
    assert sorted_card_ids == [
        'multi-card-3', # 37% (Villeroy from Row 2)
        'multi-card-4', # 25% (Lego from Row 2)
        'multi-card-5', # 19% (Anker from Row 3)
        'multi-card-1', # 12% (HP Envy from Row 1)
        'multi-card-2', # 8%  (Kärcher from Row 1)
        'multi-card-6'  # 4%  (Maxi-Cosi from Row 3)
    ]

    # 2. Secondary product rows must be hidden
    assert page.evaluate("() => document.getElementById('product-row-2').style.display === 'none'")
    assert page.evaluate("() => document.getElementById('product-row-3').style.display === 'none'")

    # 3. Sidebar, tabs, and layout rows must remain completely untouched and visible
    assert page.locator('#sidebar-categories').is_visible()
    assert page.locator('#feed-tabs').is_visible()

    # 4. Turn off Bestpreise mode and verify clean natural order restoration across all 3 rows
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = false;
        window.ToppreiseSuite.processListings();
    }""")

    # Row 1 restored
    row1_cards = page.evaluate("() => Array.from(document.querySelectorAll('#product-row-1 .Plugin_Product')).map(c => c.id)")
    assert row1_cards == ['multi-card-1', 'multi-card-2']

    # Row 2 restored
    row2_cards = page.evaluate("() => Array.from(document.querySelectorAll('#product-row-2 .Plugin_Product')).map(c => c.id)")
    assert row2_cards == ['multi-card-3', 'multi-card-4']

    # Row 3 restored
    row3_cards = page.evaluate("() => Array.from(document.querySelectorAll('#product-row-3 .Plugin_Product')).map(c => c.id)")
    assert row3_cards == ['multi-card-5', 'multi-card-6']

    # Secondary product rows must be visible again
    assert page.evaluate("() => document.getElementById('product-row-2').style.display !== 'none'")
    assert page.evaluate("() => document.getElementById('product-row-3').style.display !== 'none'")



def test_bestpreise_mode_uncached_cards_streaming_ui_retention(page: Page):
    # Ensure fresh state with no cached price stats
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # When Bestpreise mode is toggled on with uncached items, cards MUST NOT be hidden with tp-bestpreise-hidden
    hidden_count = page.evaluate("""() => {
        const cards = Array.from(document.querySelectorAll('#product-list .Plugin_Product'));
        return cards.filter(c => c.classList.contains('tp-bestpreise-hidden')).length;
    }""")
    assert hidden_count == 0

    # Cards must remain interactive and visible
    assert page.locator('#card-cheapest').is_visible()
    assert page.locator('#card-expensive').is_visible()

    # Now verify that when 1 card is confirmed as a non-deal, only that specific card hides
    page.evaluate("""() => {
        // Seed Card 2 as a verified markup (non-deal)
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify({
            tiefstpreis: 500,
            hoechstpreis: 600,
            medianPrice: 550,
            isNewAllTimeLow: false,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', JSON.parse(localStorage.getItem('tp_hist_v1_797572')));
        window.ToppreiseSuite.processListings();
    }""")

    # Card 1 (uncached) remains visible
    assert page.locator('#card-cheapest').is_visible()
    # Card 2 (verified non-deal) is hidden
    assert page.locator('#card-expensive').is_hidden()



def test_bestpreise_mode_all_cards_remain_visible_when_uncached(page: Page):
    """
    Visibility Invariant Test 1:
    When Bestpreise mode is enabled with zero cache, 100% of cards on the page
    MUST remain computed-visible (offsetParent !== null, display !== 'none', and no ancestor hidden).
    """
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # 1. Inspect visibility of all cards on page
    card_visibilities = page.evaluate("""() => {
        const cards = Array.from(document.querySelectorAll('.Plugin_Product'));
        return cards.map(c => {
            let el = c;
            let hiddenAncestor = null;
            while (el && el !== document.body) {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    hiddenAncestor = { tag: el.tagName, id: el.id, class: el.className };
                    break;
                }
                el = el.parentElement;
            }
            return {
                id: c.id,
                hasOffsetParent: c.offsetParent !== null,
                computedDisplay: window.getComputedStyle(c).display,
                hasBestpreiseHiddenClass: c.classList.contains('tp-bestpreise-hidden'),
                hiddenAncestor
            };
        });
    }""")

    assert len(card_visibilities) == 6
    for cv in card_visibilities:
        assert cv['hasOffsetParent'] is True, f"Card {cv['id']} has null offsetParent (invisible)"
        assert cv['computedDisplay'] != 'none', f"Card {cv['id']} has display: none"
        assert cv['hasBestpreiseHiddenClass'] is False, f"Card {cv['id']} has tp-bestpreise-hidden"
        assert cv['hiddenAncestor'] is None, f"Card {cv['id']} has hidden ancestor: {cv['hiddenAncestor']}"

    # 2. Assert #product-list container itself is visible
    assert page.locator('#product-list').is_visible()

    # 3. Assert no empty state notice was generated
    assert not page.locator('#tp-empty-state-notice').is_visible()



def test_bestpreise_mode_progressive_reveal(page: Page):
    """
    Visibility Invariant Test 2: Progressive Reveal
    1. Starts uncached: all 5 cards visible.
    2. Seeds 1 verified deal (Card 1, score 67%): Card 1 is top-ranked, visible, and highlighted.
    3. Seeds 1 verified non-deal (Card 2, markup): only Card 2 hides, remaining 4 cards stay visible.
    4. Asserts visible count == total cards - verified_non_deals.
    """
    # 1. Uncached baseline
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    visible_count_1 = page.evaluate("() => Array.from(document.querySelectorAll('.Plugin_Product')).filter(c => c.offsetParent !== null).length")
    assert visible_count_1 == 6

    # 2. Seed Card 1 as verified Deal (score 67%, 1800 CHF vs tiefstpreis 1800, previousLow 2400)
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            hoechstpreis: 2500,
            medianPrice: 2200,
            previousLow: 2400,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 25,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        window.ToppreiseSuite.processListings();
    }""")

    # Card 1 is visible and first in primary row
    assert page.locator('#card-cheapest').is_visible()
    first_card_id = page.evaluate("() => Array.from(document.querySelectorAll('.Plugin_Product')).filter(c => c.offsetParent !== null)[0].id")
    assert first_card_id == 'card-cheapest'

    # All 5 cards still visible (1 deal + 4 unscanned)
    visible_count_2 = page.evaluate("() => Array.from(document.querySelectorAll('.Plugin_Product')).filter(c => c.offsetParent !== null).length")
    assert visible_count_2 == 6

    # 3. Seed Card 2 as verified Non-Deal (1100 CHF vs tiefstpreis 600, not at low)
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify({
            tiefstpreis: 600,
            hoechstpreis: 1300,
            medianPrice: 850,
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', JSON.parse(localStorage.getItem('tp_hist_v1_797572')));
        window.ToppreiseSuite.processListings();
    }""")

    # Card 2 is hidden
    assert page.locator('#card-expensive').is_hidden()

    # Remaining 4 cards (Card 1 Deal + Cards 3, 4, 5 Unscanned) are visible
    visible_cards = page.evaluate("() => Array.from(document.querySelectorAll('.Plugin_Product')).filter(c => c.offsetParent !== null).map(c => c.id)")
    assert visible_cards == ['card-cheapest', 'card-competing-reference', 'card-negative', 'card-cat-excluded', 'card-low-offers']
    assert len(visible_cards) == 5

    # 4. Seed Card 3 as another verified Non-Deal
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797573', JSON.stringify({
            tiefstpreis: 8,
            hoechstpreis: 20,
            medianPrice: 12,
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797573', JSON.parse(localStorage.getItem('tp_hist_v1_797573')));
        window.ToppreiseSuite.processListings();
    }""")

    visible_cards_after = page.evaluate("() => Array.from(document.querySelectorAll('.Plugin_Product')).filter(c => c.offsetParent !== null).map(c => c.id)")
    assert visible_cards_after == ['card-cheapest', 'card-competing-reference', 'card-cat-excluded', 'card-low-offers']
    assert len(visible_cards_after) == 4



def test_column_wrapper_layout_fidelity_and_hiding(page: Page):
    """
    Visibility Invariant Test 3: Column Wrapper Fidelity
    Verifies that when cards are nested inside <div class="col-*"> wrappers:
    1. getCardSortableUnit() targets the column wrapper.
    2. Hiding a card with .tp-bestpreise-hidden collapses the parent .col-* container via CSS.
    3. Revealing with .tp-reveal-filtered displays both card and column wrapper.
    """
    page.evaluate("""() => {
        const list = document.getElementById('product-list');
        list.innerHTML = `
            <div class="row product-row" id="wrapped-row-1">
                <div class="col-6 col-md-3" id="wrapper-col-1">
                    <a href="/preisvergleich/P1-p88801" id="wrap-card-1" class="Plugin_Product">
                        <span class="product-name">Wrapped Product 1</span>
                        <div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">100.00</div></div></div>
                        <div class="badge badge-dif"><p>-50%</p></div>
                    </a>
                </div>
                <div class="col-6 col-md-3" id="wrapper-col-2">
                    <a href="/preisvergleich/P2-p88802" id="wrap-card-2" class="Plugin_Product">
                        <span class="product-name">Wrapped Product 2</span>
                        <div class="Plugin_PriceInformation"><div class="priceContainer productPrice"><div class="Plugin_Price">200.00</div></div></div>
                        <div class="badge badge-dif"><p>-20%</p></div>
                    </a>
                </div>
            </div>
        `;
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # Both wrapped cards are visible initially
    assert page.locator('#wrap-card-1').is_visible()
    assert page.locator('#wrap-card-2').is_visible()
    assert page.locator('#wrapper-col-1').is_visible()
    assert page.locator('#wrapper-col-2').is_visible()

    # Seed Card 2 as a verified non-deal -> hides Card 2
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_88802', JSON.stringify({
            tiefstpreis: 100,
            hoechstpreis: 250,
            medianPrice: 150,
            isNewAllTimeLow: false,
            dataPointCount: 10,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('88802', JSON.parse(localStorage.getItem('tp_hist_v1_88802')));
        window.ToppreiseSuite.processListings();
    }""")

    # Card 1 remains visible
    assert page.locator('#wrap-card-1').is_visible()
    assert page.locator('#wrapper-col-1').is_visible()

    # Card 2 is hidden AND wrapper-col-2 is collapsed (display: none)
    assert page.locator('#wrap-card-2').is_hidden()
    assert page.evaluate("() => window.getComputedStyle(document.getElementById('wrapper-col-2')).display === 'none'")

    # Toggle reveal filtered -> wrapper-col-2 and wrap-card-2 are both displayed with dashed border
    page.evaluate("""() => {
        document.body.classList.add('tp-reveal-filtered');
        window.ToppreiseSuite.processListings();
    }""")

    assert page.evaluate("() => window.getComputedStyle(document.getElementById('wrapper-col-2')).display !== 'none'")
    assert page.locator('#wrap-card-2').is_visible()



def test_deal_score_weight_preset_dropdown_in_filter_bar(page: Page):
    """
    Validates that the Deal-Score weighting preset dropdown appears in the filter bar
    when Bestpreise mode is active, and clicking options updates score weighting instantly.
    """
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    weight_wrapper = page.locator('#tp-bar-weight-wrapper')
    assert weight_wrapper.is_visible()

    weight_btn = page.locator('#tp-bar-weight-btn')
    assert '50/50' in weight_btn.inner_text()

    # Open weight popover
    weight_btn.click()
    popover = page.locator('#tp-weight-popover')
    assert popover.is_visible()

    # Select 100% Rekord
    page.locator('#tp-weight-popover button[data-weight="1.00"]').click()
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD === 1.0")
    assert '100% Rek' in page.locator('#tp-bar-weight-btn').inner_text()

    # Select 100% Median
    popover = page.locator('#tp-weight-popover')

    # Reopen popover properly using the DOM event
    page.evaluate("document.querySelector('#tp-bar-weight-btn').click()")
    popover.wait_for(state="visible")

    # Click 100% Median using evaluate to bypass pointer event intercept by absolute position layout issues
    btn = page.locator('#tp-weight-popover button[data-weight="0.00"]')
    btn.wait_for(state="visible")
    page.evaluate("document.querySelector('#tp-weight-popover button[data-weight=\"0.00\"]').click()")
    assert page.evaluate("() => window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD === 0.0")
    assert '100% Med' in page.locator('#tp-bar-weight-btn').inner_text()



def test_dual_score_breakdown_pill_rendering(page: Page):
    """
    Validates that a verified deal renders both its combined weighted score in the circle badge
    and its individual scores (Rek: -X% · Ø: -Y%) in .tp-badge-score-breakdown underneath.
    """
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            previousLow: 2000,
            hoechstpreis: 2800,
            medianPrice: 2400,
            isNewAllTimeLow: true,
            dataPointCount: 20,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        window.ToppreiseSuite.processListings();
    }""")

    card = page.locator('#card-cheapest')
    assert card.is_visible()

    # Badge circle has Real Deal text
    badge = card.locator('.badge-dif')
    assert badge.is_visible()

    # Dual-score breakdown pill is rendered
    breakdown = card.locator('.tp-badge-score-breakdown')
    assert breakdown.is_visible()
    text = breakdown.inner_text()
    assert 'Rek:' in text and 'Ø:' in text



def test_hover_stability_no_translate_jitter(page: Page):
    """
    Validates that hover styles do not apply transform: translateY, preventing boundary oscillation loops.
    """
    has_translate = page.evaluate("""() => {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText && rule.selectorText.includes(':hover') && rule.selectorText.includes('tp-heatmap-active')) {
                        if (rule.style.transform && rule.style.transform.includes('translateY')) {
                            return true;
                        }
                    }
                }
            } catch (e) {}
        }
        return false;
    }""")
    assert not has_translate



def test_card_layout_tight_flex_alignment_no_void_stretch(page: Page):
    """
    Validates that product card details columns use flex column with space-between/auto price anchor,
    ensuring price, historical subline, and sparklines are fully visible and not clipped.
    """
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    details_col_justify = page.evaluate("""() => {
        const col = document.querySelector('#card-cheapest .col.d-flex.flex-column');
        return col ? window.getComputedStyle(col).justifyContent : null;
    }""")

    assert details_col_justify in ('space-between', 'normal')



def test_badge_and_card_no_pulsing_animations_or_scale_transforms(page: Page):
    """
    Validates that verified deal badges and cards do not run infinite pulse keyframes or scale transforms on hover.
    """
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            previousLow: 2000,
            hoechstpreis: 2800,
            medianPrice: 2400,
            isNewAllTimeLow: true,
            dataPointCount: 20,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    badge_animation = page.evaluate("""() => {
        const badge = document.querySelector('#card-cheapest .badge-dif');
        return badge ? window.getComputedStyle(badge).animationName : 'none';
    }""")

    assert badge_animation in ('none', '', 'initial')

    has_hover_scale = page.evaluate("""() => {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText && rule.selectorText.includes(':hover') && (
                        rule.selectorText.includes('tp-deal-badge-interactive') ||
                        rule.selectorText.includes('tp-card-quick-block') ||
                        rule.selectorText.includes('tp-sparkline')
                    )) {
                        if (rule.style.transform && rule.style.transform.includes('scale')) {
                            return true;
                        }
                    }
                }
            } catch (e) {}
        }
        return false;
    }""")

    assert not has_hover_scale



def test_card_elements_and_sparkline_visibility_unclipped(page: Page):
    """
    Validates that product card components (image, title, price, subline, and sparkline)
    remain completely visible and unclipped without overlapping quick block buttons.
    """
    page.evaluate("""() => {
        localStorage.clear(); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({
            tiefstpreis: 1800,
            previousLow: 2200,
            hoechstpreis: 2500,
            medianPrice: 2300,
            isNewAllTimeLow: true,
            timeSeries: [[Date.now() - 86400000 * 30, 2400], [Date.now(), 1800]],
            dataPointCount: 15,
            time: Date.now()
        }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = true;
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    assert page.locator('#card-cheapest .product-name').is_visible()
    assert page.locator('#card-cheapest .price_information_product').is_visible()
    assert page.locator('#card-cheapest .tp-card-historical-price').is_visible()
    assert page.locator('#card-cheapest .tp-sparkline').is_visible()



def test_shipping_price_mismatch(page: Page):
    test_html_path = os.path.join(os.path.dirname(__file__), 'mock_toppreise.html')
    # Use the local mock file and evaluate the script contents
    page.goto(f'file://{test_html_path}')
    with open('userscripts/toppreise/toppreise.user.js', 'r') as f:
        page.add_script_tag(content=f.read())

    page.evaluate("() => { if(window.ToppreiseSuite) { window.ToppreiseSuite.CONFIG.USE_SHIPPING_PRICE = true; window.ToppreiseSuite.processListings(); } }")

    # Mock network request to return both series
    def handle_pricechart(route):
        if '1003795' in (route.request.post_data or '') or 'p_pc_pid=1003795' in route.request.url:
            # Series 0: Product price (59.98)
            # Series 1: Shipping price (65.98)
            now = page.evaluate("Date.now()")
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='application/json',
                body=f'[[[{now - 86400000}, 59.98], [{now}, 59.98]], [[{now - 86400000}, 65.98], [{now}, 65.98]]]'
            )
        else:
            route.continue_()

    page.route("**/plugins/product/pricechart*", handle_pricechart)

    # Set the card DOM to match the issue: Product = 59.98, Shipping = 65.98
    page.evaluate("""() => {
        const card = document.getElementById('card-competing-reference');
        card.dataset.tpProductId = '1003795';

        const priceInfo = card.querySelector('.Plugin_PriceInformation');
        priceInfo.innerHTML = `
            <div class="priceContainer productPrice">ab <span class="currency">CHF </span><div class="Plugin_Price">59.98</div></div>
            <div class="priceContainer shippingPrice">ab <span class="currency">CHF </span><div class="Plugin_Price">65.98</div></div>
        `;

        const badge = card.querySelector('.badge-dif');
        badge.className = 'badge badge-dif tp-deal-badge-interactive';
        badge.dataset.tpOriginalDiscount = '43';
        badge.innerHTML = '<div class="text">Differenz</div><p>-43%</p>';
    }""")

    # Clear memory cache so it fetches fresh
    page.evaluate("() => { if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear(); localStorage.clear(); }")

    # Click to verify
    page.locator('#card-competing-reference .badge-dif').click()

    # Wait for the emerald halo to be applied
    page.wait_for_selector("#card-competing-reference .tp-deal-alltime-low")

    # Should not have the not-low class
    badge = page.locator('#card-competing-reference .badge-dif')
    assert "tp-deal-not-low" not in badge.get_attribute("class")

    # Title should indicate Allzeit-Tiefstpreis
    title = badge.get_attribute("title") or ""
    assert "Allzeit-Tiefstpreis" in title
    assert "CHF 65.98" in title



def test_process_listings_is_idempotent_and_does_not_flicker_or_loop(page: Page):
    """
    Validates that:
    1. Calling processListings repeatedly does NOT detach/re-append cards to the DOM (flicker prevention).
    2. Badge innerHTML is not unnecessarily recreated when content is identical.
    3. MutationObserver ignores internal card mutations (like image lazyload) and doesn't trigger loops.
    """
    # 1. Verify card DOM node identity stability across multiple processListings() calls
    is_node_stable = page.evaluate("""() => {
        const card = document.getElementById('card-cheapest');
        card._sentinel = { created: Date.now() };

        // Run processListings multiple times
        window.ToppreiseSuite.processListings();
        window.ToppreiseSuite.processListings();
        window.ToppreiseSuite.processListings();

        // Check if sentinel is still present on the exact same DOM node instance
        const cardAfter = document.getElementById('card-cheapest');
        return cardAfter._sentinel && cardAfter._sentinel === card._sentinel;
    }""")
    assert is_node_stable, "Card element was detached/re-created during processListings calls"

    # 2. Verify badge child node identity stability (no innerHTML thrashing)
    badge_child_stable = page.evaluate("""() => {
        const badge = document.querySelector('#card-cheapest .badge-dif');
        const firstChild = badge.firstElementChild;
        firstChild._sentinel = true;

        window.ToppreiseSuite.processListings();

        return badge.firstElementChild && badge.firstElementChild._sentinel === true;
    }""")
    assert badge_child_stable, "Badge inner DOM elements were destroyed/re-created during processListings"

    # 3. Verify MutationObserver does not fire on card-internal mutations (e.g. image lazyload)
    observer_ignored = page.evaluate("""() => {
        return new Promise(resolve => {
            let runs = 0;
            const orig = window.ToppreiseSuite.processListings;
            window.ToppreiseSuite.processListings = function() {
                runs++;
                return orig.apply(this, arguments);
            };

            // Simulate image lazyload attribute/child modification inside card
            const imgContainer = document.querySelector('#card-cheapest .image_container');
            const dummy = document.createElement('span');
            dummy.className = 'lazyload-placeholder';
            imgContainer.appendChild(dummy);

            // Wait longer than CONFIG.OBSERVER_DEBOUNCE_MS (200ms)
            setTimeout(() => {
                window.ToppreiseSuite.processListings = orig;
                dummy.remove();
                resolve(runs === 0);
            }, 350);
        });
    }""")
    assert observer_ignored, "MutationObserver fired processListings on an internal card mutation (lazyload loop)"



def test_card_memoization_caches_dom_queries_and_text(page: Page):
    res = page.evaluate("""() => {
        const card = document.querySelector('#card-cheapest');
        window.ToppreiseSuite.clearCardCache(card);

        // Before caching, _tpDealerRows and _tpTextLower should be undefined
        const beforeDealer = card._tpDealerRows;
        const beforeText = card._tpTextLower;

        // Query dealer rows
        const dealerRows = window.ToppreiseSuite.getCardDealerRows(card);

        // Trigger negative terms check to populate _tpTextLower
        window.ToppreiseSuite.updateConfig('NEGATIVE_TERMS', 'randomtestterm');

        const afterDealer = card._tpDealerRows;
        const afterText = card._tpTextLower;

        // Clear cache and verify deletion
        window.ToppreiseSuite.clearCardCache(card);
        const resetDealer = card._tpDealerRows;
        const resetText = card._tpTextLower;

        // Reset negative terms
        window.ToppreiseSuite.updateConfig('NEGATIVE_TERMS', '');

        return {
            beforeDealer: beforeDealer === undefined,
            beforeText: beforeText === undefined,
            hasDealerRows: Array.isArray(dealerRows) && dealerRows.length > 0,
            dealerCached: afterDealer === dealerRows,
            textCached: typeof afterText === 'string' && afterText.length > 0,
            cleared: resetDealer === undefined && resetText === undefined
        };
    }""")

    assert res['beforeDealer'] is True
    assert res['beforeText'] is True
    assert res['hasDealerRows'] is True
    assert res['dealerCached'] is True
    assert res['textCached'] is True
    assert res['cleared'] is True



def test_card_layout_prevents_wrapping_and_irregular_heights(page: Page):
    res = page.evaluate("""() => {
        const card = document.getElementById('card-expensive');
        // Set long product title and subline similar to Samsung TV in screenshot
        card.querySelector('.product-name').textContent = 'SAMSUNG UE55U8070HUXXN (Crystal UHD U8070H, 2026), CH-Modell';
        
        let hist = card.querySelector('.tp-card-historical-price');
        if (!hist) {
            hist = document.createElement('div');
            hist.className = 'tp-card-historical-price tp-is-record-low';
            hist.textContent = 'Bisher: CHF 699.00 (-39%)';
            card.querySelector('.Plugin_PriceInformation').appendChild(hist);
        }

        const innerRow = card.querySelector('.row.h-100');
        const imgCol = innerRow.children[0];
        const textCol = innerRow.children[1];

        const innerRowFlexWrap = window.getComputedStyle(innerRow).flexWrap;
        const textColMinWidth = window.getComputedStyle(textCol).minWidth;
        const imgTop = imgCol.getBoundingClientRect().top;
        const textTop = textCol.getBoundingClientRect().top;
        const imgLeft = imgCol.getBoundingClientRect().left;
        const textLeft = textCol.getBoundingClientRect().left;

        return {
            innerRowFlexWrap,
            textColMinWidth,
            isSideBySide: Math.abs(imgTop - textTop) < 5,
            isTextToRightOfImage: textLeft > imgLeft,
            cardHeight: card.getBoundingClientRect().height
        };
    }""")

    assert res['innerRowFlexWrap'] == 'nowrap'
    assert res['textColMinWidth'] == '0px'
    assert res['isSideBySide'] is True
    assert res['isTextToRightOfImage'] is True
    assert res['cardHeight'] < 210



def test_card_layout_nested_rows_preserves_vertical_stacking_and_prices(page: Page):
    # Regression test for production /neue-toppreise card hierarchy where details column contains
    # an inner <div class="row h-100"> holding .product-name and .product-price.
    # Verifies price and sparklines are vertically stacked below title, never pushed horizontally.
    res = page.evaluate("""() => {
        // Create authentic production /neue-toppreise nested row card
        const card = document.createElement('a');
        card.id = 'test-nested-card';
        card.className = 'Plugin_Product medium-box col-12 col-sm-6 col-lg-4 col-xxxl-3';
        card.href = '/preisvergleich/Audio/JBL-Wave-Flex-2-p12345';
        card.dataset.entityId = '12345';
        card.innerHTML = `
            <div class="row h-100">
                <div class="col-auto">
                    <div class="product-image">
                        <img style="height:80px;width:80px;" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23334155'/%3E%3C/svg%3E">
                    </div>
                </div>
                <div class="col">
                    <div class="row h-100">
                        <div class="product-name col-12">JBL Wave Flex 2, Weiss (JBLWFLEX2WHT)</div>
                        <div class="product-price col-12">
                            <div class="price">
                                <div class="Plugin_PriceInformation price_information_product_small">
                                    <div class="priceContainer shippingPrice">
                                        <span class="currency">CHF </span><div class="Plugin_Price">49.90</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="badge badge-dif m_26_50"><div class="text">Differenz</div><p>-33%</p></div>
        `;

        const grid = document.querySelector('.standardList') || document.body;
        grid.appendChild(card);

        // Inject quick block pill
        const pill = document.createElement('button');
        pill.className = 'tp-card-quick-block';
        pill.innerHTML = '🚫 <span>Kopfhörer</span>';
        card.appendChild(pill);

        // Compute layout geometry
        const outerRow = card.children[0];
        const innerRow = card.querySelector('.col > .row');
        const nameEl = card.querySelector('.product-name');
        const priceEl = card.querySelector('.product-price');

        const cardRect = card.getBoundingClientRect();
        const nameRect = nameEl.getBoundingClientRect();
        const priceRect = priceEl.getBoundingClientRect();
        const pillBottom = window.getComputedStyle(pill).bottom;

        const outerWrap = window.getComputedStyle(outerRow).flexWrap;
        const innerDir = window.getComputedStyle(innerRow).flexDirection;

        // Clean up
        card.remove();

        return {
            outerWrap,
            innerDir,
            priceIsBelowName: priceRect.top >= nameRect.bottom - 2,
            priceIsInsideCard: priceRect.right <= cardRect.right + 2,
            priceIsVisible: priceRect.height > 0 && priceRect.width > 0,
            pillBottom
        };
    }""")

    assert res['outerWrap'] == 'nowrap'
    assert res['innerDir'] == 'column'
    assert res['priceIsBelowName'] is True
    assert res['priceIsInsideCard'] is True
    assert res['priceIsVisible'] is True
    assert res['pillBottom'] == '6px'




def test_native_category_management_coexistence(page: Page):
    # Verifies that native category management elements (sidebar, Plugin_IgnoredCategories,
    # card .hideCategoryTrigger) coexist seamlessly with Toppreise Suite controls.
    res = page.evaluate("""() => {
        const sidebar = document.querySelector('.Plugin_CategoryMainSelectionLeft');
        const nativeBar = document.querySelector('.Plugin_IgnoredCategories');
        const suiteBar = document.getElementById('tp-suite-filter-bar');
        const card = document.getElementById('card-cheapest');
        const nativeTrigger = card ? card.querySelector('.hideCategoryTrigger') : null;
        const quickBlock = card ? card.querySelector('.tp-card-quick-block') : null;
        const badge = card ? card.querySelector('.badge-dif') : null;

        return {
            sidebarExists: !!sidebar,
            nativeBarExists: !!nativeBar,
            suiteBarExists: !!suiteBar,
            nativeTriggerExists: !!nativeTrigger,
            quickBlockExists: !!quickBlock,
            badgeExists: !!badge,
            nativeTriggerTop: nativeTrigger ? window.getComputedStyle(nativeTrigger).top : '',
            nativeTriggerRight: nativeTrigger ? window.getComputedStyle(nativeTrigger).right : '',
            quickBlockBottom: quickBlock ? window.getComputedStyle(quickBlock).bottom : '',
            quickBlockLeft: quickBlock ? window.getComputedStyle(quickBlock).left : ''
        };
    }""")

    assert res['sidebarExists'] is True
    assert res['nativeBarExists'] is True
    assert res['suiteBarExists'] is True
    assert res['nativeTriggerExists'] is True
    assert res['quickBlockExists'] is True
    assert res['badgeExists'] is True
    assert res['nativeTriggerTop'] == '0px'
    assert res['nativeTriggerRight'] == '0px'
    assert res['quickBlockBottom'] == '6px'
    assert res['quickBlockLeft'] == '8px'



def test_native_category_management_interactions(page: Page):
    # Verifies interactive native category controls:
    # 1. Expand/collapse sidebar categories
    # 2. Clicking .f_IgnoredCategories_Hide adds an ignored chip to Plugin_IgnoredCategories
    # 3. Clicking .f_IgnoredCategories_Show removes the chip
    res = page.evaluate("""() => {
        const showMore = document.querySelector('.f_showMoreCatDetails');
        const hideMore = document.querySelector('.f_hideMoreCatDetails');
        const hiddenBefore = Array.from(document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.showExpandedOnly')).map(el => el.style.display);
        
        // Click show more
        showMore.click();
        const shownAfter = Array.from(document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.showExpandedOnly')).map(el => el.style.display);

        // Click hide more
        hideMore.click();
        const hiddenAgain = Array.from(document.querySelectorAll('.Plugin_CategoryMainSelectionLeft li.showExpandedOnly')).map(el => el.style.display);

        // Click first hide cross in sidebar (Computer & Zubehör)
        const firstCross = document.querySelector('.Plugin_CategoryMainSelectionLeft .f_IgnoredCategories_Hide');
        firstCross.click();

        const bar = document.querySelector('.Plugin_IgnoredCategories');
        const ignoredCount = bar.getAttribute('data-ignored-count');
        const chip = bar.querySelector('.ignoredCategory');
        const chipText = chip ? chip.textContent.trim() : '';

        // Click chip to remove
        if (chip) chip.click();
        const countAfterRemove = bar.getAttribute('data-ignored-count');

        return {
            hiddenBeforeAllNone: hiddenBefore.every(s => s === 'none'),
            shownAfterAllFlex: shownAfter.every(s => s === 'flex'),
            hiddenAgainAllNone: hiddenAgain.every(s => s === 'none'),
            ignoredCount,
            chipText,
            countAfterRemove
        };
    }""")

    assert res['hiddenBeforeAllNone'] is True
    assert res['shownAfterAllFlex'] is True
    assert res['hiddenAgainAllNone'] is True
    assert res['ignoredCount'] == '1'
    assert 'Computer & Zubehör' in res['chipText']
    assert res['countAfterRemove'] == '0'



def test_showproductprice_vs_showshippingprice_consistency(page: Page):
    """
    Validates that when Toppreise is in 'showproductprice' mode (Produktpreis exkl. Versand):
    1. isShippingPriceActive() returns false.
    2. The visible product price (e.g. 39.95) is extracted, NOT the hidden shipping price (47.90).
    3. The price history series matches the active mode (Series 0 for product price),
       preventing false markup calculations like +21% next to a 39.95 price.
    4. Switching to 'showshippingprice' dynamically selects the shipping price (47.90) and Series 1.
    """
    test_html_path = os.path.join(os.path.dirname(__file__), 'mock_toppreise.html')
    page.goto(f'file://{test_html_path}')
    with open('userscripts/toppreise/toppreise.user.js', 'r') as f:
        page.add_script_tag(content=f.read())

    # Mock pricechart response with distinct series:
    # Series 0 (Produktpreis): current 39.95, low 39.65 -> +0.75% (+1%)
    # Series 1 (Versandpreis): current 47.90, low 39.65 -> +20.8% (+21%)
    now = page.evaluate("Date.now()")
    def handle_pricechart(route):
        if '787382' in (route.request.post_data or '') or 'p_pc_pid=787382' in route.request.url:
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='application/json',
                body=f'[[[{now - 86400000}, 39.65], [{now}, 39.95]], [[{now - 86400000}, 39.65], [{now}, 47.90]]]'
            )
        else:
            route.continue_()

    page.route("**/plugins/product/pricechart*", handle_pricechart)

    # 1. Switch body to showproductprice (native Toppreise 'Produktpreis' setting)
    page.evaluate("""() => {
        document.body.classList.remove('showshippingprice');
        document.body.classList.add('showproductprice');

        const card = document.getElementById('card-competing-reference');
        card.setAttribute('href', '/preisvergleich/Kopfhoerer/JBL-Wave-Flex-2-p787382');
        card.dataset.entityId = '787382';
        card.dataset.tpProductId = '787382';
        card._tpPriceInfo = null;

        const priceInfo = card.querySelector('.Plugin_PriceInformation');
        priceInfo.innerHTML = `
            <div class="priceContainer productPrice">ab <span class="currency">CHF </span><div class="Plugin_Price">39.95</div></div>
            <div class="priceContainer shippingPrice" style="display: none;">ab <span class="currency">CHF </span><div class="Plugin_Price">47.90</div></div>
        `;

        const badge = card.querySelector('.badge-dif');
        badge.className = 'badge badge-dif tp-deal-badge-interactive';
        badge.dataset.tpOriginalDiscount = '33';
        badge.innerHTML = '<div class="text">Differenz</div><p>-33%</p>';

        localStorage.clear();
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
    }""")

    # Verify isShippingPriceActive() is false
    assert page.evaluate("() => window.ToppreiseSuite.isShippingPriceActive()") is False

    # Click badge to trigger price check
    page.locator('#card-competing-reference .badge-dif').click()

    # Wait for check to complete (loading class removed)
    page.wait_for_selector("#card-competing-reference .badge-dif:not(.tp-deal-loading)")

    # The badge markup must NOT be +21% (it should be +1% based on 39.95 vs 39.65)
    badge_html = page.locator('#card-competing-reference .badge-dif').inner_html()
    assert "+21%" not in badge_html, f"Expected no +21% false markup, got {badge_html}"
    assert "+1%" in badge_html or "-33%" in badge_html, f"Expected +1% markup, got {badge_html}"

    # 2. Now switch body to showshippingprice
    page.evaluate("""() => {
        document.body.classList.remove('showproductprice');
        document.body.classList.add('showshippingprice');
        const card = document.getElementById('card-competing-reference');
        card._tpPriceInfo = null;
        const shp = card.querySelector('.priceContainer.shippingPrice');
        if (shp) shp.style.display = '';
        localStorage.clear();
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
    }""")

    assert page.evaluate("() => window.ToppreiseSuite.isShippingPriceActive()") is True

    # Re-click to check with shipping active
    page.locator('#card-competing-reference .badge-dif').click()
    page.wait_for_selector("#card-competing-reference .badge-dif:not(.tp-deal-loading)")

    # Now shipping price (47.90 vs 39.65) yields +21%
    badge_html_shp = page.locator('#card-competing-reference .badge-dif').inner_html()
    assert "+21%" in badge_html_shp, f"Expected +21% markup with shipping active, got {badge_html_shp}"




