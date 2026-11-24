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
    page.click('#tp-root >> #tp-openrouter-api-key-reveal')
    key_input = page.locator('#tp-root >> #tp-openrouter-api-key-input')
    key_input.fill('sk-or-v1-secret-test-key')
    page.keyboard.press('Escape')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='hidden')
    assert key_input.input_value() == ''
