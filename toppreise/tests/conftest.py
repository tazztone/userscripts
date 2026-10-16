import os
import sys
import pytest
from playwright.sync_api import Page, expect

expect.set_options(timeout=2000)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOCK_HTML = f"file://{os.path.join(BASE_DIR, 'mock_toppreise.html')}"
SCRIPT_PATH = os.path.join(os.path.dirname(BASE_DIR), 'toppreise.user.js')
# pytest's importlib mode doesn't put the tests dir on sys.path, so test
# modules couldn't `from conftest import` these helpers without this.
sys.path.insert(0, BASE_DIR)


import subprocess


@pytest.fixture(scope='session')
def userscript_content():
    # Freshness / drift guard: verify bundle matches src/ before running browser suite
    build_tool = os.path.join(os.path.dirname(BASE_DIR), 'tools', 'build.js')
    if os.path.exists(build_tool):
        check_proc = subprocess.run(['node', build_tool, '--check'], capture_output=True, text=True)
        if check_proc.returncode != 0:
            if os.environ.get('CI') or os.environ.get('STRICT_BUILD_CHECK'):
                pytest.fail(f"toppreise.user.js is out-of-date with src/. Run 'node tools/build.js'. Output:\n{check_proc.stdout}\n{check_proc.stderr}")
            print("\n[conftest] Stale toppreise.user.js detected; rebuilding bundle for test session...")
            rebuild_proc = subprocess.run(['node', build_tool], capture_output=True, text=True)
            if rebuild_proc.returncode != 0:
                pytest.fail(f"Failed to build toppreise.user.js:\n{rebuild_proc.stderr}")
    with open(SCRIPT_PATH, encoding='utf-8') as script:
        return script.read()


@pytest.fixture
def page(browser, userscript_content):
    page = browser.new_page()
    page.set_default_timeout(2500)
    page.on("pageerror", lambda err: pytest.fail(f"Unhandled browser exception: {err}"))
    page.goto(MOCK_HTML)
    page.add_style_tag(content="*, *::before, *::after { transition: none !important; animation: none !important; }")
    page.evaluate("() => localStorage.clear()")
    # Full ToppreiseSuite harness (CONFIG/mutators) exists only with DEBUG;
    # production serves a frozen minimal handle instead. The marker skips the
    # one-time legacy migration that would otherwise silence stored DEBUG.
    page.evaluate("() => { localStorage.setItem('tp_suite_v2_DEBUG', 'true'); localStorage.setItem('tp_suite_v2_MIGRATED_DEBUG_OFF', 'true'); }")
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    yield page
    page.close()


DEFAULT_DEAL_STATS = {'tiefstpreis': 1800, 'hoechstpreis': 2600, 'medianPrice': 3600}


def drop_store_filter(page):
    """Remove the dealer store-filter chip so dealer verdicts stay out, then reprocess.

    Scopes a test to the non-dealer removal causes (Negativ, Min-Angebote,
    Ungeprüfte, Fallback): dealer-filtered cards would otherwise vanish under
    the unconditional dealer removal and hide the behavior under test.
    """
    page.evaluate("() => { document.querySelectorAll('.filters .f_remove_filter[data-target-type=\"df\"]').forEach(el => el.remove()); window.ToppreiseSuite?.processListings?.(); }")


def seed_verified_deal(page, pid='797571', stats=None, clear=True):
    """Seed verified history for one pid, then reprocess.

    Clears first: file:// storage can leak between tests sharing one browser
    context. Pass clear=False for the 2nd+ pid when seeding several cards
    before a single processListings() pass.
    """
    merged = {**DEFAULT_DEAL_STATS, **(stats or {})}
    page.evaluate("""([pid, stats, clear]) => {
        if (clear) {
            localStorage.clear();
            if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
        }
        stats.time = stats.time || Date.now();
        localStorage.setItem('tp_hist_v1_' + pid, JSON.stringify(stats));
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set(window.ToppreiseSuite.statsKey(pid), stats);
        window.ToppreiseSuite.processListings();
    }""", [pid, merged, clear])


def mock_pricechart(page, lows):
    """Fulfill pricechart requests per pid.

    lows maps pid -> low, or pid -> (low, high). Unlisted pids get a 404 so
    tests never hang on an unmocked fetch.

    Live-faithful split: POST (JSON time-series) returns the [product,
    shipping] series pair the suite picks per price basis; GET (HTML modal
    fallback) returns PriceChartLegend HTML. Both carry the same low so the
    verdict rule holds on either path (no median/series is synthesized, so
    getDisplayDelta compares card price P against tiefstpreis L only):
    P <= L is a deal, P > L is a markup (severe at P >= 1.5*L). The tuple's
    high only toggles peak-tooltip context, never the kind — e.g. (500, 2400)
    on the 1800-CHF card is a +260% severe markup (tp-deal-not-low), not a
    deal, even though 1800 < 2400.
    """
    import json as _json
    import time as _time
    _now = int(_time.time() * 1000)
    _day = 86400 * 1000

    def handle_pricechart(route):
        url = route.request.url
        post_data = route.request.post_data or ''
        for pid, lh in lows.items():
            if f'p_pc_pid={pid}' in url or str(pid) in post_data:
                low = lh[0] if isinstance(lh, tuple) else lh
                high = lh[1] if isinstance(lh, tuple) else None
                if route.request.method == 'POST':
                    series = [[_now - (9 - i) * _day, low] for i in range(10)]
                    route.fulfill(
                        status=200,
                        headers={'access-control-allow-origin': '*'},
                        content_type='application/json',
                        body=_json.dumps([series, series]),
                    )
                    return
                cols = f'<div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">{low:.2f}</div></div>'
                if high is not None:
                    cols += f'<div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">{high:.2f}</div></div>'
                route.fulfill(
                    status=200,
                    headers={'access-control-allow-origin': '*'},
                    content_type='text/html',
                    body=f'<div class="PriceChartLegend">{cols}</div>',
                )
                return
        route.fulfill(status=404, headers={'access-control-allow-origin': '*'}, body='Not Found')

    page.route('**/plugins/product/pricechart*', handle_pricechart)


def open_settings(page):
    """Open the settings modal via FAB (all sections always visible)."""
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')


def open_filter_popover(page):
    """Open the filter popover; toggles, so only click when closed."""
    if 'tp-show' not in (page.locator('#tp-bar-filter-popover').get_attribute('class') or ''):
        page.click('#tp-bar-filter-btn')
        page.wait_for_selector('#tp-bar-filter-popover.tp-show')


def seed_bestpreise_trio(page):
    """Activate 50/50 Tiefstpreise mode, then reprocess (seeds set per test)."""
    page.evaluate("""() => {
        window.ToppreiseSuite.CONFIG.BESTPREISE_WEIGHT_RECORD = 0.50;
        window.ToppreiseSuite.CONFIG.BESTPREISE_MODE_ACTIVE = true;
        window.ToppreiseSuite.processListings();
    }""")


def import_config(page, payload, filename='config.json'):
    """Push a config payload through the hidden file-import input."""
    page.evaluate("""([payload, filename]) => {
        const shadow = document.getElementById('tp-root').shadowRoot;
        const fileInput = shadow.getElementById('tp-import-config-file');
        const blob = new Blob([typeof payload === 'string' ? payload : JSON.stringify(payload)], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }""", [payload, filename])
