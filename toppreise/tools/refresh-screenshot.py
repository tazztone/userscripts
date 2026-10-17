"""Render the offline annotated screenshot gallery from vendored snapshots.

Usage (repo root, no display needed): toppreise/tools/refresh-screenshot.sh

Headless and offline: serves toppreise/tools/snapshots/ over loopback,
injects the current bundle, seeds deterministic histories (frozen clock),
captures 4 bounding-box-driven crops into toppreise/docs/shots/*.webp.
Snapshots come from capture-snapshots.py (headed, run once per site change);
a missing snapshot dir fails with a pointer to it.
"""

import argparse
import base64
from datetime import datetime, timezone
import functools
import html
import io
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(os.path.dirname(BASE_DIR), "toppreise.user.js")
SNAP_DIR = os.path.join(BASE_DIR, "snapshots")
OUT_DIR = os.path.join(os.path.dirname(BASE_DIR), "docs", "shots")
FROZEN_NOW = 1760000000000
VIEWPORT = {"width": 1440, "height": 900}
DSF = 2

LEGEND_HTML = (
    '<div class="PriceChartLegend">'
    '<div class="col-4"><div class="title">Tiefstpreis</div>'
    '<div class="Plugin_Price">1800.00</div></div>'
    '<div class="col-4"><div class="title">Höchstpreis</div>'
    '<div class="Plugin_Price">2600.00</div></div></div>'
)

# Test seed shapes (conftest + test_catalog_layout), calibrated to each
# card's live price: absolute test values only fit the mock's prices.
PRICE_JS = """(pids) => Object.fromEntries(pids.map(pid => {
    const a = document.querySelector(`a[href*="-p${pid}"]`);
    const parse = (t) => {
        const m = (t || "").match(/CHF\\s*([0-9'’.,]+)/);
        if (!m) return 0;
        let s = m[1].replace(/['’\\s]/g, "");
        if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
        return parseFloat(s) || 0;
    };
    let v = parse(a?.textContent);
    if (!v) v = parse(a?.closest(".f_collection")?.textContent);
    if (!v) v = parse(a?.parentElement?.textContent);
    return [pid, v];
}))"""


def seed_stats(role, price):
    p = round(price, 2)
    if role == "deep":
        return {"tiefstpreis": p, "hoechstpreis": round(p * 1.4, 2),
                "medianPrice": round(p * 2, 2),
                "timeSeries": [round(p * (2 - i * 0.03), 2) for i in range(30)]}
    if role == "markup":
        return {"tiefstpreis": round(p * 0.5, 2), "hoechstpreis": round(p * 0.6, 2),
                "medianPrice": round(p * 0.55, 2), "isNewAllTimeLow": False}
    if role == "fallback":
        return {"tiefstpreis": p, "previousLow": round(p * 1.15, 2),
                "dataPointCount": 3}
    raise ValueError(f"unknown seed role {role}")


def seed_roles(page, pid_roles, config):
    prices = page.evaluate(PRICE_JS, [pid for pid, _ in pid_roles])
    entries = {}
    for pid, role in pid_roles:
        assert prices.get(pid, 0) > 0, f"no card price for {pid}"
        entries[pid] = seed_stats(role, prices[pid])
    page.evaluate(SEED_JS, [entries, config])

SEED_JS = """([entries, config]) => {
  localStorage.clear();
  if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.clear();
  for (const [pid, stats] of Object.entries(entries)) {
    stats.time = Date.now();
    localStorage.setItem('tp_hist_v1_' + pid, JSON.stringify(stats));
    if (window.ToppreiseSuite?.memoryCache) window.ToppreiseSuite.memoryCache.set(pid, stats);
  }
  Object.assign(window.ToppreiseSuite.CONFIG, config);
  window.ToppreiseSuite.processListings();
}"""


def ascii_only(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def body_font(size):
    try:
        out = subprocess.run(["fc-match", "--format=%{file}", "DejaVu Sans:bold"],
                             capture_output=True, text=True, timeout=10)
        path = (out.stdout or "").strip()
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve_snapshots():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0),
        functools.partial(QuietHandler, directory=SNAP_DIR))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def stub_pricechart(page):
    page.route("**/plugins/product/pricechart*",
               lambda route: route.fulfill(status=200, content_type="text/html",
                                           body=LEGEND_HTML))


def open_snapshot(browser, base, name, roles, config=None, viewport=None):
    for need in ("index.html", "manifest.json"):
        path = os.path.join(SNAP_DIR, name, need)
        if not os.path.exists(path):
            raise SystemExit(f"snapshots/{name}/{need} not found — "
                             "run capture-snapshots.py headed first")
    with open(os.path.join(SNAP_DIR, name, "manifest.json"), encoding="utf-8") as f:
        manifest = f.read()
    ctx = browser.new_context(viewport=viewport or VIEWPORT, device_scale_factor=DSF)
    page = ctx.new_page()
    page.add_init_script(f"Date.now = () => {FROZEN_NOW}")
    stub_pricechart(page)
    page.goto(f"{base}/{name}/index.html")
    with open(BUNDLE_PATH, encoding="utf-8") as f:
        page.add_script_tag(content=f.read())
    page.wait_for_selector("#tp-root >> #tp-settings-fab", timeout=30000)
    pids = __import__("json").loads(manifest)["pids"]
    seed_roles(page, [(pids[i], role) for i, role in enumerate(roles)], config or {})
    page.wait_for_timeout(800)
    return page, pids


def css_box(page, selector):
    box = page.locator(selector).first.bounding_box()
    assert box, f"no bounding box for {selector}"
    return box


def try_box(page, selector):
    try:
        return page.locator(selector).first.bounding_box(timeout=2000)
    except Exception:
        return None


def union(boxes, pad=24):
    x0 = min(b["x"] for b in boxes) - pad
    y0 = min(b["y"] for b in boxes) - pad
    x1 = max(b["x"] + b["width"] for b in boxes) + pad
    y1 = max(b["y"] + b["height"] for b in boxes) + pad
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def render_annotated(annotator_page, raw_bytes, origin, callouts, out_path):
    """Render numbered callout discs + HTML footer over raw_bytes using browser layout."""
    img_raw = Image.open(io.BytesIO(raw_bytes))
    css_w = round(img_raw.width / DSF)
    css_h = round(img_raw.height / DSF)
    b64_data = base64.b64encode(raw_bytes).decode("ascii")

    badges_html = []
    footer_items = []
    for num, box, caption in callouts:
        cx = round(box["x"] - origin["x"])
        cy = round(box["y"] - origin["y"])
        badges_html.append(
            f'<div class="tp-shot-badge" style="left: {cx}px; top: {cy}px;">{num}</div>'
        )
        escaped_cap = html.escape(caption)
        footer_items.append(
            f'<li><span class="tp-shot-num">{num}.</span><span class="tp-shot-text">{escaped_cap}</span></li>'
        )

    template = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
  #tp-shot-wrap {{ display: inline-block; background: #0f172a; line-height: 0; }}
  .tp-shot-canvas {{ position: relative; width: {css_w}px; height: {css_h}px; }}
  .tp-shot-canvas > img {{ display: block; width: {css_w}px; height: {css_h}px; }}
  .tp-shot-badge {{
    position: absolute;
    transform: translate(-50%, -50%);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #b91c1c;
    color: #ffffff;
    border: 2px solid #ffffff;
    font-size: 13px;
    font-weight: 700;
    line-height: 22px;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    z-index: 100;
    pointer-events: none;
  }}
  .tp-shot-footer {{
    background: #0f172a;
    color: #f8fafc;
    padding: 18px 22px;
    line-height: 1.45;
  }}
  .tp-shot-footer ol {{
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .tp-shot-footer li {{
    font-size: 13.5px;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }}
  .tp-shot-num {{
    color: #f87171;
    font-weight: 700;
    min-width: 22px;
  }}
  .tp-shot-text {{
    color: #e2e8f0;
  }}
</style>
</head>
<body>
<div id="tp-shot-wrap">
  <div class="tp-shot-canvas">
    <img src="data:image/png;base64,{b64_data}">
    {''.join(badges_html)}
  </div>
  <div class="tp-shot-footer">
    <ol>
      {''.join(footer_items)}
    </ol>
  </div>
</div>
</body>
</html>"""

    annotator_page.set_content(template)
    container = annotator_page.locator("#tp-shot-wrap")
    annotated_png = container.screenshot()
    img = Image.open(io.BytesIO(annotated_png))
    img.save(out_path, "WEBP", quality=90, method=6)
    print(f"{out_path}: {len(callouts)} callouts")


def setup_toolbar(page, pids):
    page.evaluate("window.scrollTo(0, 0)")
    page.locator("#tp-bar-calc-btn").click()
    page.wait_for_selector("#tp-bar-calc-popover.tp-show", timeout=10000)
    page.evaluate("""() => {
        document.getElementById('tp-bar-filter-popover')?.classList.add('tp-show');
        const minRow = document.querySelector('[data-filter-row="min"]');
        if (minRow) minRow.style.display = 'flex';
    }""")
    page.wait_for_timeout(400)
    raw_bytes = page.screenshot()
    controls = [
        ("#tp-bar-filter-btn", "Filter-Button (Verbergen oder Dimmen je Ursache)"),
        ("#tp-inline-negative-input", "Negativ-Filter (Text, Wortgrenzen)"),
        ("#tp-bar-min-offers-group", "Min-Angebote stepper"),
        ("[data-filter-row='unchecked']", "Nur geprüfte (ohne verifizierten Tiefstpreis)"),
        ("[data-filter-row='vortief']", "Fallback-Tiefs ein-/ausschließen"),
        ("#tp-bar-heat-btn", "Heatmap toggle (Farbe = Badge-%)"),
        ("#tp-bar-bestpreise-btn", "Neue-Tiefstpreise-Modus (Feed)"),
        ("#tp-bar-calc-btn", "Berechnungsparameter-Popover (filtert nichts)"),
        ("#tp-bar-weight-wrapper", "Gewichtung Median/Rekord (Slider)"),
        ("#tp-bar-horizon-wrapper", "Ø-Zeitraum Slider (Median-Horizont)"),
        ("#tp-bar-minpoints-wrapper", "Mindestpunkte Slider (dünne Historie → Fallback)"),
        ("#tp-floating-check-cta", "Tiefstpreise prüfen CTA (Batch-Check, floating)"),
    ]
    callouts = []
    for sel, cap in controls:
        box = try_box(page, sel)
        if box is None:
            print(f"skip callout: {sel}")
            continue
        callouts.append((len(callouts) + 1, box, cap))
    return raw_bytes, {"x": 0, "y": 0}, callouts, "01-toolbar.webp"


def setup_feed_cards(page, pids):
    if page.locator("#tp-bar-calc-popover.tp-show").count() > 0:
        page.locator("#tp-bar-calc-btn").click()
        page.wait_for_selector("#tp-bar-calc-popover.tp-show", state="hidden", timeout=10000)
    anchors = [f'a[href*="-p{pid}"]' for pid in pids[:3]]
    deep, markup, fallback = anchors

    # Prepend dealer badge on deep deal card for demonstration
    page.evaluate(r'''([pid, deepSel]) => {
        const card = document.querySelector(deepSel);
        if (!card) return;
        const d = document.createElement('a');
        d.className = 'tp-dealer-name';
        d.textContent = '🏬 Digitec';
        d.href = 'https://www.toppreise.ch';
        const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
        priceInfo.insertBefore(d, priceInfo.firstChild);
    }''', [pids[0], deep])

    # Hover on deep card to display the Discord 1-Click Share button
    card0 = page.locator(deep).first
    card0.hover()
    page.wait_for_timeout(400)
    assert page.locator(f"{deep} > .tp-share-btn").count() > 0, "share button missing on deep deal"
    assert page.locator(".tp-is-verified").count() > 0, "no verified deal rendered"

    boxes = [css_box(page, sel) for sel in anchors]
    clip = union(boxes, pad=16)
    raw_bytes = page.screenshot(clip=clip)

    callouts = [
        (1, css_box(page, f"{deep} .badge-dif"), "Heat-Ribbon -XX% = Gewichtete Differenz (tiefrot = Tiefstpreis)"),
        (2, css_box(page, f"{markup} .badge-dif"), "+XX% Aufschlag-Morph (Schein-Rabatt durchgestrichen)"),
        (3, css_box(page, f"{fallback} .badge-dif"), "Fallback-Tief: Vortief-Abstand, Glow von außen"),
        (4, css_box(page, f"{deep} > .tp-share-btn"), "Discord 1-Klick Share-Button (Hover)"),
        (5, css_box(page, f"{deep} .tp-card-subline-row"), "Subline: CHF + % verankern beide Beine"),
        (6, css_box(page, f"{deep} .tp-dealer-name"), "Günstigster Händler (direkt zum Angebot)"),
        (7, css_box(page, f"{deep} .tp-sparkline-container"), "Mini-Trend Sparkline (Klick = Preisverlauf)"),
    ]
    return raw_bytes, {"x": clip["x"], "y": clip["y"]}, callouts, "02-feed-cards.webp"


def setup_search_cards(page, pids):
    block = page.locator(".Plugin_ProductCollItem").first
    block.scroll_into_view_if_needed()
    # Seed the pids actually inside this block: suite keys cards by their own
    # href rule, so manifest-global pids may miss.
    block_pids = block.evaluate(r"""el => {
        const out = [], seen = new Set();
        for (const a of el.querySelectorAll('a[href]')) {
            const m = (a.getAttribute('href') || '').match(/-p(\d+)/i);
            if (m && !seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
        }
        return out.slice(0, 4);
    }""")
    assert block_pids, "no pids in first CollItem"
    seed_roles(page, [(block_pids[0], "deep")], {})
    page.wait_for_timeout(800)
    deal = ".Plugin_ProductCollItem .tp-deal-pill.tp-is-verified"
    unchecked = ".Plugin_ProductCollItem .tp-deal-pill:not(.tp-is-verified)"
    assert page.locator(deal).count() > 0, "no verified pill rendered"
    assert page.locator(unchecked).count() > 0, "no unchecked pill left"
    page.locator(deal).first.hover()
    page.wait_for_timeout(400)
    assert page.locator(".tp-share-btn").count() > 0, "hover share button missing"
    raw_bytes = block.screenshot()
    origin = block.bounding_box()
    callouts = [
        (1, css_box(page, deal), "Inline-Pill: 1-zeilig über dem Preisblock"),
        (2, css_box(page, unchecked), "Prüfen-Pill: ungeprüft, gestreift, nie Heat-Farbe"),
    ]
    if page.locator(".Plugin_ProductCollItem :text('nstigste Variante')").count() > 0:
        callouts.append((3, css_box(page, ".Plugin_ProductCollItem :text('nstigste Variante')"),
                         "Günstigste-Variante Label bleibt nativ positioniert"))
    return raw_bytes, origin, callouts, "03-search-cards.webp"


def setup_settings(page, pids):
    page.locator("#tp-root >> #tp-settings-fab").click()
    dlg = "#tp-root >> #tp-settings-dialog"
    page.wait_for_selector(dlg, state="visible", timeout=10000)
    page.wait_for_timeout(400)
    dlg_loc = page.locator(dlg)
    raw_bytes = dlg_loc.screenshot()
    origin = dlg_loc.bounding_box()
    headers = page.locator(f"{dlg} >> section[id^='tp-section-'] .tp-section-header")
    callouts = [(i + 1, headers.nth(i).bounding_box(), f"Abschnitt: {headers.nth(i).inner_text()}")
                for i in range(headers.count())]
    assert callouts, "no settings sections found"
    return raw_bytes, origin, callouts, "04-settings-modal.webp"


SCENES = {
    "toolbar": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 720, "height": 900},
        "setup": setup_toolbar,
    },
    "feed": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": False,
            "HEATMAP_ACTIVE": True,
        },
        "viewport": {"width": 1440, "height": 900},
        "setup": setup_feed_cards,
    },
    "settings": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 1440, "height": 2700},
        "setup": setup_settings,
    },
    "search": {
        "snapshot": "search",
        "roles": [],
        "config": {},
        "viewport": {"width": 1440, "height": 900},
        "setup": setup_search_cards,
    },
}


def parse_args():
    parser = argparse.ArgumentParser(description="Render or validate offline annotated screenshots.")
    parser.add_argument("scenes", nargs="*", default=["all"],
                        help=f"Scenes to run: {', '.join(SCENES.keys())} or 'all'")
    parser.add_argument("--check", action="store_true",
                        help="Validate selectors and assertions without writing images")
    parser.add_argument("--list", action="store_true",
                        help="List all available scenes")
    return parser.parse_args()


def generate_gallery_html(out_dir, items):
    """Generate docs/shots/index.html to review rendered scenes side-by-side with callouts."""
    cards_html = []
    for it in items:
        cap_rows = "".join(
            f"<tr><td class='num'>{num}</td><td class='cap'>{html.escape(cap)}</td></tr>"
            for num, _box, cap in it["callouts"]
        )
        cards_html.append(f"""
        <section class="gallery-card">
          <div class="card-header">
            <h2>{html.escape(it['name'])} <span class="tag">{html.escape(it['file'])}</span></h2>
            <span class="meta">Snapshot: <strong>{html.escape(it['snapshot'])}</strong> · {len(it['callouts'])} Callouts</span>
          </div>
          <div class="card-body">
            <div class="image-wrap">
              <a href="{it['file']}" target="_blank" title="Klick für Vollbild">
                <img src="{it['file']}" alt="{html.escape(it['name'])}" loading="lazy">
              </a>
            </div>
            <div class="legend-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Element / Beschreibung</th></tr>
                </thead>
                <tbody>
                  {cap_rows}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        """)

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    doc = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toppreise.ch Suite — Screenshot Gallery</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    padding: 24px;
    background: #090d16;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
  }}
  header {{
    max-width: 1400px;
    margin: 0 auto 32px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 12px;
  }}
  h1 {{ margin: 0; font-size: 24px; color: #f8fafc; font-weight: 700; }}
  .timestamp {{ color: #64748b; font-size: 13px; }}
  .gallery-grid {{
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }}
  .gallery-card {{
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }}
  .card-header {{
    background: #131d35;
    padding: 14px 20px;
    border-bottom: 1px solid #1e293b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }}
  .card-header h2 {{
    margin: 0;
    font-size: 17px;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .tag {{
    font-size: 12px;
    font-family: monospace;
    background: #1e293b;
    color: #38bdf8;
    padding: 2px 8px;
    border-radius: 6px;
  }}
  .meta {{ font-size: 13px; color: #94a3b8; }}
  .card-body {{
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
    gap: 20px;
    padding: 20px;
    align-items: start;
  }}
  @media (max-width: 900px) {{
    .card-body {{ grid-template-columns: 1fr; }}
  }}
  .image-wrap {{
    background: #0b0f19;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #1e293b;
  }}
  .image-wrap img {{
    display: block;
    width: 100%;
    height: auto;
  }}
  .legend-wrap table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }}
  .legend-wrap th {{
    text-align: left;
    padding: 8px 12px;
    background: #131d35;
    color: #94a3b8;
    border-bottom: 1px solid #1e293b;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }}
  .legend-wrap td {{
    padding: 8px 12px;
    border-bottom: 1px solid #1e293b;
    vertical-align: top;
  }}
  .legend-wrap td.num {{
    width: 32px;
    color: #ef4444;
    font-weight: 700;
  }}
  .legend-wrap td.cap {{
    color: #e2e8f0;
  }}
  .legend-wrap tr:last-child td {{
    border-bottom: none;
  }}
</style>
</head>
<body>
<header>
  <h1>Toppreise.ch Suite — Screenshot Gallery</h1>
  <div class="timestamp">Generiert: {now_iso}</div>
</header>
<main class="gallery-grid">
  {''.join(cards_html)}
</main>
</body>
</html>"""
    path = os.path.join(out_dir, "index.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"Gallery viewer written to {path}")


def main():
    args = parse_args()
    if args.list:
        print("Available scenes:")
        for name, spec in SCENES.items():
            print(f"  - {name} (snapshot: {spec['snapshot']})")
        return 0

    target_names = list(SCENES.keys()) if "all" in args.scenes else args.scenes
    for name in target_names:
        if name not in SCENES:
            raise SystemExit(f"Unknown scene '{name}'. Available: {list(SCENES.keys())} or 'all'")

    os.makedirs(OUT_DIR, exist_ok=True)
    server = serve_snapshots()
    base = f"http://127.0.0.1:{server.server_port}"
    executed_items = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                annotator_page = None
                annotator_ctx = None
                if not args.check:
                    annotator_ctx = browser.new_context(viewport={"width": 1920, "height": 3000}, device_scale_factor=DSF)
                    annotator_page = annotator_ctx.new_page()

                for name in target_names:
                    spec = SCENES[name]
                    page, pids = open_snapshot(
                        browser, base, spec["snapshot"], spec["roles"],
                        config=spec["config"], viewport=spec.get("viewport")
                    )
                    try:
                        raw_bytes, origin, callouts, out_file = spec["setup"](page, pids)
                        if args.check:
                            print(f"[check] OK '{name}': {len(callouts)} callouts resolved ({out_file})")
                        else:
                            render_annotated(annotator_page, raw_bytes, origin, callouts, os.path.join(OUT_DIR, out_file))
                            executed_items.append({
                                "name": name,
                                "file": out_file,
                                "callouts": callouts,
                                "snapshot": spec["snapshot"],
                            })
                    finally:
                        page.context.close()

                if annotator_ctx:
                    annotator_ctx.close()
            finally:
                browser.close()
    finally:
        server.shutdown()

    if not args.check:
        if executed_items:
            generate_gallery_html(OUT_DIR, executed_items)
        print(f"Gallery written to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
