import os
import sys
import pytest
from playwright.sync_api import Page

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOCK_HTML = f"file://{os.path.join(BASE_DIR, 'mock_toppreise.html')}"
SCRIPT_PATH = os.path.join(os.path.dirname(BASE_DIR), 'toppreise.user.js')
# pytest's importlib mode doesn't put the tests dir on sys.path, so test
# modules couldn't `from conftest import` these helpers without this.
sys.path.insert(0, BASE_DIR)


@pytest.fixture(scope='session')
def userscript_content():
    with open(SCRIPT_PATH, encoding='utf-8') as script:
        return script.read()


@pytest.fixture
def page(browser, userscript_content):
    page = browser.new_page()
    page.goto(MOCK_HTML)
    page.evaluate(userscript_content)
    page.wait_for_selector('#tp-root >> #tp-settings-fab')
    yield page
    page.close()


DEFAULT_DEAL_STATS = {'tiefstpreis': 1800, 'hoechstpreis': 2600, 'medianPrice': 3600}


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
        stats.time = Date.now();
        localStorage.setItem('tp_hist_v1_' + pid, JSON.stringify(stats));
        if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set(pid, stats);
        window.ToppreiseSuite.processListings();
    }""", [pid, merged, clear])


def mock_pricechart(page, lows):
    """Fulfill pricechart requests with PriceChartLegend HTML per pid.

    lows maps pid -> low, or pid -> (low, high). Unlisted pids get a 404 so
    tests never hang on an unmocked fetch.
    """
    def handle_pricechart(route):
        url = route.request.url
        post_data = route.request.post_data or ''
        for pid, lh in lows.items():
            if f'p_pc_pid={pid}' in url or str(pid) in post_data:
                low = lh[0] if isinstance(lh, tuple) else lh
                high = lh[1] if isinstance(lh, tuple) else None
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


def open_settings(page, advanced=False):
    """Open the settings modal via FAB; optionally reveal the advanced panel."""
    page.click('#tp-root >> #tp-settings-fab')
    page.wait_for_selector('#tp-root >> #tp-settings-dialog', state='visible')
    if advanced:
        page.click('#tp-root >> #tp-advanced-details > summary')
