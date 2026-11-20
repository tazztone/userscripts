"""Offline Playwright geometry & DOM contract matrix across all 5 Toppreise layouts."""

from pathlib import Path
import pytest

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

LAYOUT_FIXTURES = [
    ("neue", FIXTURES_DIR / "live_neue_toppreise.html"),
    ("list", FIXTURES_DIR / "live_category_browsing.html"),
    ("box", FIXTURES_DIR / "live_category_box.html"),
    ("expert", FIXTURES_DIR / "live_category_expert.html"),
    ("detail", FIXTURES_DIR / "live_product_detail.html"),
]

VIEWPORTS = [
    (1440, 900),
    (1280, 800),
    (768, 1024),
    (390, 844),
]

SEED_STATE_JS = """({ state }) => {
  localStorage.setItem('tp_suite_v2_DEBUG', 'true');
  localStorage.setItem('tp_suite_v2_MIGRATED_DEBUG_OFF', 'true');
  const now = Date.now();
  const day = 86400000;
  const pids = [];
  document.querySelectorAll('.Plugin_Product[href*="-p"], .Plugin_Product a[href*="-p"]').forEach(a => {
    const m = a.href.match(/-p(\\d+)/);
    if (m && !pids.includes(m[1])) pids.push(m[1]);
  });
  for (const pid of pids.slice(0, 16)) {
    if (state === 'unchecked') {
      localStorage.removeItem(`tp_hist_v1_${pid}_s`);
      localStorage.removeItem(`tp_hist_v1_${pid}_p`);
      localStorage.removeItem(`tp_dealer_v1_${pid}`);
      continue;
    }
    const isDeal = state === 'deal';
    const hist = {
      tiefstpreis: isDeal ? 100 : 50,
      medianPrice: isDeal ? 120 : 60,
      vorTiefstpreis: isDeal ? 115 : 55,
      timeSeries: [
        [now - 30 * day, isDeal ? 125 : 55],
        [now - 15 * day, isDeal ? 118 : 52],
        [now - 5 * day, isDeal ? 110 : 58],
        [now, isDeal ? 85 : 95],
      ],
      time: now,
    };
    localStorage.setItem(`tp_hist_v1_${pid}_s`, JSON.stringify(hist));
    localStorage.setItem(`tp_hist_v1_${pid}_p`, JSON.stringify(hist));
    const dealerData = {
      dealer: 'BRACK.CH AG',
      url: 'https://www.toppreise.ch/ext_de',
      offers: 5,
      totalOffers: 5,
      time: now,
    };
    localStorage.setItem(`tp_dealer_v1_${pid}`, JSON.stringify({ time: now, s: dealerData, p: dealerData }));
  }
}"""

AUDIT_MATRIX_JS = """({ layout, state, vw, nativeOverflow }) => {
  const defects = [];
  const docOverflow = document.documentElement.scrollWidth - window.innerWidth;
  const allowedOverflow = (layout === 'detail' && vw === 768) ? Math.max(1, nativeOverflow + 1) : 1;
  if (docOverflow > allowedOverflow) {
    defects.push({ type: 'doc_overflow', px: docOverflow, allowed: allowedOverflow });
  }

  const rectsOverlap = (a, b, tol = 1.5) => {
    if (!a || !b || a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false;
    return !(a.right <= b.left + tol || a.left >= b.right - tol || a.bottom <= b.top + tol || a.top >= b.bottom - tol);
  };

  const filterBar = document.querySelector('#tp-suite-filter-bar');
  if (filterBar) {
    const r = filterBar.getBoundingClientRect();
    if (filterBar.scrollWidth > filterBar.clientWidth + 2) {
      defects.push({ type: 'filter_bar_overflow', sw: filterBar.scrollWidth, cw: filterBar.clientWidth });
    }
    for (const btn of filterBar.querySelectorAll('button, .tp-filter-pill')) {
      const br = btn.getBoundingClientRect();
      if (br.width > 0 && (br.right > r.right + 2 || br.left < r.left - 2)) {
        defects.push({ type: 'filter_btn_clipped', text: btn.textContent.trim().slice(0, 20) });
      }
    }
  }

  const cta = document.querySelector('#tp-floating-check-cta');
  const fab = document.querySelector('#tp-settings-fab');
  if (cta && fab && rectsOverlap(cta.getBoundingClientRect(), fab.getBoundingClientRect(), 0)) {
    defects.push({ type: 'cta_fab_overlap' });
  }

  const cards = [
    ...Array.from(document.querySelectorAll('.Plugin_Product:not(.f_collection)')).slice(0, 6),
    ...Array.from(document.querySelectorAll('.Plugin_Product.f_collection')).slice(0, 4),
  ];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cr = card.getBoundingClientRect();
    if (cr.width === 0 || cr.height === 0) continue;

    // 1. Extraction contract
    if (window.ToppreiseSuite?.extractShareData) {
      const data = window.ToppreiseSuite.extractShareData(card);
      if (!data || !data.pid || !data.url || !data.url.includes('/preisvergleich/') || !data.title || data.title === 'Top Deal') {
        defects.push({ type: 'extraction_contract_fail', card: i, data });
      }
    }

    // 2. Layout placement & exclusions
    const inBoxOrExpert = card.classList.contains('mixedBrowsingBox') ||
      card.classList.contains('mixedBrowsingExpert') ||
      !!card.closest('.standardList.box, .standardList.expert');
    if (inBoxOrExpert && card.querySelector('.tp-action-dealer')) {
      defects.push({ type: 'action_dealer_in_overlay', card: i });
    }
    if (card.querySelectorAll('.tp-alarm-cog').length > 1) {
      defects.push({ type: 'duplicate_alarm_cog', card: i });
    }

    // 3. No silent truncation on dealer name
    for (const dn of card.querySelectorAll('.tp-dealer-name')) {
      if (dn.clientWidth > 0 && dn.textContent.includes('BRACK.CH AG')) {
        if (dn.clientWidth < 60 || dn.scrollWidth > dn.clientWidth + 2) {
          defects.push({ type: 'dealer_truncated', card: i, cw: dn.clientWidth, sw: dn.scrollWidth });
        }
      }
    }

    // 4. Containment within card bounds
    const tpEls = Array.from(card.querySelectorAll('.tp-review-search-btn, .tp-share-btn, .tp-card-subline-row, .tp-card-dealer-row, .tp-deal-pill, .tp-card-alarm-group'));
    for (const el of tpEls) {
      const er = el.getBoundingClientRect();
      if (er.width === 0 || er.height === 0) continue;
      if (er.left < cr.left - 1.5 || er.right > cr.right + 1.5 || er.top < cr.top - 1.5 || er.bottom > cr.bottom + 1.5) {
        defects.push({ type: 'tp_el_outside_card', card: i, cls: el.className });
      }
    }

    // 5. Pairwise overlap checks
    const getRect = (sel) => {
      const el = card.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const pairs = [
      ['.tp-review-search-btn', '.image'],
      ['.tp-review-search-btn', '.action'],
      ['.tp-review-search-btn', '.badge-dif'],
      ['.tp-review-search-btn', '.Plugin_ProductAverageRating'],
      ['.tp-share-btn', '.tp-card-subline-row'],
      ['.tp-share-btn', '.Plugin_Price'],
      ['.tp-card-dealer-row', '.Plugin_Price'],
      ['.tp-card-dealer-row', '.tp-deal-pill'],
      ['.tp-card-dealer-row', '.action'],
      ['.tp-card-subline-row', '.Plugin_Price'],
      ['.tp-card-subline-row', '.shippingText'],
    ];
    for (const [s1, s2] of pairs) {
      if (rectsOverlap(getRect(s1), getRect(s2))) {
        defects.push({ type: `overlap:${s1}+${s2}`, card: i });
      }
    }

    // 6. Desktop hit targets (>= 24x24px) on first hovered card
    if (vw >= 1280 && i === 0) {
      for (const btn of card.querySelectorAll('.tp-review-search-btn, .tp-share-btn')) {
        const br = btn.getBoundingClientRect();
        if (br.width > 0 && (br.width < 24 || br.height < 24)) {
          defects.push({ type: 'small_hit_target', cls: btn.className, w: br.width, h: br.height });
        }
      }
    }
  }

  // 7. Non-vacuous decorator presence check on deal state
  if (layout !== 'detail' && state === 'deal') {
    const required = ['.tp-card-dealer-row', '.tp-card-subline-row', '.tp-review-search-btn'];
    if (layout === 'neue') required.push('.tp-share-btn');
    if (vw > 360) required.push('.tp-sparkline-container');
    for (const sel of required) {
      const hasVisible = cards.some((card) => {
        const el = card.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!hasVisible) {
        defects.push({ type: 'missing_visible_decorator', sel });
      }
    }
  }
  return defects;
}"""


@pytest.mark.parametrize("layout,fixture_path", LAYOUT_FIXTURES, ids=[f[0] for f in LAYOUT_FIXTURES])
@pytest.mark.parametrize("vw,vh", VIEWPORTS, ids=[f"{w}x{h}" for w, h in VIEWPORTS])
def test_layout_geometry_and_contract_matrix(browser, userscript_content, layout, fixture_path, vw, vh):
    assert fixture_path.exists(), f"Missing fixture: {fixture_path}"
    ctx = browser.new_context(viewport={"width": vw, "height": vh})
    ctx.route("**/*", lambda r: r.abort() if r.request.url.startswith(("http://", "https://")) else r.continue_())
    page = ctx.new_page()
    page.on("pageerror", lambda err: pytest.fail(f"Unhandled exception: {err}"))
    try:
        page.goto(fixture_path.as_uri(), wait_until="domcontentloaded")
        native_overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")

        page.evaluate(SEED_STATE_JS, {"state": "deal"})
        page.evaluate(userscript_content)

        for state in ("deal", "markup"):
            if state != "deal":
                page.evaluate(SEED_STATE_JS, {"state": state})
            page.evaluate("() => window.ToppreiseSuite?.processListings?.()")
            page.wait_for_timeout(150)

            first_card = page.locator(".Plugin_Product").first
            if first_card.count() > 0:
                try:
                    first_card.hover(timeout=1000)
                except Exception:
                    pass

            defects = page.evaluate(AUDIT_MATRIX_JS, {"layout": layout, "state": state, "vw": vw, "nativeOverflow": native_overflow})
            assert not defects, f"[{layout} {vw}x{vh} state={state}] Layout defects: {defects}"

        # Idempotency check: second processListings() pass preserves counts
        before_counts = page.evaluate("() => ({ pills: document.querySelectorAll('.tp-deal-pill').length, dealers: document.querySelectorAll('.tp-card-dealer-row').length })")
        page.evaluate("() => window.ToppreiseSuite?.processListings?.()")
        after_counts = page.evaluate("() => ({ pills: document.querySelectorAll('.tp-deal-pill').length, dealers: document.querySelectorAll('.tp-card-dealer-row').length })")
        assert before_counts == after_counts, f"[{layout} {vw}x{vh}] Idempotency failed: {before_counts} != {after_counts}"
    finally:
        ctx.close()
