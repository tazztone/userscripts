import json
from playwright.sync_api import Page

from conftest import open_settings


def test_batch_popover_open_escape_and_scope_counts(page: Page):
    batch_btn = page.locator('#tp-floating-batch-btn')
    assert batch_btn.is_visible()
    batch_btn.click()

    pop = page.locator('#tp-batch-popover')
    assert pop.is_visible()
    assert batch_btn.get_attribute('aria-expanded') == 'true'

    # Scope pills show live counts
    visible_count = int(page.locator('#tp-batch-scope-visible').text_content() or '0')
    non_dim_count = int(page.locator('#tp-batch-scope-non-dimmed').text_content() or '0')
    assert visible_count >= non_dim_count > 0

    # Escape closes popover
    page.keyboard.press('Escape')
    assert not pop.is_visible()
    assert batch_btn.get_attribute('aria-expanded') == 'false'


def test_batch_copy_markdown_tsv_with_collection_specs_and_csv(page: Page):
    # Inject a collection wrapper with .product-features around the first card + clipboard capture
    page.evaluate("""() => {
        window.__tpCopied = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async (t) => { window.__tpCopied.push(t); } }
        });
        const card = document.querySelector('.Plugin_Product');
        const coll = document.createElement('div');
        coll.className = 'Plugin_ProductCollItem';
        const row = document.createElement('div');
        row.className = 'row';
        const feat = document.createElement('div');
        feat.className = 'product-features';
        feat.textContent = '16 GB RAM • 1 TB SSD';
        row.appendChild(feat);
        card.parentNode.insertBefore(coll, card);
        coll.appendChild(row);
        coll.appendChild(card);
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-copy-btn')
    page.wait_for_function("() => window.__tpCopied.length === 1")
    md = page.evaluate("() => window.__tpCopied[0]")
    assert '| # | Produkt | Preis |' in md
    assert '16 GB RAM · 1 TB SSD' in md

    # Switch to TSV and copy
    page.click('#tp-batch-copy-fmt-btn')
    assert page.locator('#tp-batch-copy-fmt-btn').text_content() == 'TSV'
    page.click('#tp-batch-copy-btn')
    page.wait_for_function("() => window.__tpCopied.length === 2")
    tsv = page.evaluate("() => window.__tpCopied[1]")
    assert '\t' in tsv
    assert '16 GB RAM · 1 TB SSD' in tsv

    # CSV download triggers
    with page.expect_download() as dl_info:
        page.click('#tp-batch-csv-btn')
    assert dl_info.value.suggested_filename.endswith('.csv')


def test_batch_confirm_threshold_gate_and_google_ai_fallback(page: Page):
    page.evaluate("""() => {
        window.__tpOpenedUrls = [];
        window.open = (url) => { window.__tpOpenedUrls.push(url); return null; };
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 2);
        window.ToppreiseSuite.updateConfig('AI_SEARCH_PROVIDER', 'google');
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-single-btn')

    # Above threshold (6 >= 2) -> confirmation dialog opens
    confirm = page.locator('#tp-batch-confirm-popout')
    assert confirm.is_visible()
    page.fill('#tp-batch-limit-input', '2')
    page.click('#tp-batch-confirm-go')

    # window.open returned null -> blocked links fallback popout appears with &udm=50 links
    ai_pop = page.locator('#tp-batch-ai-popout')
    assert ai_pop.is_visible()
    links = ai_pop.locator('.tp-batch-blocked-list a')
    assert links.count() == 2
    assert '&udm=50' in (links.nth(0).get_attribute('href') or '')


def test_batch_openrouter_comparison_renders_citations(page: Page):
    def handle_openrouter(route):
        body = json.loads(route.request.post_data or '{}')
        assert body.get('tools', [{}])[0].get('type') == 'openrouter:web_search'
        route.fulfill(
            status=200,
            headers={'content-type': 'application/json', 'access-control-allow-origin': '*'},
            body=json.dumps({
                'choices': [{
                    'message': {
                        'content': '**Fazit:** Angebot #1 bietet das beste Preis-Leistungs-Verhältnis.',
                        'annotations': [{
                            'type': 'url_citation',
                            'url_citation': {'url': 'https://example.com/review', 'title': 'TechReview'}
                        }]
                    }
                }]
            })
        )

    page.route('https://openrouter.ai/api/v1/chat/completions', handle_openrouter)
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50);
        window.ToppreiseSuite.updateConfig('BATCH_AI_TARGET', 'openrouter');
        window.ToppreiseSuite.updateConfig('OPENROUTER_API_KEY', 'sk-or-test-key');
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-compare-btn')

    ai_pop = page.locator('#tp-batch-ai-popout')
    ai_pop.wait_for(state='visible')
    assert 'beste Preis-Leistungs-Verhältnis' in (ai_pop.text_content() or '')
    cite = ai_pop.locator('.tp-batch-citations a')
    assert cite.count() == 1
    assert cite.get_attribute('href') == 'https://example.com/review'


def test_batch_price_alarms_always_confirms_and_submits_sequentially(page: Page):
    page.evaluate("() => window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50)")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-alarms-btn')

    # Always opens confirm dialog with inline target % and duration
    confirm = page.locator('#tp-batch-confirm-popout')
    assert confirm.is_visible()
    page.fill('#tp-batch-limit-input', '1')
    page.fill('#tp-batch-alarm-pct', '75')
    page.click('#tp-batch-confirm-go')

    # Wait for toast confirming alarm set + overridden 75% target price on 1000.00 -> 750.00
    page.wait_for_selector('#tp-root >> .tp-toast:has-text("1 Preisalarm gesetzt")', timeout=5000)
    assert page.locator('#f_NewInfoMailForm_priceFrom').input_value() == '750.00'


def test_batch_dealer_fetch_and_native_compare_cap_at_4(page: Page):
    # Add mock native compare buttons to first 5 cards (1 already active)
    page.evaluate("""() => {
        const cards = Array.from(document.querySelectorAll('.Plugin_Product')).slice(0, 5);
        window.__tpCompClicks = [];
        cards.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'Plugin_AddToProductComparisonButton';
            const active = idx === 0;
            btn.setAttribute('data-ser-plgn-data', JSON.stringify({ pc_atpcbc_action: active ? 'rm' : 'ad' }));
            const icon = document.createElement('i');
            icon.className = 'TPIcons-diff ' + (active ? 'active' : 'inactive');
            btn.appendChild(icon);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.__tpCompClicks.push(idx);
                btn.setAttribute('data-ser-plgn-data', JSON.stringify({ pc_atpcbc_action: 'rm' }));
            });
            c.appendChild(btn);
        });
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('button.tp-bp-scope[data-scope="visible"]')
    comp_btn = page.locator('#tp-batch-compare-btn')
    assert comp_btn.is_visible()
    comp_btn.click()

    clicks = page.evaluate("() => window.__tpCompClicks")
    # 1 already active + 3 clicked = 4 max
    assert clicks == [1, 2, 3]


def test_batch_discord_share_skips_duplicates_and_posts(page: Page):
    from conftest import mock_pricechart
    posted = []

    def handle_discord(route):
        raw = route.request.post_data or ''
        payload = None
        if 'payload_json' in raw:
            import re
            m = re.search(r'name="payload_json"\r?\n\r?\n(\{.*?\})\r?\n', raw, re.S)
            if m:
                payload = json.loads(m.group(1))
        elif raw.strip().startswith('{'):
            payload = json.loads(raw)
        posted.append(payload)
        route.fulfill(status=204, headers={'access-control-allow-origin': '*'})

    mock_pricechart(page, {'797571': 500, '797572': 500, '797573': 500})
    page.route('https://discord.com/api/webhooks/**', handle_discord)
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');
        window.ToppreiseSuite.updateConfig('DISCORD_CHANNELS', [{ id: 'ch1', name: 'Deals', url: 'https://discord.com/api/webhooks/123/abc' }]);
    }""")

    # Verify deals first so isVerifiedDeal is true
    page.click('#tp-floating-check-btn')
    page.wait_for_selector('#tp-floating-check-cta.tp-empty', timeout=5000)

    page.click('#tp-floating-batch-btn')
    discord_btn = page.locator('#tp-batch-discord-btn')
    assert discord_btn.is_visible()
    discord_btn.click()

    confirm = page.locator('#tp-batch-confirm-popout')
    assert confirm.is_visible()
    page.click('#tp-batch-confirm-go')
    page.wait_for_function("() => document.querySelector('#tp-root')?.shadowRoot?.querySelector('.tp-toast')?.textContent?.includes('geteilt')", timeout=5000)
    assert len(posted) >= 1
    first_payload = posted[0]
    assert isinstance(first_payload, dict)
    content = first_payload.get('content', '')
    assert isinstance(content, str) and len(content) > 0
    assert 'CHF' in content
    assert 'Apple' in content or 'Sony' in content or 'Samsung' in content or '## ' in content


def test_batch_popover_single_line_light_glass_and_dialog_guards(page: Page):
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');
        window.ToppreiseSuite.updateConfig('DISCORD_CHANNELS', [{ id: 'ch1', name: 'Deals', url: 'https://discord.com/api/webhooks/123/abc' }]);
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 2);
    }""")
    page.click('#tp-floating-batch-btn')
    pop = page.locator('#tp-batch-popover')
    assert pop.is_visible()

    # 1-action-per-line: every visible .tp-bp-item has strictly increasing Y and no horizontal overflow
    layout = page.evaluate("""() => {
        const pop = document.getElementById('tp-batch-popover');
        const items = Array.from(pop.querySelectorAll('.tp-bp-item')).filter(el => el.offsetParent !== null);
        const ys = items.map(el => Math.round(el.getBoundingClientRect().y));
        const cs = getComputedStyle(pop);
        const box = pop.getBoundingClientRect();
        return {
            ys,
            bg: cs.backgroundColor,
            color: cs.color,
            overflowX: pop.scrollWidth > pop.clientWidth,
            inViewport: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight
        };
    }""")
    assert len(layout['ys']) >= 7
    assert all(layout['ys'][i] < layout['ys'][i + 1] for i in range(len(layout['ys']) - 1)), f"Expected strictly increasing Y rows: {layout['ys']}"
    assert layout['overflowX'] is False
    assert layout['inViewport'] is True

    # Light frosted-glass background & dark text
    import re
    bg_nums = [int(x) for x in re.findall(r'\d+', layout['bg'])[:3]]
    txt_nums = [int(x) for x in re.findall(r'\d+', layout['color'])[:3]]
    assert all(c >= 230 for c in bg_nums), f"Expected light background, got {layout['bg']}"
    assert all(c <= 60 for c in txt_nums), f"Expected dark text, got {layout['color']}"

    # Clicking inside confirm dialog does not dismiss popover; Escape closes confirm dialog first
    page.click('#tp-batch-tabs-btn')
    confirm = page.locator('#tp-batch-confirm-popout')
    assert confirm.is_visible()
    assert pop.is_visible()
    page.fill('#tp-batch-limit-input', '2')
    assert '(2)' in page.locator('#tp-batch-confirm-go').text_content()
    page.click('#tp-batch-limit-input')
    assert pop.is_visible()
    page.keyboard.press('Escape')
    assert not confirm.is_visible()
    assert pop.is_visible()

    # Discord confirm button is disabled when 0 qualified deals exist
    page.click('#tp-batch-discord-btn')
    assert confirm.is_visible()
    assert page.locator('#tp-batch-confirm-go').is_disabled()
    page.keyboard.press('Escape')


def test_openrouter_api_key_cleared_on_modal_close(page: Page):
    from conftest import open_settings
    open_settings(page)
    or_opacity = page.evaluate("""() => {
        const sr = document.querySelector('#tp-root')?.shadowRoot;
        const blk = sr?.getElementById('tp-ai-openrouter-block');
        return blk && blk.classList.contains('tp-provider-dimmed') ? parseFloat(getComputedStyle(blk).opacity) : 1;
    }""")
    assert or_opacity < 0.8
    page.locator('#tp-root >> #tp-ai-openrouter-block > summary').click()
    page.click('#tp-root >> #tp-openrouter-api-key-reveal')
    key_input = page.locator('#tp-root >> #tp-openrouter-api-key-input')
    key_input.fill('sk-or-v1-secret-test-key')
    page.keyboard.press('Escape')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert key_input.input_value() == ''


def test_batch_openrouter_individual_cancel_and_running_pill(page: Page):
    pending_routes = []

    def handle_delayed(route):
        pending_routes.append(route)

    page.route('https://openrouter.ai/api/v1/chat/completions', handle_delayed)
    page.evaluate("""() => {
        window.__tpCopiedAi = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async (t) => { window.__tpCopiedAi.push(t); } }
        });
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50);
        window.ToppreiseSuite.updateConfig('AI_SEARCH_PROVIDER', 'openrouter');
        window.ToppreiseSuite.updateConfig('OPENROUTER_API_KEY', 'sk-or-test-key');
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-single-btn')

    # In-flight: running pill & progress row visible
    page.wait_for_selector('#tp-floating-batch-btn.tp-batch-running')
    assert '⏳' in (page.locator('#tp-floating-batch-count').text_content() or '')
    assert page.locator('#tp-batch-progress-row').is_visible()

    # Cancel mid-run
    page.click('#tp-batch-cancel-btn')
    page.wait_for_function("() => !document.getElementById('tp-floating-batch-btn')?.classList.contains('tp-batch-running')")
    assert not page.locator('#tp-batch-progress-row').is_visible()
    for r in pending_routes:
        try:
            r.abort()
        except Exception:
            pass

    # Now run a full OpenRouter individual search to completion (limit 2 via confirm dialog)
    page.unroute('https://openrouter.ai/api/v1/chat/completions', handle_delayed)
    page.route('https://openrouter.ai/api/v1/chat/completions', lambda route: route.fulfill(
        status=200,
        headers={'content-type': 'application/json', 'access-control-allow-origin': '*'},
        body=json.dumps({
            'choices': [{
                'message': {
                    'content': '### Bewertung\n**Sehr stark** im Test.',
                    'annotations': [{
                        'type': 'url_citation',
                        'url_citation': {'url': 'https://example.com/or-src', 'title': 'OR Source'}
                    }]
                }
            }]
        })
    ))
    page.evaluate("() => window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 2)")
    page.click('#tp-batch-ai-single-btn')
    page.wait_for_selector('#tp-batch-confirm-popout', state='visible')
    page.fill('#tp-batch-limit-input', '2')
    page.click('#tp-batch-confirm-go')

    ai_pop = page.locator('#tp-batch-ai-popout')
    ai_pop.wait_for(state='visible')
    assert ai_pop.locator('.tp-batch-ai-item-title a').count() == 2
    assert ai_pop.locator('strong.tp-ai-h').count() >= 2
    assert ai_pop.locator('.tp-batch-citations a').first.get_attribute('href') == 'https://example.com/or-src'

    ai_pop.locator('button:has-text("Alle kopieren")').click()
    page.wait_for_function("() => window.__tpCopiedAi.length === 1")
    copied = page.evaluate("() => window.__tpCopiedAi[0]")
    assert '### ' in copied


def test_batch_missing_key_toast_empty_scope_and_settings_shortcut(page: Page):
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('BATCH_AI_TARGET', 'openrouter');
        window.ToppreiseSuite.updateConfig('AI_SEARCH_PROVIDER', 'openrouter');
        window.ToppreiseSuite.updateConfig('OPENROUTER_API_KEY', '');
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-compare-btn')
    assert 'OpenRouter API-Key fehlt' in page.evaluate("() => window.ToppreiseSuite?.lastToast?.() || ''")
    assert page.locator('#tp-batch-confirm-popout').count() == 0
    assert page.locator('#tp-batch-ai-popout').count() == 0

    page.click('#tp-batch-ai-single-btn')
    assert 'OpenRouter API-Key fehlt' in page.evaluate("() => window.ToppreiseSuite?.lastToast?.() || ''")
    assert page.locator('#tp-batch-confirm-popout').count() == 0

    # Switch to deals scope (0 deals) -> actions disabled
    page.click('button.tp-bp-scope[data-scope="deals"]')
    assert page.locator('#tp-batch-copy-btn').is_disabled()
    assert page.locator('#tp-batch-csv-btn').is_disabled()
    assert page.locator('#tp-batch-copy-fmt-btn').is_disabled()

    # Settings shortcut closes popover and opens settings modal
    page.click('#tp-batch-settings-btn')
    assert not page.locator('#tp-batch-popover').is_visible()
    assert page.locator('#tp-root >> #tp-settings-dialog').is_visible()


def test_batch_dealer_fetch_and_scoped_discord_meta(page: Page):
    from conftest import seed_verified_deal

    page.route('https://www.toppreise.ch/preisvergleich/**', lambda route: route.fulfill(
        status=200,
        headers={'content-type': 'text/html'},
        body='<html><head><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":100,"seller":{"name":"MockShop"}}}</script></head><body></body></html>'
    ))
    page.route('https://discord.com/api/webhooks/**', lambda route: route.fulfill(
        status=204,
        headers={'access-control-allow-origin': '*'}
    ))

    page.evaluate("""() => {
        document.querySelectorAll('#Plugin_Product_492326 .Plugin_DealerRelProdPriceInfo').forEach(el => el.remove());
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50);
        window.ToppreiseSuite.updateConfig('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');
        window.ToppreiseSuite.updateConfig('DISCORD_CHANNELS', [{ id: 'ch1', name: 'Deals', url: 'https://discord.com/api/webhooks/123/abc' }]);
    }""")

    page.click('#tp-floating-batch-btn')
    assert page.locator('#tp-batch-discord-meta').text_content() == '0 neu ›'

    page.click('#tp-batch-dealers-btn')
    page.wait_for_function("() => (window.ToppreiseSuite?.lastToast?.() || '').includes('geladen')")

    # Repeat click immediately reports all dealers already loaded
    page.click('#tp-batch-dealers-btn')
    page.wait_for_function("() => window.ToppreiseSuite?.lastToast?.() === '🏬 Alle Händler bereits geladen'")

    # Seed a verified deal and check #tp-batch-discord-meta reflects it, then resets after sharing
    seed_verified_deal(page)
    page.click('#tp-batch-close-btn')
    page.click('#tp-floating-batch-btn')
    assert page.locator('#tp-batch-discord-meta').text_content() == '1 neu ›'

    page.click('#tp-batch-discord-btn')
    page.wait_for_selector('#tp-batch-confirm-popout', state='visible')
    page.click('#tp-batch-confirm-go')
    page.wait_for_function("() => (window.ToppreiseSuite?.lastToast?.() || '').includes('geteilt')")

    if not page.locator('#tp-batch-popover').is_visible():
        page.click('#tp-floating-batch-btn')
    assert page.locator('#tp-batch-discord-meta').text_content() == '0 neu ›'


def test_batch_google_ai_comparison_compacts_query_and_uses_paste_modal_when_huge(page: Page):
    page.evaluate("""() => {
        window.__tpOpenedUrls = [];
        window.__tpCopiedCmp = [];
        window.open = (url) => { window.__tpOpenedUrls.push(url); return {}; };
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async (t) => { window.__tpCopiedCmp.push(t); } }
        });
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 100);
        window.ToppreiseSuite.updateConfig('BATCH_AI_TARGET', 'google-ai');
        window.ToppreiseSuite.updateConfig('BATCH_SCOPE_DEFAULT', 'visible');

        const host = document.querySelector('.Plugin_Product').parentElement;
        const cards = Array.from(document.querySelectorAll('.Plugin_Product'));
        for (const c of cards) {
            if (!c.querySelector('.product-features')) {
                const f = document.createElement('div');
                f.className = 'product-features';
                f.textContent = '27 Zoll · 240 Hz · OLED · USB-C · DisplayHDR';
                c.appendChild(f);
            }
        }
        // Add 6 more cards -> 12 realistic cards whose full prompt > 1850 chars, but compacts cleanly into ?q=
        for (let i = 0; i < 6; i++) {
            const clone = cards[0].cloneNode(true);
            clone.id = 'tp-cmp-clone-' + i;
            clone.dataset.entityId = String(900000 + i);
            const titleLink = clone.querySelector('a[href*="-p"]');
            if (titleLink) {
                titleLink.href = '/preisvergleich/Test/OLED-Monitor-Pro-' + i + '-p' + (900000 + i);
                titleLink.textContent = 'OLED Gaming Monitor Pro Modell ' + (i + 1) + ' 27 Zoll';
            }
            host.appendChild(clone);
        }
        window.ToppreiseSuite.processListings();
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-compare-btn')
    page.wait_for_function("() => window.__tpOpenedUrls.length === 1")

    url = page.evaluate("() => window.__tpOpenedUrls[0]")
    assert url.startswith('https://www.google.com/search?q='), f"Expected compacted ?q= URL, got {url}"
    assert url.endswith('&udm=50')
    assert len(url) < 2000
    assert '12%20Toppreise' in url
    assert '12.' in url

    # Add 40 more cards -> 52 cards exceeds browser URL limit -> paste fallback modal opens instead of blank tab
    page.evaluate("""() => {
        const host = document.querySelector('.Plugin_Product').parentElement;
        const tpl = document.querySelector('.Plugin_Product');
        for (let i = 10; i < 50; i++) {
            const clone = tpl.cloneNode(true);
            clone.id = 'tp-cmp-huge-' + i;
            clone.dataset.entityId = String(910000 + i);
            const titleLink = clone.querySelector('a[href*="-p"]');
            if (titleLink) {
                titleLink.href = '/preisvergleich/Test/Ultra-Huge-Listing-' + i + '-p' + (910000 + i);
                titleLink.textContent = 'Ultra Huge Toppreise Deal Item Variant ' + i;
            }
            host.appendChild(clone);
        }
        window.ToppreiseSuite.processListings();
    }""")

    page.click('#tp-batch-ai-compare-btn')
    ai_pop = page.locator('#tp-batch-ai-popout')
    ai_pop.wait_for(state='visible')
    assert page.evaluate("() => window.__tpOpenedUrls.length") == 1
    assert ai_pop.locator('.tp-batch-paste-preview').is_visible()
    ext_btn = ai_pop.locator('a:has-text("Google AI öffnen")')
    assert ext_btn.get_attribute('href') == 'https://www.google.com/search?udm=50'


def test_batch_google_ai_keeps_full_specs_for_six_items_and_uses_custom_prompt(page: Page):
    page.evaluate("""() => {
        window.__tpOpenedUrls = [];
        window.open = (url) => { window.__tpOpenedUrls.push(url); return {}; };
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50);
        window.ToppreiseSuite.updateConfig('BATCH_AI_TARGET', 'google-ai');
        window.ToppreiseSuite.updateConfig('BATCH_SCOPE_DEFAULT', 'visible');
        window.ToppreiseSuite.updateConfig('BATCH_COMPARE_PROMPT', 'Fokus AM5 vs AM4 ({anzahl} Angebote):');
        document.querySelectorAll('.Plugin_Product').forEach((c) => {
            if (!c.querySelector('.product-features')) {
                const f = document.createElement('div');
                f.className = 'product-features';
                f.textContent = 'AMD Sockel AM5, micro ATX · Dual Channel DDR5 (5200 MHz), PCIe 5.0';
                c.appendChild(f);
            }
        });
        window.ToppreiseSuite.processListings();
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-compare-btn')
    page.wait_for_function("() => window.__tpOpenedUrls.length === 1")

    url = page.evaluate("() => window.__tpOpenedUrls[0]")
    assert 'AM5' in url
    assert 'PCIe%205.0' in url
    assert len(url) < 2000


def test_batch_openrouter_and_google_respect_custom_item_template(page: Page):
    captured = []

    def handle_openrouter(route):
        body = json.loads(route.request.post_data or '{}')
        captured.append(body.get('messages', [{}])[0].get('content', ''))
        route.fulfill(
            status=200,
            headers={'content-type': 'application/json', 'access-control-allow-origin': '*'},
            body=json.dumps({'choices': [{'message': {'content': 'OK', 'annotations': []}}]})
        )

    page.route('https://openrouter.ai/api/v1/chat/completions', handle_openrouter)
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('BATCH_CONFIRM_THRESHOLD', 50);
        window.ToppreiseSuite.updateConfig('BATCH_AI_TARGET', 'openrouter');
        window.ToppreiseSuite.updateConfig('OPENROUTER_API_KEY', 'sk-or-payload-test');
        window.ToppreiseSuite.updateConfig('BATCH_COMPARE_ITEM_TEMPLATE', '{nr}. {titel} | {preis} | Link: {url}');
    }""")

    page.click('#tp-floating-batch-btn')
    page.click('#tp-batch-ai-compare-btn')
    page.locator('#tp-batch-ai-popout').wait_for(state='visible')
    assert len(captured) == 1
    assert 'Link: https://' in captured[0] or 'Link: file://' in captured[0] or 'Link: ' in captured[0]
    assert 'Händler:' not in captured[0]
    assert 'Specs:' not in captured[0]
