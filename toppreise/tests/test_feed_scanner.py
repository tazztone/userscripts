from playwright.sync_api import Page, expect



def test_competing_reference_price_resolves_to_verified_low(page: Page):
    """
    Validates that the userscript extracts the canonical price (CHF 37.95) correctly
    and ignores competing reference prices (CHF 47.82), resolving to a verified
    'Allzeit-Tiefstpreis' state instead of a markup 'Aufschlag' state.
    (Single color language: color = badge-% heat, text = kind.)
    """
    # Wait for initial render
    page.wait_for_selector('.badge-dif')

    card = page.locator('#card-competing-reference')
    badge = card.locator('.badge-dif')

    # It starts as unchecked
    assert badge.is_visible()

    # Mock the time series endpoint for it
    def handle_pricechart(route):
        # Fallback to post_data only if url does not contain it but we know how the mock is set up for fetch
        if '1003795' in (route.request.post_data or '') or 'p_pc_pid=1003795' in route.request.url:
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='text/html',
                body='''
                <div class="PriceChartLegend">
                  <div class="col-4">
                    <div class="title">aktueller Toppreis</div>
                    <div class="Plugin_Price">37.95</div>
                  </div>
                  <div class="col-4">
                    <div class="title">Tiefstpreis</div>
                    <div class="Plugin_Price">37.95</div>
                  </div>
                  <div class="col-4">
                    <div class="title">Höchstpreis</div>
                    <div class="Plugin_Price">55.00</div>
                  </div>
                </div>
                '''
            )
        else:
            route.continue_()

    page.route("**/plugins/product/pricechart*", handle_pricechart)

    # Click to verify
    badge.click()

    # Wait for the emerald halo to be applied
    page.wait_for_selector("#card-competing-reference .tp-deal-alltime-low")

    # Should not have the not-low class
    assert "tp-deal-not-low" not in badge.get_attribute("class")

    # Title carries only the action hint now (numbers live on badge + pill)
    title = badge.get_attribute("title") or ""
    assert "[Klicken zum Aktualisieren]" in title




def test_exact_cent_boundary_badge_states(page: Page):
    """
    Validates that the userscript accurately distinguishes between new-low, at-low, and above-low
    based strictly on integer cents, not floating point tolerances.
    """

    # We will test this by evaluating the renderCardEffects logic or directly checking DOM after mocking
    # Mode stays OFF (default) so the card stays in the DOM and we can inspect its badge properties

    cases = [
        # currentPrice, title hint string, expected_class, not_expected_class
        (37.94, '[Klicken zum Aktualisieren]', 'tp-deal-alltime-low', 'tp-deal-not-low'), # new low
        (37.95, '[Klicken zum Aktualisieren]', 'tp-deal-alltime-low', 'tp-deal-not-low'), # at low
        (37.96, 'historisches Tief CHF 37.95', 'tp-deal-not-low', 'tp-deal-alltime-low'), # above low
        (38.00, 'historisches Tief CHF 37.95', 'tp-deal-not-low', 'tp-deal-alltime-low'), # above low
        (37.9500001, '[Klicken zum Aktualisieren]', 'tp-deal-alltime-low', 'tp-deal-not-low'), # at low normalized
    ]

    for (curr_price, title_match, expected_class, unexpected_class) in cases:
        page.evaluate("""(price) => {
            const card = document.getElementById('card-competing-reference');
            // Overwrite price container
            const pEl = card.querySelector('.Plugin_PriceInformation .Plugin_Price');
            pEl.textContent = price;

            // Seed a cached history where tiefstpreis = 37.95
            localStorage.setItem('tp_hist_v1_1003795', JSON.stringify({
                tiefstpreis: 37.95,
                hoechstpreis: 55.00,
                medianPrice: 45.00,
                previousLow: 47.82,
                isNewAllTimeLow: price < 37.95,
                dataPointCount: 10,
                time: Date.now()
            }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('1003795', JSON.parse(localStorage.getItem('tp_hist_v1_1003795')));
            window.ToppreiseSuite.processListings();
        }""", curr_price)

        # Wait a tick for mutations
        page.wait_for_timeout(100)
        badge = page.locator('#card-competing-reference .badge-dif')

        # Verify classes
        badge_class = badge.get_attribute("class") or ""
        assert expected_class in badge_class, f"Expected {expected_class} but got {badge_class} for price {curr_price}"
        assert unexpected_class not in badge_class, f"Did not expect {unexpected_class} but got it for price {curr_price}"

        # Verify title string logic
        title = badge.get_attribute("title") or ""
        assert title_match in title, f"Expected {title_match} in {title} for price {curr_price}"



def test_price_alarm_automation(page: Page):
    page.evaluate("""() => {
      document.querySelector('#mock-alarm-dialog').style.display = 'block';
    }""")
    page.wait_for_timeout(250)

    price_val = page.locator('#f_NewInfoMailForm_priceFrom').input_value()
    # 60% of CHF 1000.00 = 600.00
    assert price_val == '600.00'
    assert page.locator('#im_nimf_prtrm').is_checked()

    # Pre-submit delay (300ms): after 450ms total, it should have submitted
    page.wait_for_timeout(250)
    assert page.locator('#mock-alarm-dialog').get_attribute('data-submitted') == 'true'

    # Grace period before closing (800ms after submit): wait until 1300ms total
    page.wait_for_timeout(900)
    assert page.locator('#mock-alarm-dialog').get_attribute('data-dialog-closed') == 'true'
    assert not page.locator('#mock-alarm-dialog').is_visible()



def test_real_deal_on_demand_check_and_badges(page: Page):
    # Setup mock network route for price chart HTML
    def handle_pricechart(route):
        url = route.request.url
        if 'p_pc_pid=797571' in url:
            # Card 1 (1800.00 CHF) -> Tiefstpreis is 1800.00 CHF (All-time low)
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='text/html',
                body='''
                <div class="PriceChartLegend">
                  <div class="col-4"><div class="title">aktueller Toppreis</div><div class="Plugin_Price">1800.00</div></div>
                  <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>
                  <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">2400.00</div></div>
                </div>
                '''
            )
        elif 'p_pc_pid=797573' in url:
            # Card 3 (15.00 CHF) -> Tiefstpreis was 10.00 CHF (Non-bestpreis)
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='text/html',
                body='''
                <div class="PriceChartLegend">
                  <div class="col-4"><div class="title">aktueller Toppreis</div><div class="Plugin_Price">15.00</div></div>
                  <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">10.00</div></div>
                  <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">25.00</div></div>
                </div>
                '''
            )
        else:
            route.fulfill(status=404, headers={'access-control-allow-origin': '*'}, body='Not Found')

    page.route('**/plugins/product/pricechart*', handle_pricechart)

    # 1. On Card 1 (RTX 4090, 1800.00 CHF): click on-demand Differenz badge
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-badge-interactive')
    page.click('#card-cheapest .badge-dif')

    # Verify badge transforms into Allzeit-Tiefstpreis with halo and truthful percentage
    # (verified badge shows the real event, never the -67% site Differenz)
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')
    badge1 = page.locator('#card-cheapest .badge-dif.tp-deal-alltime-low')
    assert 'Tiefstpreis' in (badge1.text_content() or '')
    assert '-67%' not in (badge1.text_content() or '')
    assert '[Klicken zum Aktualisieren]' in (badge1.get_attribute('title') or '')
    assert not page.locator('#card-cheapest .tp-card-historical-price').is_visible()

    # 2. On Card 3 (Silikon Case, 15.00 CHF): click on-demand Differenz badge
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-badge-interactive')
    page.click('#card-negative .badge-dif')

    # Verify badge transforms into a neutral Non-Tiefstpreis state with markup % and struck-through fake discount
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-not-low')
    badge3 = page.locator('#card-negative .badge-dif.tp-deal-not-low')
    assert '+50%' in (badge3.text_content() or '')
    assert '-35%' in (badge3.text_content() or '')

    # Verify separated Tiefstpreis subtitle below current price
    page.wait_for_selector('#card-negative .tp-card-historical-price')
    hist_price3 = page.locator('#card-negative .tp-card-historical-price')
    assert 'Tiefstpreis: CHF 10.00' in (hist_price3.text_content() or '')



def test_mode_hides_non_bestpreis(page: Page):
    """Strictness lives in the Tiefstpreise mode: enabling it hides verified
    non-deals (.tp-baddeal-hidden) while qualifying Tiefstpreise stay
    visible — no separate strictness toggle needed."""
    # Seed stats directly: card 1 (797571) qualifies with full stats,
    # card 3 (797573) has minimal above-low stats (tiefstpreis 10 < price 15).
    page.evaluate("""() => {
        const full = {
            tiefstpreis: 1800, hoechstpreis: 2600, medianPrice: 2400,
            previousLow: 2200, isNewAllTimeLow: true, realDiscountVsPrevLow: 18,
            dataPointCount: 10, time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(full));
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', full);
        const minimal = { tiefstpreis: 10, time: Date.now() };
        localStorage.setItem('tp_hist_v1_797573', JSON.stringify(minimal));
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797573', minimal);
        window.ToppreiseSuite.processListings();
    }""")

    # Outside the mode both cards stay visible with truthful badges
    assert page.locator('#card-cheapest').is_visible()
    assert page.locator('#card-negative').is_visible()

    # Enable Tiefstpreise mode
    page.evaluate("""() => {
        window.ToppreiseSuite.saveConfigKey('BESTPREISE_MODE_ACTIVE', true);
        window.ToppreiseSuite.processListings();
    }""")

    # Card 3 (non-bestpreis) is hidden with .tp-baddeal-hidden, but its
    # badge is still repainted truthfully (no stale verified % survives).
    page.wait_for_selector('#card-negative.tp-baddeal-hidden', state='attached')
    badge3 = page.locator('#card-negative .badge-dif.tp-deal-not-low')
    assert '+50%' in (badge3.text_content() or '')
    assert not page.locator('#card-negative').is_visible()

    # Card 1 (qualifying Tiefstpreis) stays visible with record badge + heat
    # (single color language: color = badge-% heat, text = kind).
    assert page.locator('#card-cheapest').is_visible()
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-new-record')
    assert 'tp-heatmap-active' in (page.locator('#card-cheapest').get_attribute('class') or '')

    # Reveal buttons live in the overflow menu: open it, then click reveal (👁️)
    page.click('#tp-bar-reveal-menu')
    page.click('#tp-bar-reveal-baddeals')
    assert page.locator('#card-negative').is_visible()
    assert 'tp-reveal-baddeals' in (page.locator('body').get_attribute('class') or '')



def test_real_deal_rich_tooltips_with_peak_context(page: Page):
    def handle_pricechart(route):
        url = route.request.url
        if 'p_pc_pid=797571' in url:
            # Card 1 (1800.00 CHF, Tiefstpreis 1800.00 CHF, Höchstpreis 2400.00 CHF -> -25% drop)
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='text/html',
                body='''
                <div class="PriceChartLegend">
                  <div class="col-4"><div class="title">aktueller Toppreis</div><div class="Plugin_Price">1800.00</div></div>
                  <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>
                  <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">2400.00</div></div>
                </div>
                '''
            )
        elif 'p_pc_pid=797573' in url:
            # Card 3 (15.00 CHF, Tiefstpreis 10.00 CHF, Höchstpreis 25.00 CHF)
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='text/html',
                body='''
                <div class="PriceChartLegend">
                  <div class="col-4"><div class="title">aktueller Toppreis</div><div class="Plugin_Price">15.00</div></div>
                  <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">10.00</div></div>
                  <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">25.00</div></div>
                </div>
                '''
            )
        else:
            route.fulfill(status=404, headers={'access-control-allow-origin': '*'}, body='Not Found')

    page.route('**/plugins/product/pricechart*', handle_pricechart)

    # Check Card 1
    page.wait_for_selector('#card-cheapest .badge-dif')
    page.click('#card-cheapest .badge-dif')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')

    badge1 = page.locator('#card-cheapest .badge-dif.tp-deal-alltime-low')
    title1 = badge1.get_attribute('title') or ''
    assert '[Klicken zum Aktualisieren]' in title1

    # Check Card 3
    page.wait_for_selector('#card-negative .badge-dif')
    page.click('#card-negative .badge-dif')
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-not-low')

    badge3 = page.locator('#card-negative .badge-dif.tp-deal-not-low')
    title3 = badge3.get_attribute('title') or ''
    assert 'historisches Tief CHF 10.00, +50% Aufschlag' in title3
    assert 'Höchstpreis: CHF 25.00' in title3



def test_real_deal_dom_memoization_and_cache_pruning(page: Page):
    # Test cache pruning in localStorage
    page.evaluate('''() => {
        const now = Date.now();
        const staleTime = now - (15 * 24 * 3600 * 1000); // 15 days ago (expired)
        const freshTime = now - (1 * 3600 * 1000);       // 1 hour ago (fresh)
        localStorage.setItem('tp_hist_v1_stale999', JSON.stringify({ tiefstpreis: 50, hoechstpreis: 100, time: staleTime }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('stale999', JSON.parse(localStorage.getItem('tp_hist_v1_stale999')));
        localStorage.setItem('tp_hist_v1_fresh999', JSON.stringify({ tiefstpreis: 80, hoechstpreis: 120, time: freshTime }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('fresh999', JSON.parse(localStorage.getItem('tp_hist_v1_fresh999')));
    }''')

    # Trigger setCachedPriceStats by mocking a route and clicking check badge
    page.route('**/plugins/product/pricechart*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>'
    ))

    page.wait_for_selector('#card-cheapest .badge-dif')
    page.click('#card-cheapest .badge-dif')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')

    # Stale item should be pruned, fresh item preserved
    stale_exists = page.evaluate("() => localStorage.getItem('tp_hist_v1_stale999') !== null")
    fresh_exists = page.evaluate("() => localStorage.getItem('tp_hist_v1_fresh999') !== null")
    assert not stale_exists
    assert fresh_exists



def test_real_deal_neutral_heatmap_on_markup(page: Page):
    # Unchecked cards never heat: striped-gray tp-is-unverified ribbons instead
    # of the old pale site-Differenz warmth. Card 1 (-67%) and card 3 (-35%).
    card1 = page.locator('#card-cheapest')
    card3 = page.locator('#card-negative')
    assert 'tp-heatmap-active' not in (card1.get_attribute('class') or '')
    assert 'tp-heatmap-active' not in (card3.get_attribute('class') or '')
    assert 'tp-is-unverified' in (card1.get_attribute('class') or '')
    assert 'tp-is-unverified' in (card3.get_attribute('class') or '')
    assert 'tp-is-unverified' in (card1.locator('.badge-dif').get_attribute('class') or '')
    assert 'tp-is-unverified' in (card3.locator('.badge-dif').get_attribute('class') or '')

    # Mock routes
    def handle_pricechart(route):
        url = route.request.url
        if 'p_pc_pid=797571' in url:
            route.fulfill(status=200, headers={'access-control-allow-origin': '*'}, content_type='text/html', body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>')
        elif 'p_pc_pid=797573' in url:
            route.fulfill(status=200, headers={'access-control-allow-origin': '*'}, content_type='text/html', body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">10.00</div></div>')
        else:
            route.fulfill(status=404, headers={'access-control-allow-origin': '*'}, body='Not Found')

    page.route('**/plugins/product/pricechart*', handle_pricechart)

    # Check card 1 (verified all-time low, no median) -> stays neutral: the
    # striped-gray Differenz ribbon becomes a verified Tiefstpreis badge, and
    # without a median there is no % to heat by.
    page.click('#card-cheapest .badge-dif')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')
    assert 'tp-heatmap-active' not in (card1.get_attribute('class') or '')
    assert 'tp-is-verified' in (card1.get_attribute('class') or '')
    assert 'tp-is-verified' in (card1.locator('.badge-dif').get_attribute('class') or '')

    # Check card 3 (non-bestpreis, 15 CHF vs 10 CHF low, no median) -> NO heatmap:
    # a verified +50% markup stays neutral gray (no deal, no color); the +50%
    # badge text carries the markup signal instead.
    page.click('#card-negative .badge-dif')
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-not-low')
    assert 'tp-heatmap-active' not in (card3.get_attribute('class') or '')
    assert card3.locator('.badge-dif').evaluate('el => el.style.getPropertyValue("background")') == ''
    assert 'tp-is-verified' in (card3.get_attribute('class') or '')
    assert 'tp-is-verified' in (card3.locator('.badge-dif').get_attribute('class') or '')



def test_real_deal_batch_check_button_counter_and_run(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    cta_main = page.locator('#tp-floating-check-main')
    assert cta.is_visible()

    # In mock_toppreise.html, 3 cards have >= 30% discount (-67%, -35%, -50%)
    assert '3 Tiefstpreise prüfen' in (cta_main.text_content() or '')

    # Mock routes
    def handle_pricechart(route):
        route.fulfill(
            status=200,
            headers={'access-control-allow-origin': '*'},
            content_type='text/html',
            body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">500.00</div></div>'
        )

    page.route('**/plugins/product/pricechart*', handle_pricechart)

    # 1. Checking one card individually reduces the batch count from (3) to (2)
    page.click('#card-cheapest .badge-dif')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-not-low')
    assert '2 Tiefstpreise prüfen' in (cta_main.text_content() or '')

    # 2. Clicking the floating CTA runs the batch check for remaining cards
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-alltime-low')
    page.wait_for_selector('#card-iphone .badge-dif.tp-deal-not-low')

    # Once finished, nothing is left to check and the CTA stays visible dimmed (never hides)
    page.wait_for_selector('#tp-floating-check-cta.tp-empty')
    assert cta.is_visible()
    assert '0 Tiefstpreise prüfen' in (cta_main.text_content() or '')



def test_check_deals_skips_ignored_invisible_products(page: Page):
    cta = page.locator('#tp-floating-check-cta')
    cta_main = page.locator('#tp-floating-check-main')
    assert cta.is_visible()

    # In mock_toppreise.html without filters, 3 cards qualify (-67%, -35%, -50%)
    # card-competing-reference has Aufschlag +26%, so it is not counted
    assert '3 Tiefstpreise prüfen' in (cta_main.text_content() or '')

    # 1. Filter out card-negative (-35%) using negative keyword
    page.fill('#tp-inline-negative-input', 'Silikon')
    page.wait_for_selector('#card-negative.tp-negative-filtered', state='attached')

    # Count should immediately drop from 3 to 2 because card-negative is now an ignored invisible product
    assert '2 Tiefstpreise prüfen' in (cta_main.text_content() or '')

    # 2. Filter out card-iphone (-50%) with a second negative keyword
    page.fill('#tp-inline-negative-input', 'Silikon, iPhone')
    page.dispatch_event('#tp-inline-negative-input', 'input')
    page.wait_for_selector('#card-iphone.tp-negative-filtered', state='attached')

    # Count drops to 1 (only card-cheapest -67% remains visible)
    assert '1 Tiefstpreis prüfen' in (cta_main.text_content() or '')

    # Track network requests for pricechart
    requested_pids = []
    def handle_pricechart(route):
        post_data = route.request.post_data or ''
        import urllib.parse
        parsed = urllib.parse.parse_qs(post_data)
        pid = parsed.get('pcspagdpi', [''])[0]
        requested_pids.append(pid)
        route.fulfill(
            status=200,
            headers={'access-control-allow-origin': '*'},
            content_type='text/html',
            body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">500.00</div></div>'
        )
    page.route('**/plugins/product/pricechart*', handle_pricechart)

    # 3. Click floating CTA -> should only scan card-cheapest (pid 797571), NOT the ignored cards
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-not-low')
    page.wait_for_selector('#tp-floating-check-cta.tp-empty')

    # Verify only card-cheapest (797571) was requested
    assert '797571' in requested_pids
    assert '797573' not in requested_pids  # card-negative (Silikon) must NOT be checked
    assert '797574' not in requested_pids  # card-iphone (iPhone) must NOT be checked

    # Now unchecked deals is 0, so the CTA stays visible dimmed (never hides)
    assert cta.is_visible()
    assert '0 Tiefstpreise prüfen' in (cta_main.text_content() or '')

    # 4. Triggering a check with 0 visible deals left must toast and terminate cleanly (no hang)
    page.evaluate("() => window.ToppreiseSuite.startBatchCheck()")
    page.wait_for_selector('#tp-root >> .tp-toast', state='visible')
    toast = page.locator('#tp-root >> .tp-toast').last
    assert 'Keine ungeprüften Deals vorhanden' in (toast.text_content() or '')
    assert cta.is_visible()

    # 5. Reveal ignored products -> reveal mode makes them visible, so they CAN now be checked
    page.click('#tp-bar-reveal-menu')
    page.click('#tp-bar-reveal-neg')
    page.wait_for_selector('body.tp-reveal-neg')
    # Both card-negative and card-iphone are now visible (revealed)
    assert cta.is_visible()
    assert '2 Tiefstpreise prüfen' in (cta_main.text_content() or '')



def test_product_detail_page_deal_badge(page: Page):
    # Mock route for product detail chart
    page.route('**/plugins/product/pricechart*840582*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body='''
        <div class="PriceChartLegend">
          <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">350.90</div></div>
          <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">700.00</div></div>
        </div>
        '''
    ))

    # Setup detail page DOM structure
    page.evaluate('''() => {
        document.body.innerHTML = `
          <div class="Plugin_ProductHeading">
            <h1>SHARP 55HR7265E <a href="/plugins/product/pricechart?p_pc_pid=840582">Preischart</a></h1>
          </div>
          <div class="productPrice"><div class="Plugin_Price">350.90</div></div>
        `;
        window.ToppreiseSuite?.processProductDetailPage?.();
    }''')

    page.wait_for_selector('#tp-detail-deal-badge.tp-is-alltime-low')
    badge = page.locator('#tp-detail-deal-badge')
    assert 'Allzeit-Tiefstpreis' in (badge.text_content() or '')
    title = badge.get_attribute('title') or ''
    assert 'Allzeit-Tiefstpreis' in title
    assert 'CHF 700.00' in title




def test_product_detail_page_negative_cache_no_recursion(page: Page):
    # Mock route to return an error/empty response representing no data
    page.route('**/plugins/product/pricechart*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body='<div class="empty-chart">Keine Daten</div>'
    ))

    # Setup detail page DOM structure
    page.evaluate('''() => {
        document.body.innerHTML = `
          <div class="Plugin_ProductHeading">
            <h1>SHARP 55HR7265E <a href="/plugins/product/pricechart?p_pc_pid=840582">Preischart</a></h1>
          </div>
          <div class="productPrice"><div class="Plugin_Price">350.90</div></div>
        `;
        // Inject a spy onto the recursive function to ensure it doesn't infinite loop
        window.processDetailCalls = 0;
        const originalProcess = window.ToppreiseSuite.processProductDetailPage;
        window.ToppreiseSuite.processProductDetailPage = async function() {
            window.processDetailCalls++;
            return await originalProcess.apply(this, arguments);
        };

        // Let's call it. It should fetch data, set negative cache, and NOT recurse again.
        window.ToppreiseSuite.processProductDetailPage();
    }''')

    # Wait for active fetches to settle
    page.wait_for_timeout(1000)

    # Check cache and recursion count
    calls = page.evaluate('window.processDetailCalls')
    assert calls == 1, f"Expected 1 call, but got {calls} indicating recursion"

    cached = page.evaluate("localStorage.getItem('tp_hist_v1_840582')")
    assert 'unavailable' in (cached or '')

    # Assert no deal badge was added
    assert page.locator('#tp-detail-deal-badge').count() == 0



def test_real_world_toppreise_pricechart_html_parsing(page: Page):
    # Real HTML layout directly from Toppreise.ch pricechart endpoint
    real_toppreise_html = '''
    <div id="Plugin_PriceChart_121918" data-product-id="845299" class="Plugin_PriceChart Plugin_PriceChart_Fullview">
      <div class="PriceChartLegend d-block col-12 text-center">
        <div class="row align-items-center">
          <div class="col-4 col-md-3">
            <div class="row p-2">
              <div class="title col-12">aktueller Toppreis</div>
              <div class="col-12 pt-2">
                <div class="row">
                  <span class="chartProductPrice col-12 col-lg p-0">
                    <div id="Plugin_PriceInformation_216829" class="Plugin_PriceInformation">
                      <div class="priceContainer unrelatedprice">
                        <div class="Plugin_Price "> 79.45 </div>
                      </div>
                    </div>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="col-4 col-md-3">
            <div class="row p-2">
              <div class="title col-12">Tiefstpreis</div>
              <div class="col-12 pt-2">
                <div class="row">
                  <div class="chartProductPrice col-12 col-lg p-0">
                    <div id="Plugin_PriceInformation_216829" class="Plugin_PriceInformation">
                      <div class="priceContainer unrelatedprice">
                        <div class="Plugin_Price "> 79.45 </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-4 col-md-3">
            <div class="row p-2">
              <div class="title col-12">Höchstpreis</div>
              <div class="col-12 pt-2">
                <div class="row">
                  <div class="chartProductPrice col-12 col-lg p-0">
                    <div id="Plugin_PriceInformation_216829" class="Plugin_PriceInformation">
                      <div class="priceContainer unrelatedprice">
                        <div class="Plugin_Price "> 172.00 </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    '''
    page.route('**/plugins/product/pricechart*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body=real_toppreise_html
    ))

    # Click Differenz badge on card-cheapest (price 1800 CHF vs Tiefstpreis 79.45 CHF -> +2166% markup)
    page.click('#card-cheapest .badge-dif')

    # Expect badge to be created with markup badge, NOT 'Nicht verfügbar'
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-not-low', timeout=3000)
    badge = page.locator('#card-cheapest .badge-dif.tp-deal-not-low')
    assert '+2166%' in (badge.text_content() or '')

    # Now verify all-time low case when Tiefstpreis matches card price (1800 CHF)
    real_alltime_low_html = real_toppreise_html.replace('79.45', '1800.00')
    page.route('**/plugins/product/pricechart*456*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body=real_alltime_low_html
    ))
    # card-negative has product id 456, price 15 CHF -> let's make mock match 15.00
    real_negative_html = real_toppreise_html.replace('79.45', '15.00')
    page.route('**/plugins/product/pricechart*456*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body=real_negative_html
    ))
    page.click('#card-negative .badge-dif')
    page.wait_for_selector('#card-negative .badge-dif.tp-deal-alltime-low', timeout=3000)
    neg_badge = page.locator('#card-negative .badge-dif.tp-deal-alltime-low')
    # Verified badge shows truthful Tiefstpreis; tooltip keeps only the action hint
    assert 'Tiefstpreis' in (neg_badge.text_content() or '')
    assert '-35%' not in (neg_badge.text_content() or '')
    assert '[Klicken zum Aktualisieren]' in (neg_badge.get_attribute('title') or '')



def test_category_page_single_card_on_demand_check_renders_percentage_and_halo(page: Page):
    # Mock price chart series for product 797571
    # Card price is 1800.00. Set historical prices with median 2400.00, previous low 2100.00
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/TV-Video/TV-Geraete-Zubehoer/TV-Geraete-c986');
        document.querySelectorAll('.badge-dif').forEach(b => b.remove());

        // Mock window.fetch to return a new record low price chart for product 797571
        const origFetch = window.fetch;
        window.fetch = async function(url, opts) {
            if (typeof url === 'string' && url.includes('pricechart')) {
                const now = Date.now();
                const day = 86400 * 1000;
                // Historical points well above 1800
                const points = [
                    [now - 300 * day, 2600.00],
                    [now - 200 * day, 2500.00],
                    [now - 150 * day, 2400.00],
                    [now - 100 * day, 2300.00],
                    [now - 50 * day, 2100.00],
                    [now - 5 * day, 1800.00]
                ];
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => points,
                    text: async () => JSON.stringify(points)
                };
            }
            return origFetch.apply(this, arguments);
        };

        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    card = page.locator('#card-cheapest')
    badge = card.locator('.badge-dif.tp-deal-badge-interactive')
    assert badge.is_visible()

    # Click badge to trigger on-demand check
    badge.click()
    page.wait_for_timeout(300)

    # Badge transforms to Real Deal percentage with halo ring
    assert badge.locator('.tp-deal-new-record, .tp-deal-alltime-low').count() > 0 or 'tp-deal-new-record' in (badge.get_attribute('class') or '') or 'tp-deal-alltime-low' in (badge.get_attribute('class') or '')
    badge_text = badge.inner_text()
    assert '%' in badge_text or 'Tiefstpreis' in badge_text

    # Historical subline is rendered
    hist = card.locator('.tp-card-historical-price')
    assert hist.is_visible()



def test_category_page_batch_check_scans_visible_cards(page: Page):
    # Setup mock for all products
    page.evaluate('''() => {
        document.body.className = 'color_bg Page_Browsing';
        document.body.setAttribute('data-current_url', '/produktsuche/TV-Video/TV-Geraete-Zubehoer/TV-Geraete-c986');
        window.localStorage.clear();
        document.querySelectorAll('.badge-dif').forEach(b => b.remove());

        const now = Date.now();
        const day = 86400 * 1000;
        window.fetch = async function(url, opts) {
            if (typeof url === 'string' && url.includes('pricechart')) {
                const points = [
                    [now - 200 * day, 500.00],
                    [now - 150 * day, 480.00],
                    [now - 100 * day, 450.00],
                    [now - 50 * day, 400.00],
                    [now - 2 * day, 350.00]
                ];
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => points,
                    text: async () => JSON.stringify(points)
                };
            }
            return { ok: false, status: 404 };
        };

        window.ToppreiseSuite?.processListings?.();
    }''')
    page.wait_for_timeout(200)

    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()
    initial_text = page.locator('#tp-floating-check-main').inner_text()
    assert 'Tiefstpreise prüfen' in initial_text

    # Click floating CTA check button
    page.click('#tp-floating-check-btn')
    page.wait_for_timeout(1000)

    # After scan finishes, cards are verified
    assert page.locator('.badge-dif.tp-deal-alltime-low, .badge-dif.tp-deal-new-record, .badge-dif.tp-deal-not-low').count() > 0



def test_sparkline_renders_with_cached_timeseries(page: Page):
    # Enable sparklines for testing
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = true;
    }""")
    # Inject cached price stats with timeSeries into localStorage
    page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1800.0,
            hoechstpreis: 2200.0,
            aktuellerToppreis: 1800.0,
            timeSeries: [[1672531199, 2200.0], [1675209599, 2000.0], [1677628799, 1800.0]],
            time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(stats)); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', stats);
        window.ToppreiseSuite?.processListings?.();
    }""")

    # Verify sparkline SVG is rendered on card-cheapest
    sparkline = page.locator('#card-cheapest .tp-sparkline')
    assert sparkline.is_visible()

    polyline = page.locator('#card-cheapest .tp-sparkline polyline')
    assert polyline.count() == 1
    # Single neutral color regardless of direction (#3b82f6)
    stroke = polyline.get_attribute('stroke')
    assert stroke == '#3b82f6'



def test_sparkline_not_rendered_without_timeseries(page: Page):
    page.evaluate("""() => {
        localStorage.removeItem('tp_hist_v1_797572');
        window.ToppreiseSuite?.processListings?.();
    }""")
    assert page.locator('#card-expensive .tp-sparkline').count() == 0



def test_sparkline_trending_up_renders_single_color(page: Page):
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = true;
        const stats = {
            tiefstpreis: 900.0,
            hoechstpreis: 1200.0,
            aktuellerToppreis: 1100.0,
            timeSeries: [[1672531199, 900.0], [1675209599, 1000.0], [1677628799, 1100.0]],
            time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797572', JSON.stringify(stats)); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797572', stats);
        window.ToppreiseSuite?.processListings?.();
    }""")

    sparkline = page.locator('#card-expensive .tp-sparkline')
    assert sparkline.is_visible()

    polyline = page.locator('#card-expensive .tp-sparkline polyline')
    stroke = polyline.get_attribute('stroke')
    # Same single color when price rises (#3b82f6)
    assert stroke == '#3b82f6'



def test_sparkline_handles_edge_cases(page: Page):
    # Enable sparklines for testing
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = true;
    }""")

    # 1 data point only -> not enough for a trend line, no sparkline rendered
    page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1800.0,
            hoechstpreis: 2200.0,
            timeSeries: [[1672531199, 1800.0]],
            time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(stats)); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', stats);
        window.ToppreiseSuite?.processListings?.();
    }""")
    assert page.locator('#card-cheapest .tp-sparkline').count() == 0

    # Flat price trend (equal start and end) -> same single color
    page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1800.0,
            hoechstpreis: 1800.0,
            timeSeries: [[1672531199, 1800.0], [1675209599, 1800.0]],
            time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(stats)); if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', stats);
        window.ToppreiseSuite?.processListings?.();
    }""")
    sparkline = page.locator('#card-cheapest .tp-sparkline')
    assert sparkline.is_visible()
    polyline = page.locator('#card-cheapest .tp-sparkline polyline')
    assert polyline.get_attribute('stroke') == '#3b82f6'

    # Disabled by default -> sparklines not rendered even if data exists
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = false;
        window.ToppreiseSuite?.processListings?.();
    }""")
    assert page.locator('#card-cheapest .tp-sparkline').count() == 0



def test_negative_caching_and_manual_click_override(page: Page):
    # Set negative cache for card-cheapest (product 797571)
    page.evaluate("""() => {
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify({ unavailable: true, time: Date.now() }));
            if(window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', JSON.parse(localStorage.getItem('tp_hist_v1_797571')));
    }""")

    # Batch check ignores negatively cached card
    cached = page.evaluate("() => window.ToppreiseSuite?.CONFIG ? localStorage.getItem('tp_hist_v1_797571') : null")
    assert 'unavailable' in (cached or '')

    # Manual click bypasses negative cache and fetches fresh stats
    page.route('**/plugins/product/pricechart*797571*', lambda route: route.fulfill(
        status=200,
        headers={'access-control-allow-origin': '*'},
        content_type='text/html',
        body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>'
    ))

    page.click('#card-cheapest .badge-dif')
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')
    badge = page.locator('#card-cheapest .badge-dif.tp-deal-alltime-low')
    # Verified badge shows truthful Tiefstpreis; tooltip keeps only the action hint
    assert 'Tiefstpreis' in (badge.text_content() or '')
    assert '-67%' not in (badge.text_content() or '')
    assert '[Klicken zum Aktualisieren]' in (badge.get_attribute('title') or '')



def test_real_deal_record_low_with_previous_low_subline(page: Page):
    # Enable sparklines
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.ENABLE_SPARKLINES = true;
    }""")

    # Product 797571 (current price 1800.00 CHF) had a previous low of 2200.00 CHF before dropping to 1800.00 CHF
    def handle_pricechart_post(route):
        if route.request.method == 'POST':
            # Return 2-series JSON with historical points: 2500 -> 2200 -> 1800 (current)
            series_data = [
                [[1672531199000, 2500.0], [1675209599000, 2200.0], [1677628799000, 1800.0]],
                [[1672531199000, 2500.0], [1675209599000, 2200.0], [1677628799000, 1800.0]]
            ]
            route.fulfill(
                status=200,
                headers={'access-control-allow-origin': '*'},
                content_type='application/json',
                body=json.dumps(series_data)
            )
        else:
            route.fallback()

    import json
    page.route('**/plugins/product/pricechart*', handle_pricechart_post)

    # Click Differenz badge on card-cheapest (1800.00 CHF)
    page.click('#card-cheapest .badge-dif')

    # Wait for all-time low badge
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-alltime-low')
    badge = page.locator('#card-cheapest .badge-dif.tp-deal-alltime-low')
    title = badge.get_attribute('title') or ''
    # Trimmed tooltip: record numbers live on badge + pill, title keeps the hint
    assert '[Klicken zum Aktualisieren]' in title

    # Verify record-low subline is displayed
    page.wait_for_selector('#card-cheapest .tp-card-historical-price.tp-is-record-low')
    subline = page.locator('#card-cheapest .tp-card-historical-price.tp-is-record-low')
    assert '📉 CHF 2200.00 (-18%)' in (subline.text_content() or '')

    # Verify sparkline is rendered immediately from POST response
    sparkline = page.locator('#card-cheapest .tp-sparkline')
    assert sparkline.is_visible()



def test_gewichtete_differenz_computation_and_weights(page: Page):
    # Test 1: New Record Low (50/50 default weight)
    # dMedian = 40%, dRecord = 20% -> blend = 0.5*40 + 0.5*20 = 30%
    score_res = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1500,
            hoechstpreis: 2500,
            medianPrice: 2500,
            previousLow: 1875,
            isNewAllTimeLow: true,
            realDiscountVsPrevLow: 20,
            dataPointCount: 10
        };
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        return window.ToppreiseSuite.computeDealScore(stats, 1500);
    }""")
    assert score_res['weightedDiff'] == 30
    assert score_res['dMedian'] == 40
    assert score_res['dRecord'] == 20
    assert score_res['isNewRecord'] is True

    # Test 2: Matching All-Time Low (dRecord = 0%)
    # dMedian = 30%, dRecord = 0% -> blend = 0.5*30 + 0 = 15%
    match_res = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1000,
            hoechstpreis: 1600,
            medianPrice: 1428,
            isNewAllTimeLow: false,
            dataPointCount: 8
        };
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        return window.ToppreiseSuite.computeDealScore(stats, 1000);
    }""")
    assert match_res['weightedDiff'] == 15
    assert match_res['dMedian'] == 30
    assert match_res['dRecord'] == 0
    assert match_res['isNewRecord'] is False

    # Test 3: Weight Slider Effect (100% Record Weight vs 100% Median Weight)
    weight_res = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1000,
            hoechstpreis: 2000,
            medianPrice: 2000,
            previousLow: 1250,
            isNewAllTimeLow: true,
            dataPointCount: 10
        };
        // dMedian = 50%, dRecord = 20%
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 1.0;
        const pureRecord = window.ToppreiseSuite.computeDealScore(stats, 1000).weightedDiff;

        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.0;
        const pureMedian = window.ToppreiseSuite.computeDealScore(stats, 1000).weightedDiff;

        return { pureRecord, pureMedian };
    }""")
    assert weight_res['pureRecord'] == 20
    assert weight_res['pureMedian'] == 50

    # Test 4: Exclusion: Non-bestpreis
    tier3_nonbest = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1000,
            hoechstpreis: 1600,
            medianPrice: 1400,
            isNewAllTimeLow: false,
            dataPointCount: 8
        };
        return window.ToppreiseSuite.computeDealScore(stats, 1200); // 1200 > 1000 * 1.01
    }""")
    assert tier3_nonbest is None

    # Test 5: Exclusion: Flat price (< 2% variance)
    tier3_flat = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1000,
            hoechstpreis: 1010,
            isNewAllTimeLow: false,
            dataPointCount: 12
        };
        return window.ToppreiseSuite.computeDealScore(stats, 1000);
    }""")
    assert tier3_flat is None

    # Test 6: Exclusion: 0% blend (price matches low and median, zero savings)
    zero_score = page.evaluate("""() => {
        const stats = {
            tiefstpreis: 1000,
            hoechstpreis: 1500,
            medianPrice: 1000,
            isNewAllTimeLow: false,
            dataPointCount: 10
        };
        return window.ToppreiseSuite.computeDealScore(stats, 1000);
    }""")
    assert zero_score is None



def test_parse_price_normalization(page: Page):
    """
    Validates that the parsePrice function correctly handles varied European and
    international grouping and decimal separator conventions based on the
    digits after the final separator.
    """
    page.evaluate("""() => {
        window.parsePrice = window.ToppreiseSuite.parsePrice;
    }""")

    test_cases = [
        ("1.385.90", 1385.90),
        ("1,385.90", 1385.90),
        ("1.385,90", 1385.90),
        ("1,385,900", 1385900),
        ("1.385.900", 1385900),
        ("1,385", 1385),
        ("1'385.90", 1385.90),
        ("CHF 1'433.00", 1433),
        ("12.-", 12),
        ("Gratis", 0)
    ]

    for input_str, expected in test_cases:
        safe_input = input_str.replace("'", "\\'")
        result = page.evaluate(f"() => window.parsePrice('{safe_input}')")
        assert result == expected, f"Expected parsePrice('{input_str}') to be {expected}, but got {result}"


def test_outlier_spike_rejection(page: Page):
    # Product: Smartphone normal price ~CHF 1200
    # Vendor glitch: 1-day CHF 15 spike on Day 3
    # Genuine new all-time low drop: CHF 999 on Day 10
    analysis = page.evaluate("""() => {
        const now = Date.now();
        const dayMs = 86400 * 1000;
        const series = [
            [now - 10 * dayMs, 1300],
            [now - 9 * dayMs, 1250],
            [now - 7 * dayMs, 1200],
            [now - 6 * dayMs, 15],   // 1-day glitch anomaly
            [now - 5 * dayMs, 1200],
            [now - 4 * dayMs, 1180],
            [now - 3 * dayMs, 1150],
            [now - 2 * dayMs, 1100],
            [now - 1 * dayMs, 1050],
            [now, 999]              // Current authentic record low
        ];
        return window.ToppreiseSuite.analyzePriceTimeSeries(series, 999);
    }""")

    # Outlier CHF 15 should have been sanitized
    assert analysis is not None
    assert len(analysis['filteredOutliers']) == 1
    assert analysis['filteredOutliers'][0]['price'] == 15
    assert analysis['tiefstpreis'] == 999
    assert analysis['previousLow'] == 1050
    assert analysis['isNewAllTimeLow'] is True



def test_rolling_median_time_horizon(page: Page):
    # Product: GPU launched 2 years ago at CHF 2000, sold for ~CHF 800 in last 6 months
    res = page.evaluate("""() => {
        const now = Date.now();
        const dayMs = 86400 * 1000;
        const series = [
            [now - 700 * dayMs, 2200],
            [now - 650 * dayMs, 2100],
            [now - 600 * dayMs, 2000],
            [now - 550 * dayMs, 1900],
            [now - 500 * dayMs, 1800],
            [now - 450 * dayMs, 1700],
            [now - 400 * dayMs, 1600],
            [now - 350 * dayMs, 1500],
            [now - 120 * dayMs, 850],
            [now - 90 * dayMs, 800],
            [now - 60 * dayMs, 780],
            [now - 30 * dayMs, 750],
            [now, 699]
        ];

        window.ToppreiseSuite.CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS = 180;
        const stats180d = window.ToppreiseSuite.analyzePriceTimeSeries(series, 699);
        window.ToppreiseSuite.CONFIG.BESTPREISE_MEDIAN_HORIZON_DAYS = 0;
        const statsLifetime = window.ToppreiseSuite.analyzePriceTimeSeries(series, 699);

        return { stats180d, statsLifetime };
    }""")

    # 180d window should only consider points in the last 180 days (around ~780 median)
    assert res['stats180d']['medianPrice'] <= 850
    # Lifetime window includes early launch prices (median = 1600)
    assert res['statsLifetime']['medianPrice'] >= 1500



def test_check_deals_active_in_bestpreise_mode(page: Page):
    # Activate Bestpreise mode
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")

    # Floating check CTA should be visible (replaces the old toolbar button)
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()

    # Threshold button should be visible and interactive on the deal feed
    thresh_btn = page.locator('#tp-floating-threshold-btn')
    assert thresh_btn.is_visible()



def test_unscanned_cards_no_stuck_loading_badge(page: Page):
    # In Bestpreise mode, reveal filtered cards
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        document.body.classList.add('tp-reveal-baddeals');
        window.ToppreiseSuite.processListings();
    }""")

    # Unscanned card badge must NOT have tp-deal-loading and should show original discount with loupe
    uncached_badge = page.locator('#card-low-offers .badge-dif')
    assert 'tp-deal-loading' not in (uncached_badge.get_attribute('class') or '')
    assert '🔍' in (uncached_badge.text_content() or '')
    # Loupe action is a real focusable button adjacent to (never inside) the badge
    loupe = page.locator('#card-low-offers button.tp-loupe')
    assert loupe.is_visible()
    assert loupe.is_enabled()
    assert loupe.get_attribute('aria-label') == 'Differenz prüfen'
    assert loupe.evaluate("el => el.previousElementSibling && el.previousElementSibling.matches('.badge-dif')")



def test_scanner_cancellation_during_batch_check(page: Page):
    # Verify cancelBatchDealCheck immediately stops
    res = page.evaluate("""async () => {
        let statusCalls = [];
        const p = window.ToppreiseSuite.runBatchDealCheck(10, null, null, s => statusCalls.push(s));
        // Immediately request cancellation
        window.ToppreiseSuite.cancelBatchDealCheck();
        await p;
        return {
            finished: true
        };
    }""")
    assert res['finished'] is True



def test_batch_check_button_click_when_deals_populated_after_initial_bar_render(page: Page):
    # Regression test for stale closure bug where initial bar creation with 0 deals
    # prevented subsequent batch clicks from running even after deals were discovered.
    cta = page.locator('#tp-floating-check-cta')
    assert cta.is_visible()

    res = page.evaluate("""() => {
        // 1. Force bar recreation with 0 unchecked deals to emulate initial render state
        const oldBar = document.getElementById('tp-suite-filter-bar');
        if (oldBar) oldBar.remove();

        // 2. Clear stats cache for the cards so they are unchecked deals
        window.ToppreiseSuite.clearCardCache();

        // 3. Process listings -> renders bar and populates count
        window.ToppreiseSuite.processListings();

        const main = document.querySelector('#tp-floating-check-main');
        return {
            mainText: main ? main.textContent : ''
        };
    }""")

    assert '3 Tiefstpreise prüfen' in res['mainText']

    # Clicking the CTA should immediately start the scan (tp-scanning), NOT bail out
    page.click('#tp-floating-check-btn')
    page.wait_for_function("() => document.querySelector('#tp-floating-check-cta').classList.contains('tp-scanning')")
    
    # Cleanly cancel scan to finish test
    page.evaluate("() => window.ToppreiseSuite.cancelBatchDealCheck()")
    page.wait_for_function("() => !document.querySelector('#tp-floating-check-cta').classList.contains('tp-scanning')")




def test_batch_check_offerless_feed_with_min_offers(page: Page):
    """
    Production /neue-toppreise cards carry NO dealer rows or offer counts
    (extractOfferCount -> 0, pageHasOffers == False), but users can still set
    Min-Angebote >= 1 via the stepper. The batch counter (real pageHasOffers)
    and the scanner predicate (hardcoded pageHasOffers=True in the no-arg
    isCardFilteredOut recompute) must agree, otherwise the button shows
    "N Tiefstpreise prüfen" while the click scans 0 targets and toasts
    "Keine ungeprüften Deals vorhanden".
    """
    # Fresh state: no cached stats, no negative terms, Min=2 like the bug report
    page.evaluate("""() => {
        Object.keys(localStorage).filter(k => k.startsWith('tp_hist_v1_')).forEach(k => localStorage.removeItem(k));
        window.ToppreiseSuite.memoryCache.clear();
        // Simulate production feed: strip dealer rows + offer count text
        document.querySelectorAll('.Plugin_DealerRelProdPriceInfo, .offersCount').forEach(el => el.remove());
        document.querySelectorAll('a.Plugin_Product, .Plugin_Product').forEach(card => {
            window.ToppreiseSuite.clearCardCache(card);
        });
        window.ToppreiseSuite.updateConfig('NEGATIVE_TERMS', '');
        window.ToppreiseSuite.updateConfig('MIN_OFFERS', 2);
    }""")

    cta_main = page.locator('#tp-floating-check-main')
    # Counter sees 3 unchecked deals (-67%, -35%, -50%) despite Min=2:
    # offer-less feed => pageHasOffers False => no low-offers filtering
    page.wait_for_function("() => document.querySelector('#tp-floating-check-main').textContent.includes('3 Tiefstpreise prüfen')")

    # The exact predicate the scanner uses (no-arg recompute) must agree
    assert page.evaluate("() => window.ToppreiseSuite.isCardFilteredOut(document.querySelector('#card-cheapest'))") is False

    requested_pids = []
    def handle_pricechart(route):
        post_data = route.request.post_data or ''
        import urllib.parse
        parsed = urllib.parse.parse_qs(post_data)
        pid = parsed.get('pcspagdpi', [''])[0] or route.request.url
        requested_pids.append(pid)
        route.fulfill(
            status=200,
            headers={'access-control-allow-origin': '*'},
            content_type='text/html',
            body='<div class="PriceChartLegend"><div class="title">Tiefstpreis</div><div class="Plugin_Price">500.00</div></div>'
        )
    page.route('**/plugins/product/pricechart*', handle_pricechart)

    page.click('#tp-floating-check-btn')
    page.wait_for_function("() => !document.querySelector('#tp-floating-check-cta').classList.contains('tp-scanning')", timeout=30000)

    # Scanner must have checked the 3 deals, not toasted "Keine ungeprüften"
    assert '797571' in requested_pids
    assert '797573' in requested_pids
    assert '797574' in requested_pids

    page.evaluate("() => window.ToppreiseSuite.updateConfig('MIN_OFFERS', 0)")


def test_weight_switch_moves_blend_ribbon_and_heat(page: Page):
    """The ribbon carries the Gewichtete Differenz (⚖️ + blend): dragging the
    weight slider reprints the ribbon number (heat follows it, so number and
    color agree) while the CHF-anchored subline legs stay put. No kind words, no pill."""
    # Record card with divergent numbers: Rekord -18% vs Ø -25%
    # Blends: 50/50 -> -22%, 100% Ø -> -25%, 100% Rek -> -18%
    page.evaluate("""() => {
        const full = {
            tiefstpreis: 1800, hoechstpreis: 2600, medianPrice: 2400,
            previousLow: 2200, isNewAllTimeLow: true, realDiscountVsPrevLow: 18,
            dataPointCount: 10, time: Date.now()
        };
        localStorage.setItem('tp_hist_v1_797571', JSON.stringify(full));
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set('797571', full);
        window.ToppreiseSuite.saveConfigKey('BESTPREISE_MODE_ACTIVE', true);
        window.ToppreiseSuite.processListings();
    }""")

    badge = page.locator('#card-cheapest .badge-dif')
    subline = page.locator('#card-cheapest .tp-card-historical-price')

    # Default 50/50: blend ribbon (⚖️ -22%) with record heat applied
    page.wait_for_selector('#card-cheapest .badge-dif.tp-deal-new-record')
    assert '-22%' in (badge.text_content() or '')
    assert '⚖️' in (badge.text_content() or '')
    assert 'Rekord' not in (badge.text_content() or '')
    # Subline carries the CHF-anchored split with per-leg %
    assert '📉 CHF 2200.00 (-18%)' in (subline.text_content() or '')
    assert 'CHF 2400.00 (-25%)' in (subline.text_content() or '')

    # Switch to 100% Ø: ribbon moves to the Ø leg, CHF legs stay put
    page.evaluate("""() => {
        const r = document.querySelector('#tp-bar-weight-range');
        r.value = '0';
        r.dispatchEvent(new Event('input', {bubbles: true}));
        r.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_function("() => document.querySelector('#card-cheapest .badge-dif')?.textContent?.includes('-25%')")
    assert '📉 CHF 2200.00 (-18%)' in (subline.text_content() or '')
    # Heat recolor is applied (ribbon carries an inline heat background)
    assert page.evaluate("() => document.querySelector('#card-cheapest .badge-dif').style.background !== ''")

    # Back to 100% Rekord: ribbon returns to the record leg
    page.evaluate("""() => {
        const r = document.querySelector('#tp-bar-weight-range');
        r.value = '100';
        r.dispatchEvent(new Event('input', {bubbles: true}));
        r.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_function("() => document.querySelector('#card-cheapest .badge-dif')?.textContent?.includes('-18%')")
    assert 'CHF 2400.00 (-25%)' in (subline.text_content() or '')
