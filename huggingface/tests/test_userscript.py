import os

import pytest
from playwright.sync_api import Page


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOCK_HTML = f"file://{os.path.join(BASE_DIR, 'mock_huggingface.html')}"
SCRIPT_PATH = os.path.join(os.path.dirname(BASE_DIR), 'huggingface-heart.user.js')


@pytest.fixture(scope='session')
def userscript_content():
    with open(SCRIPT_PATH, encoding='utf-8') as script:
        return script.read()


@pytest.fixture
def page(browser, userscript_content):
    page = browser.new_page()
    page.goto(MOCK_HTML)
    page.evaluate(userscript_content)
    page.wait_for_selector('#unliked-like[data-hf-inline-bound]')
    yield page
    page.close()


@pytest.fixture
def shared_footer_page(browser, userscript_content):
    page = browser.new_page()
    page.goto(MOCK_HTML)
    page.evaluate("""() => {
      for (const [cardId, likeId] of [['card-unliked', 'unliked-like'], ['card-liked', 'liked-like']]) {
        const card = document.querySelector(`#${cardId}`);
        document.querySelector(`#${likeId}`).prepend(card.querySelector('.task-badge svg'));
      }
    }""")
    page.evaluate(userscript_content)
    page.wait_for_selector('#unliked-like[data-hf-inline-bound]')
    yield page
    page.close()


def requests(page: Page):
    return page.evaluate('window.likeRequests')


def test_inline_like_and_unlike_stay_on_the_card(page: Page):
    page.click('#unliked-like')
    page.wait_for_function('window.likeRequests.length === 1')

    assert page.url == MOCK_HTML
    assert requests(page)[0]['url'] == '/api/models/owner/model/like'
    assert requests(page)[0]['method'] == 'POST'
    assert page.locator('#card-unliked').get_attribute('class').find('hf-is-liked') >= 0
    assert page.locator('#card-unliked').get_attribute('class').find('hf-is-unliked') == -1
    assert page.locator('#unliked-like').inner_text() == '34'
    assert 'text-red-500' in (page.locator('#unliked-like svg').get_attribute('class') or '')

    page.click('#unliked-like')
    page.wait_for_function('window.likeRequests.length === 2')

    assert requests(page)[1]['method'] == 'DELETE'
    assert page.locator('#card-unliked').get_attribute('class').find('hf-is-unliked') >= 0
    assert page.locator('#unliked-like').inner_text() == '33'


def test_liked_card_uses_delete_and_task_icon_does_not_bind(page: Page):
    assert 'hf-is-liked' in (page.locator('#card-liked').get_attribute('class') or '')
    assert 'hf-is-unliked' not in (page.locator('#card-liked').get_attribute('class') or '')

    page.click('#liked-like')
    page.wait_for_function('window.likeRequests.length === 1')

    assert requests(page)[0]['url'] == '/api/models/owner/liked-model/like'
    assert requests(page)[0]['method'] == 'DELETE'
    assert page.locator('#liked-like').inner_text() == '6'

    page.click('#task-icon')
    assert page.evaluate('window.navigationAttempts') == 1
    assert len(requests(page)) == 1


def test_hydrated_liked_card_clears_unliked_border(page: Page):
    assert 'hf-is-unliked' in (page.locator('#card-unliked').get_attribute('class') or '')

    page.locator('#unliked-like svg').evaluate("""svg => {
      svg.classList.add('text-red-500');
      svg.querySelector('path').setAttribute('d', 'M22.5,4c-2,0-3.9,0.8-5.3,2.2L16,7.4');
    }""")
    page.wait_for_timeout(350)

    classes = page.locator('#card-unliked').get_attribute('class') or ''
    assert 'hf-is-liked' in classes
    assert 'hf-is-unliked' not in classes
    assert page.locator('#unliked-like').get_attribute('aria-pressed') == 'true'
    assert page.locator('#card-unliked').evaluate(
        "card => getComputedStyle(card).borderTopColor"
    ) != 'rgb(16, 185, 129)'


def test_shared_footer_rescan_preserves_liked_state(shared_footer_page: Page):
    initial = shared_footer_page.evaluate("""() => [
      document.querySelector('#card-unliked').className,
      document.querySelector('#card-liked').className
    ]""")
    shared_footer_page.evaluate("document.body.append(document.createElement('span'))")
    shared_footer_page.wait_for_timeout(350)
    final = shared_footer_page.evaluate("""() => [
      document.querySelector('#card-unliked').className,
      document.querySelector('#card-liked').className
    ]""")

    assert 'hf-is-unliked' in initial[0]
    assert 'hf-is-liked' in initial[1]
    assert 'hf-is-unliked' in final[0]
    assert 'hf-is-liked' in final[1]


@pytest.mark.parametrize('fetch_mode,expected_toast', [
    ('unauthorized', True),
    ('reject', False),
])
def test_failed_request_restores_optimistic_state(page: Page, fetch_mode, expected_toast):
    page.evaluate(f"window.fetchMode = '{fetch_mode}'")
    page.click('#unliked-like')
    page.wait_for_function('window.likeRequests.length === 1')
    page.wait_for_function("document.querySelector('#unliked-like').getAttribute('aria-pressed') === 'false'")

    assert page.locator('#card-unliked').get_attribute('class').find('hf-is-unliked') >= 0
    assert page.locator('#unliked-like').inner_text() == '33'
    if expected_toast:
        page.wait_for_selector('#hf-date-filter-root >> .hf-toast')
        assert page.locator('#hf-date-filter-root >> .hf-toast').is_visible()


def test_keyboard_activation(page: Page):
    page.locator('#unliked-like').focus()
    page.keyboard.press('Space')
    page.wait_for_function('window.likeRequests.length === 1')

    assert requests(page)[0]['method'] == 'POST'
    assert page.locator('#unliked-like').get_attribute('aria-pressed') == 'true'


def test_dynamic_cards_are_bound_once(page: Page):
    page.evaluate("""
      const card = document.querySelector('#card-unliked').cloneNode(true);
      card.id = 'card-dynamic';
      card.querySelector('.model-link').href = '/owner/dynamic-model';
      card.querySelector('.title').textContent = 'owner/dynamic-model';
      const like = card.querySelector('#unliked-like');
      like.id = 'dynamic-like';
      like.removeAttribute('data-hf-inline-bound');
      like.removeAttribute('aria-label');
      like.removeAttribute('aria-pressed');
      like.removeAttribute('role');
      like.removeAttribute('tabindex');
      like.classList.remove('hf-inline-like-btn');
      like.style.cursor = '';
      document.querySelector('#model-grid').appendChild(card);
    """)
    page.wait_for_selector('#dynamic-like[data-hf-inline-bound]')
    page.click('#dynamic-like')
    page.wait_for_function('window.likeRequests.length === 1')

    assert requests(page)[0]['url'] == '/api/models/owner/dynamic-model/like'
    assert requests(page)[0]['method'] == 'POST'


def test_negative_text_filter_substring(page: Page):
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'gguf')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    assert 'hf-filtered-out' in (page.locator('#card-gguf').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-fp8').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-unliked').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-liked').get_attribute('class') or '')
    assert 'Showing 3 / 4' in page.locator('#hf-date-filter-root >> #hf-df-badge').inner_text()


def test_negative_text_filter_regex_and_multi_term(page: Page):
    page.fill('#hf-date-filter-root >> #hf-exclude-input', '/(?:gguf|fp8)/i')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out') && document.querySelector('#card-fp8').classList.contains('hf-filtered-out')")

    assert 'hf-filtered-out' in (page.locator('#card-gguf').get_attribute('class') or '')
    assert 'hf-filtered-out' in (page.locator('#card-fp8').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-unliked').get_attribute('class') or '')
    assert 'Showing 2 / 4' in page.locator('#hf-date-filter-root >> #hf-df-badge').inner_text()


def test_negative_text_filter_clear_button(page: Page):
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'gguf')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    page.click('#hf-date-filter-root >> #hf-exclude-clear-btn')
    page.wait_for_function("!document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    assert page.locator('#hf-date-filter-root >> #hf-exclude-input').input_value() == ''
    assert 'hf-filtered-out' not in (page.locator('#card-gguf').get_attribute('class') or '')
    assert 'All shown (4)' in page.locator('#hf-date-filter-root >> #hf-df-badge').inner_text()


def test_negative_text_filter_toggle(page: Page):
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'gguf')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    # Disable toggle
    page.click('#hf-date-filter-root >> #hf-exclude-toggle + .hf-slider')
    page.wait_for_function("!document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    assert page.locator('#hf-date-filter-root >> #hf-exclude-input').input_value() == 'gguf'
    assert 'hf-filtered-out' not in (page.locator('#card-gguf').get_attribute('class') or '')
    assert 'hf-section-dimmed' in (page.locator('#hf-date-filter-root >> #hf-exclude-section-body').get_attribute('class') or '')

    # Re-enable toggle
    page.click('#hf-date-filter-root >> #hf-exclude-toggle + .hf-slider')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")
    assert 'hf-filtered-out' in (page.locator('#card-gguf').get_attribute('class') or '')


def test_widget_collapse_and_expand(page: Page):
    # Initially expanded
    assert 'collapsed' not in (page.locator('#hf-date-filter-root >> #hf-date-filter-widget').get_attribute('class') or '')
    assert page.locator('#hf-date-filter-root >> #hf-widget-body').is_visible()

    # Click header to collapse
    page.click('#hf-date-filter-root >> #hf-df-header')
    page.wait_for_function("document.querySelector('#hf-date-filter-root').shadowRoot.querySelector('#hf-date-filter-widget').classList.contains('collapsed')")
    assert 'collapsed' in (page.locator('#hf-date-filter-root >> #hf-date-filter-widget').get_attribute('class') or '')
    assert not page.locator('#hf-date-filter-root >> #hf-widget-body').is_visible()

    # Click collapse button to expand
    page.click('#hf-date-filter-root >> #hf-df-collapse-btn')
    page.wait_for_function("!document.querySelector('#hf-date-filter-root').shadowRoot.querySelector('#hf-date-filter-widget').classList.contains('collapsed')")
    assert 'collapsed' not in (page.locator('#hf-date-filter-root >> #hf-date-filter-widget').get_attribute('class') or '')
    assert page.locator('#hf-date-filter-root >> #hf-widget-body').is_visible()


def test_reset_all_filters_button(page: Page):
    # Set negative keywords and enable date preset
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'gguf')
    page.click('#hf-date-filter-root >> [data-preset="7d"]')
    page.wait_for_function("document.querySelector('#card-gguf').classList.contains('hf-filtered-out')")

    # Click reset button in header
    page.click('#hf-date-filter-root >> #hf-df-reset-btn')
    page.wait_for_function("document.querySelector('#hf-date-filter-root').shadowRoot.querySelector('#hf-exclude-input').value === ''")

    # Verify input cleared and all cards shown
    assert page.locator('#hf-date-filter-root >> #hf-exclude-input').input_value() == ''
    assert 'All shown (4)' in page.locator('#hf-date-filter-root >> #hf-df-badge').inner_text()
    assert 'hf-filtered-out' not in (page.locator('#card-gguf').get_attribute('class') or '')


def test_summary_chips_rendering(page: Page):
    # Add negative keyword filter
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'gguf')
    page.wait_for_function("document.querySelector('#hf-date-filter-root').shadowRoot.querySelectorAll('.hf-df-chip').length >= 1")
    chips_text = page.locator('#hf-date-filter-root >> #hf-df-summary-chips').inner_text()
    assert 'gguf' in chips_text

    # Enable date preset
    page.click('#hf-date-filter-root >> [data-preset="30d"]')
    page.wait_for_function("document.querySelector('#hf-date-filter-root').shadowRoot.querySelectorAll('.hf-df-chip').length === 2")
    chips_text = page.locator('#hf-date-filter-root >> #hf-df-summary-chips').inner_text()
    assert '30d' in chips_text


def test_keyboard_shortcut_alt_f(page: Page):
    # Press Alt+F to focus and toggle
    page.keyboard.press('Alt+KeyF')
    page.wait_for_timeout(100)
    focused_id = page.evaluate("document.querySelector('#hf-date-filter-root').shadowRoot.activeElement?.id")
    assert focused_id == 'hf-exclude-input'


def test_widget_on_zero_model_cards_page(browser, userscript_content):
    page = browser.new_page()
    page.goto(MOCK_HTML)
    # Clear all model cards to simulate a single model page or empty search
    page.evaluate("document.querySelector('#model-grid').innerHTML = ''")
    page.evaluate(userscript_content)
    page.wait_for_selector('#hf-date-filter-root')

    # Badge should show Ready and no empty-notice alert should appear
    badge_text = page.locator('#hf-date-filter-root >> #hf-df-badge').inner_text()
    assert badge_text in ['Ready', 'All shown (0)']
    assert page.locator('#hf-df-empty-notice').count() == 0
    page.close()


def test_unliked_only_filter_hides_liked_models(page: Page):
    # In mock, card-liked is liked, card-unliked, card-gguf, card-fp8 are unliked
    assert 'hf-is-liked' in (page.locator('#card-liked').get_attribute('class') or '')
    assert 'hf-is-unliked' in (page.locator('#card-unliked').get_attribute('class') or '')

    # Toggle "Only Unliked"
    page.click('#hf-date-filter-root >> #hf-unliked-toggle + .hf-slider')
    page.wait_for_function("document.querySelector('#card-liked').classList.contains('hf-liked-filtered-out')")

    # Liked card is hidden, unliked cards remain visible
    assert 'hf-filtered-out' in (page.locator('#card-liked').get_attribute('class') or '')
    assert 'hf-liked-filtered-out' in (page.locator('#card-liked').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-unliked').get_attribute('class') or '')
    assert 'hf-filtered-out' not in (page.locator('#card-gguf').get_attribute('class') or '')

    # Summary chip is rendered
    chips_text = page.locator('#hf-date-filter-root >> #hf-df-summary-chips').inner_text()
    assert 'Unliked' in chips_text


def test_liking_unliked_card_when_unliked_only_active_retains_card(page: Page):
    # Toggle "Only Unliked"
    page.click('#hf-date-filter-root >> #hf-unliked-toggle + .hf-slider')
    page.wait_for_function("document.querySelector('#card-liked').classList.contains('hf-liked-filtered-out')")

    # Click heart on unliked card
    page.click('#unliked-like')
    page.wait_for_function("window.likeRequests.length === 1")

    # Card becomes liked, green border clears, but card is NOT filtered out because of hfJustLiked
    classes = page.locator('#card-unliked').get_attribute('class') or ''
    assert 'hf-is-liked' in classes
    assert 'hf-is-unliked' not in classes
    assert 'hf-liked-filtered-out' not in classes
    assert 'hf-filtered-out' not in classes
    assert page.locator('#card-unliked').get_attribute('data-hf-just-liked') == 'true'


def test_scan_next_unliked_fetches_and_appends_cards(page: Page):
    # Set mock next page HTML containing a new unliked model card
    page.evaluate("""() => {
      window.nextPageHtml = `
        <article id="card-scanned" class="overview-card-wrapper">
          <a class="model-link" href="/scanned-owner/scanned-model">
            <div class="title">scanned-owner/scanned-model</div>
            <div class="metadata">
              <time datetime="2026-08-11T09:00:00Z">just now</time>
              <div id="scanned-like" class="mr-1 flex items-center">
                <svg viewBox="0 0 30 30" fill="currentColor"><path d="M22.45,6a5.47,5.47,0,0,1,3.91,1.64m0-2"></path></svg>
                <span>10</span>
              </div>
            </div>
          </a>
        </article>
      `;
    }""")

    initial_count = page.locator('article.overview-card-wrapper').count()
    assert initial_count == 4

    # Click scan button
    page.click('#hf-date-filter-root >> #hf-scan-btn')
    page.wait_for_selector('#card-scanned')

    # Card was appended into DOM and processed
    assert page.locator('article.overview-card-wrapper').count() == 5
    assert 'hf-is-unliked' in (page.locator('#card-scanned').get_attribute('class') or '')
    assert page.locator('#scanned-like[data-hf-inline-bound]').count() == 1

    # Wait until scanning completes and verify status shows exact page reached
    page.wait_for_selector('#hf-date-filter-root >> #hf-scan-btn:not(.scanning)', timeout=5000)
    status_text = page.locator('#hf-date-filter-root >> #hf-scan-status').inner_text()
    assert '+1 unliked (thru p.6)' in status_text


def test_scan_zero_unliked_status(page: Page):
    page.evaluate("() => { window.nextPageHtml = ''; }")
    page.click('#hf-date-filter-root >> #hf-scan-btn')
    page.wait_for_selector('#hf-date-filter-root >> #hf-scan-btn:not(.scanning)', timeout=5000)
    status_text = page.locator('#hf-date-filter-root >> #hf-scan-status').inner_text()
    assert 'End of catalog (p.1)' in status_text


def test_empty_notice_scan_button(page: Page):
    # Filter everything out by an unmatched keyword
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'owner')
    page.wait_for_selector('#hf-df-empty-notice')

    # Empty notice should display scan button
    assert page.locator('#hf-empty-scan-btn').count() == 1
    assert 'Scan Next Pages' in page.locator('#hf-empty-scan-btn').inner_text()

    # Verify button DOM node remains stable (no teardown/rebuild cycle causing pulsing or dropped clicks)
    page.evaluate("() => { window._testBtnRef = document.querySelector('#hf-empty-scan-btn'); }")
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'owner-different')
    page.wait_for_timeout(300)
    is_same_node = page.evaluate("() => window._testBtnRef === document.querySelector('#hf-empty-scan-btn')")
    assert is_same_node is True


def test_bottom_scan_bar_renders_after_grid(page: Page):
    page.wait_for_selector('#hf-bottom-scan-bar')
    bar = page.locator('#hf-bottom-scan-bar')
    assert bar.count() == 1
    assert bar.locator('#hf-bottom-scan-btn').count() == 1
    assert 'Scan Next Unliked' in bar.locator('#hf-bottom-scan-btn').inner_text()
    assert bar.locator('#hf-bottom-scan-status').count() == 1


def test_bottom_scan_button_triggers_scan(page: Page):
    page.evaluate("""() => {
      window.nextPageHtml = `
        <article id="card-scanned-bottom" class="overview-card-wrapper">
          <a class="model-link" href="/scanned-bottom/model-bottom">
            <div class="title">scanned-bottom/model-bottom</div>
            <div class="metadata">
              <time datetime="2026-08-11T09:00:00Z">just now</time>
              <div id="scanned-like-b" class="mr-1 flex items-center">
                <svg viewBox="0 0 30 30" fill="currentColor"><path d="M22.45,6a5.47,5.47,0,0,1,3.91,1.64m0-2"></path></svg>
                <span>5</span>
              </div>
            </div>
          </a>
        </article>
      `;
    }""")
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#card-scanned-bottom')
    assert page.locator('#card-scanned-bottom').count() == 1

    # Status synchronizes on bottom bar
    page.wait_for_selector('#hf-bottom-scan-btn:not(.scanning)', timeout=5000)
    bottom_status = page.locator('#hf-bottom-scan-status').inner_text()
    assert 'thru p.6' in bottom_status


def test_bottom_scan_bar_hides_on_empty_filter(page: Page):
    # Initially visible
    assert page.locator('#hf-bottom-scan-bar').is_visible()

    # Filter all cards
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'owner')
    page.wait_for_selector('#hf-df-empty-notice')

    # Bottom bar should be hidden when empty notice shows
    assert not page.locator('#hf-bottom-scan-bar').is_visible()


def test_scan_hotkey_alt_s(page: Page):
    page.evaluate("""() => {
      window.nextPageHtml = `
        <article id="card-scanned-hotkey" class="overview-card-wrapper">
          <a class="model-link" href="/scanned-hotkey/model-hotkey">
            <div class="title">scanned-hotkey/model-hotkey</div>
          </a>
        </article>
      `;
    }""")
    page.keyboard.press('Alt+KeyS')
    page.wait_for_selector('#card-scanned-hotkey')
    assert page.locator('#card-scanned-hotkey').count() == 1


def test_scan_rate_limit_429(page: Page):
    page.evaluate("() => { window.fetchMode = 'ratelimit'; }")
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#hf-bottom-scan-btn:not(.scanning)', timeout=5000)
    status_text = page.locator('#hf-bottom-scan-status').inner_text()
    assert 'Rate limited' in status_text


def test_empty_notice_does_not_trigger_mutation_observer_loop(page: Page):
    # Filter all models to trigger empty notice
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'owner')
    page.wait_for_selector('#hf-df-empty-notice')

    # Monitor empty notice for unexpected recurring mutations
    page.evaluate("""() => {
      window._emptyNoticeMutations = 0;
      const target = document.querySelector('#hf-df-empty-notice');
      const obs = new MutationObserver(() => {
        window._emptyNoticeMutations++;
      });
      obs.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
    }""")

    # Wait 600ms (longer than 200ms observerTimer debounce)
    page.wait_for_timeout(600)

    # If an infinite observer loop existed, _emptyNoticeMutations would increment repeatedly every 200ms
    mutation_count = page.evaluate("() => window._emptyNoticeMutations")
    assert mutation_count == 0, f"Expected 0 mutations on idle empty notice, got {mutation_count} (infinite observer loop detected)"


def test_empty_notice_scan_button_click_triggers_scan(page: Page):
    # Filter all models
    page.fill('#hf-date-filter-root >> #hf-exclude-input', 'owner')
    page.wait_for_selector('#hf-empty-scan-btn')

    page.evaluate("""() => {
      window.nextPageHtml = `
        <article id="card-scanned-from-empty" class="overview-card-wrapper">
          <a class="model-link" href="/scanned-empty/model-1">
            <div class="title">scanned-empty/model-1</div>
          </a>
        </article>
      `;
    }""")

    # Click the scan button in the empty notice
    page.click('#hf-empty-scan-btn')
    page.wait_for_selector('#card-scanned-from-empty')
    assert page.locator('#card-scanned-from-empty').count() == 1


def test_consecutive_scans_accumulate_and_report_last_page(page: Page):
    # Setup mock page fetcher that generates distinct cards per page
    page.evaluate("""() => {
      window.scanFetchCalls = [];
      window.fetch = async (url, options = {}) => {
        window.scanFetchCalls.push(url);
        const u = new URL(url, window.location.origin);
        const p = u.searchParams.get('p') || '0';
        return {
          status: 200,
          ok: true,
          text: async () => `
            <article id="card-p${p}" class="overview-card-wrapper">
              <a class="model-link" href="/model/p${p}">
                <div class="title">model/p${p}</div>
                <div class="metadata"><div class="like-btn"><span>0</span></div></div>
              </a>
            </article>
          `
        };
      };
    }""")

    # Run 1: Scans from p=0 (page 1) to p=5 (page 6)
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#hf-bottom-scan-btn:not(.scanning)', timeout=5000)
    status_1 = page.locator('#hf-bottom-scan-status').inner_text()
    assert 'thru p.6' in status_1
    assert '(5p)' not in status_1, "Status incorrectly displayed batch count '(5p)' instead of page reached 'thru p.6'"

    # Run 2: Scans next 5 pages from p=5 (page 6) to p=10 (page 11)
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#hf-bottom-scan-btn:not(.scanning)', timeout=5000)
    status_2 = page.locator('#hf-bottom-scan-status').inner_text()
    assert 'thru p.11' in status_2
    assert '(5p)' not in status_2, "Status incorrectly displayed batch count '(5p)' on run 2 instead of cumulative page reached 'thru p.11'"


def test_scan_abort_reports_exact_page_stopped_at(page: Page):
    # Setup slow fetch so we can abort mid-scan on page 2
    page.evaluate("""() => {
      let callCount = 0;
      window.fetch = async (url, options = {}) => {
        callCount++;
        if (callCount >= 2) {
          // Delay to allow clicking Stop Scan
          await new Promise(r => setTimeout(r, 600));
        }
        return {
          status: 200,
          ok: true,
          text: async () => `
            <article id="card-slow-${callCount}" class="overview-card-wrapper">
              <a class="model-link" href="/model/slow-${callCount}"><div class="title">slow-${callCount}</div></a>
            </article>
          `
        };
      };
    }""")

    # Start scan
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#hf-bottom-scan-btn.scanning')
    page.wait_for_selector('#card-slow-1')

    # Click stop scan while scanning
    page.click('#hf-bottom-scan-btn')
    page.wait_for_selector('#hf-bottom-scan-btn:not(.scanning)', timeout=5000)

    status = page.locator('#hf-bottom-scan-status').inner_text()
    assert 'Stopped at p.' in status, f"Expected 'Stopped at p.X', got: {status}"
    assert status != 'Scan stopped', "Status showed generic 'Scan stopped' without page progress"





