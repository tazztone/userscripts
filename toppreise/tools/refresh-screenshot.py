"""Render the offline annotated screenshot gallery from vendored snapshots.

Usage (repo root, no display needed): toppreise/tools/refresh-screenshot.sh

Headless and offline: serves toppreise/tools/snapshots/ over loopback,
injects the current bundle, seeds deterministic histories (frozen clock),
captures 4 bounding-box-driven crops into toppreise/docs/shots/*.webp.
Snapshots come from capture-snapshots.py (headed, run once per site change);
a missing snapshot dir fails with a pointer to it.
"""

import functools
import os
import subprocess
import sys
import threading
import unicodedata
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageDraw, ImageFont
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


def annotate(raw_path, origin, callouts, out_path, crop=None):
    """Numbered discs at callout boxes + ASCII footer strip. Boxes/origin/crop in CSS px."""
    img = Image.open(raw_path).convert("RGB")
    if crop:
        x0 = max(int(crop["x"] * DSF), 0)
        y0 = max(int(crop["y"] * DSF), 0)
        x1 = min(int((crop["x"] + crop["width"]) * DSF), img.width)
        y1 = min(int((crop["y"] + crop["height"]) * DSF), img.height)
        img = img.crop((x0, y0, x1, y1))
        origin = {"x": x0 / DSF, "y": y0 / DSF}
    draw = ImageDraw.Draw(img)
    num_font, cap_font = body_font(30), body_font(28)
    for num, box, _caption in callouts:
        cx = int((box["x"] - origin["x"]) * DSF)
        cy = int((box["y"] - origin["y"]) * DSF)
        cx = min(max(cx, 30), img.width - 30)
        cy = min(max(cy, 30), img.height - 30)
        draw.ellipse([cx - 26, cy - 26, cx + 26, cy + 26],
                     fill="#b91c1c", outline="white", width=3)
        label = str(num)
        l, t, r, b = draw.textbbox((0, 0), label, font=num_font)
        draw.text((cx - (r - l) / 2 - l, cy - (b - t) / 2 - t), label,
                  font=num_font, fill="white")
    lines = [f"{num}. {' '.join(ascii_only(cap).split())}" for num, _box, cap in callouts]
    wrapped, max_w = [], img.width - 40
    for line in lines:
        while draw.textlength(line, font=cap_font) > max_w and " " in line:
            cut = line[:int(len(line) * max_w / draw.textlength(line, font=cap_font))].rsplit(" ", 1)[0]
            wrapped.append(cut)
            line = "  " + line[len(cut):].lstrip()
        wrapped.append(line)
    strip_h = len(wrapped) * 44 + 40
    footer = Image.new("RGB", (img.width, strip_h), "#0f172a")
    fd = ImageDraw.Draw(footer)
    for i, line in enumerate(wrapped):
        fd.text((20, 20 + i * 44), line, font=cap_font, fill="white")
    out = Image.new("RGB", (img.width, img.height + strip_h))
    out.paste(img, (0, 0))
    out.paste(footer, (0, img.height))
    out.save(out_path, "WEBP", quality=90, method=6)
    print(f"{out_path}: {len(callouts)} callouts")


def scene_toolbar(page):
    page.evaluate("window.scrollTo(0, 0)")
    page.locator("#tp-bar-calc-btn").click()
    page.wait_for_selector("#tp-bar-calc-popover.tp-show", timeout=10000)
    # Click handlers keep the popovers exclusive; force both open so one
    # shot covers every callout (calc left via click, filter via class).
    page.evaluate("""() => {
        document.getElementById('tp-bar-filter-popover')?.classList.add('tp-show');
        const minRow = document.querySelector('[data-filter-row="min"]');
        if (minRow) minRow.style.display = 'flex';
    }""")
    page.wait_for_timeout(400)
    raw = os.path.join(OUT_DIR, ".raw-toolbar.png")
    page.screenshot(path=raw)
    controls = [
        ("#tp-bar-filter-btn", "Filter-Button (Verbergen oder Dimmen je Ursache)"),
        ("#tp-inline-negative-input", "Negativ-Filter (Text, Wortgrenzen)"),
        ("#tp-bar-min-offers-group", "Min-Angebote stepper"),
        ("[data-filter-row='unchecked']", "Nur gepruefte (ohne verifizierten Tiefstpreis)"),
        ("[data-filter-row='vortief']", "Fallback-Tiefs ein-/ausschliessen"),
        ("#tp-bar-heat-btn", "Heatmap toggle (Farbe = Badge-%)"),
        ("#tp-bar-bestpreise-btn", "Neue-Tiefstpreise-Modus (Feed)"),
        ("#tp-bar-calc-btn", "Berechnungsparameter-Popover (filtert nichts)"),
        ("#tp-bar-weight-wrapper", "Gewichtung Median/Rekord (Slider)"),
        ("#tp-bar-horizon-wrapper", "O-Zeitraum Slider (Median-Horizont)"),
        ("#tp-bar-minpoints-wrapper", "Mindestpunkte Slider (duenne Historie -> Fallback)"),
        ("#tp-floating-check-cta", "Tiefstpreise-pruefen CTA (Batch-Check, floating)"),
    ]
    callouts = []
    for sel, cap in controls:
        box = try_box(page, sel)
        if box is None:
            print(f"skip callout: {sel}")
            continue
        callouts.append((len(callouts) + 1, box, cap))
    annotate(raw, {"x": 0, "y": 0}, callouts, os.path.join(OUT_DIR, "01-toolbar.webp"))
    os.unlink(raw)


def scene_feed_cards(page, pids):
    if page.locator("#tp-bar-calc-popover.tp-show").count() > 0:
        page.locator("#tp-bar-calc-btn").click()
        page.wait_for_selector("#tp-bar-calc-popover.tp-show", state="hidden", timeout=10000)
    anchors = [f'a[href*="-p{pid}"]' for pid in pids[:3]]
    boxes = [css_box(page, sel) for sel in anchors]
    badge = page.locator(f"{anchors[1]} .badge-dif").first
    badge.hover()
    page.wait_for_timeout(400)
    assert page.locator(".tp-share-btn").count() > 0, "share button missing"
    assert page.locator(".tp-is-verified").count() > 0, "no verified deal rendered"
    clip = union(boxes)
    raw = os.path.join(OUT_DIR, ".raw-feed.png")
    page.screenshot(path=raw, full_page=True)
    deep, markup, fallback = anchors
    callouts = [
        (1, css_box(page, f"{deep} .badge-dif"), "Heat-Ribbon -XX% = Gewichtete Differenz (tiefrot = Tiefstpreis)"),
        (2, css_box(page, f"{markup} .badge-dif"), "+XX% Aufschlag-Morph (Schein-Rabatt durchgestrichen)"),
        (3, css_box(page, f"{fallback} .badge-dif"), "Fallback-Tief: Vortief-Abstand, Glow von aussen"),
        (4, boxes[1], "Share-Button (Hover) + nativer title-Tooltip (nicht abbildbar)"),
    ]
    extra = [(f"{deep} .tp-card-subline-row", "Subline: CHF + % verankern beide Beine"),
             (f"{deep} .tp-dealer-name", "Guenstigster Haendler (direkt zum Angebot)"),
             (f"{deep} .tp-sparkline-container", "Sparkline (Klick = Preisverlauf)")]
    for sel, cap in extra:
        if page.locator(sel).count() > 0:
            callouts.append((len(callouts) + 1, css_box(page, sel), cap))
    annotate(raw, {"x": 0, "y": 0}, callouts, os.path.join(OUT_DIR, "02-feed-cards.webp"), crop=clip)
    os.unlink(raw)


def scene_search_cards(page, pids):
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
    raw = os.path.join(OUT_DIR, ".raw-search.png")
    block.screenshot(path=raw)
    origin = block.bounding_box()
    callouts = [
        (1, css_box(page, deal), "Inline-Pill: 1-zeilig ueber dem Preisblock"),
        (2, css_box(page, unchecked), "Pruefen-Pill: ungeprueft, gestreift, nie Heat-Farbe"),
    ]
    if page.locator(".Plugin_ProductCollItem :text('nstigste Variante')").count() > 0:
        callouts.append((3, css_box(page, ".Plugin_ProductCollItem :text('nstigste Variante')"),
                         "Guenstigste-Variante Label bleibt nativ positioniert"))
    annotate(raw, origin, callouts, os.path.join(OUT_DIR, "03-search-cards.webp"))
    os.unlink(raw)


def scene_settings(page):
    page.locator("#tp-root >> #tp-settings-fab").click()
    dlg = "#tp-root >> #tp-settings-dialog"
    page.wait_for_selector(dlg, state="visible", timeout=10000)
    page.wait_for_timeout(400)
    raw = os.path.join(OUT_DIR, ".raw-settings.png")
    page.locator(dlg).screenshot(path=raw)
    origin = page.locator(dlg).bounding_box()
    headers = page.locator(f"{dlg} >> section[id^='tp-section-'] .tp-section-header")
    callouts = [(i + 1, headers.nth(i).bounding_box(), f"Abschnitt: {headers.nth(i).inner_text()}")
                for i in range(headers.count())]
    assert callouts, "no settings sections found"
    annotate(raw, origin, callouts, os.path.join(OUT_DIR, "04-settings-modal.webp"))
    os.unlink(raw)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    server = serve_snapshots()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                # Toolbar scene runs narrow (720px, half width) to pin the
                # wrapped/responsive site layout; cards keep full width.
                narrow, _ = open_snapshot(
                    browser, base, "feed", ["deep", "markup", "fallback"],
                    {"BESTPREISE_MODE_ACTIVE": True, "BESTPREISE_WEIGHT_RECORD": 0.50,
                     "BESTPREISE_HIDE_UNCHECKED": True},
                    viewport={"width": 720, "height": 900})
                try:
                    scene_toolbar(narrow)
                finally:
                    narrow.context.close()
                feed, feed_pids = open_snapshot(
                    browser, base, "feed", ["deep", "markup", "fallback"],
                    {"BESTPREISE_MODE_ACTIVE": True, "BESTPREISE_WEIGHT_RECORD": 0.50,
                     "BESTPREISE_HIDE_UNCHECKED": True})
                try:
                    scene_feed_cards(feed, feed_pids)
                finally:
                    feed.context.close()
                modal, _ = open_snapshot(
                    browser, base, "feed", ["deep", "markup", "fallback"],
                    {"BESTPREISE_MODE_ACTIVE": True, "BESTPREISE_WEIGHT_RECORD": 0.50,
                     "BESTPREISE_HIDE_UNCHECKED": True},
                    viewport={"width": 1440, "height": 2700})
                try:
                    scene_settings(modal)
                finally:
                    modal.context.close()
                search, search_pids = open_snapshot(browser, base, "search", [])
                try:
                    scene_search_cards(search, search_pids)
                finally:
                    search.context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
    print(f"Gallery written to {OUT_DIR}")


if __name__ == "__main__":
    sys.exit(main())
