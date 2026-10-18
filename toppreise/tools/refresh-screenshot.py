"""Render the offline annotated screenshot gallery from vendored snapshots.

Usage (repo root, no display needed): toppreise/tools/refresh-screenshot.sh

Headless and offline: serves toppreise/tools/snapshots/ over loopback,
injects the current bundle, seeds deterministic histories (frozen clock),
captures 5 bounding-box-driven crops into toppreise/docs/shots/*.webp.
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
import re
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
    now = FROZEN_NOW
    if role == "deep":
        # Deep all-time record low deal (-65% weighted score, deep ruby glow)
        prev_low = round(p * 2.5, 2)
        med_price = round(p * (10 / 3), 2)
        high_price = round(p * 4.15, 2)
        pts = []
        for i in range(15):
            pts.append([now - (30 - i) * 86400000, round(high_price - i * ((high_price - med_price) / 14), 2)])
        for i in range(15):
            pts.append([now - (15 - i) * 86400000, round(med_price - i * ((med_price - prev_low) / 14), 2)])
        return {
            "tiefstpreis": p,
            "previousLow": prev_low,
            "hoechstpreis": high_price,
            "medianPrice": med_price,
            "timeSeries": pts,
            "dataPointCount": 30,
            "isNewAllTimeLow": True,
        }
    if role == "markup":
        # Deceptive markup: price is 100% above historical low, site discount is fake
        return {
            "tiefstpreis": round(p * 0.5, 2),
            "hoechstpreis": round(p * 0.6, 2),
            "medianPrice": round(p * 0.55, 2),
            "isNewAllTimeLow": False,
        }
    if role == "fallback":
        # Sparse history fallback low (< minPoints)
        return {
            "tiefstpreis": p,
            "previousLow": round(p * 1.15, 2),
            "dataPointCount": 3,
        }
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


class StripHandler(SimpleHTTPRequestHandler):
    """Serves vendored snapshots while stripping high-DPI srcset attributes that 404 offline."""

    def log_message(self, *args):
        pass

    def do_GET(self):
        # Route retina/logo requests directly to vendored logo asset
        if "tp_@2x.png" in self.path or "tp.png" in self.path:
            logo_path = os.path.join(SNAP_DIR, "feed", "assets", "fd2db4d7de08.png")
            if os.path.exists(logo_path):
                with open(logo_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        # Strip srcset and data-srcset attributes so Chromium loads local 1x assets
        if self.path.endswith("index.html"):
            path = self.translate_path(self.path)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                content = re.sub(r'\s+srcset="[^"]*"', '', content)
                content = re.sub(r'\s+data-srcset="[^"]*"', '', content)
                data = content.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        super().do_GET()


def serve_snapshots():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0),
        functools.partial(StripHandler, directory=SNAP_DIR))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def stub_pricechart(page):
    page.route("**/plugins/product/pricechart*",
               lambda route: route.fulfill(status=200, content_type="text/html",
                                           body=LEGEND_HTML))
    # Route external ad or image tracking scripts to a clean neutral response
    svg_ph = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">'
        '<rect width="80" height="80" rx="8" fill="#1e293b"/>'
        '<path d="M25 55 L38 38 L48 50 L55 42 L65 55 Z" fill="#475569"/>'
        '<circle cx="35" cy="30" r="4" fill="#64748b"/>'
        '</svg>'
    )
    page.route(
        lambda url: any(x in url for x in ["imgsrv.toppreise.ch", "securepubads", "doubleclick"]),
        lambda route: route.fulfill(status=200, content_type="image/svg+xml", body=svg_ph)
    )


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


def union(boxes, pad=32):
    x0 = min(b["x"] for b in boxes) - pad
    y0 = min(b["y"] for b in boxes) - pad
    x1 = max(b["x"] + b["width"] for b in boxes) + pad
    y1 = max(b["y"] + b["height"] for b in boxes) + pad
    return {"x": max(0, x0), "y": max(0, y0), "width": x1 - x0, "height": y1 - y0}


def render_annotated(annotator_page, raw_bytes, origin, callouts, out_path):
    """Render numbered callout discs + SVG leader lines + HTML footer over raw_bytes."""
    img_raw = Image.open(io.BytesIO(raw_bytes))
    css_w = round(img_raw.width / DSF)
    css_h = round(img_raw.height / DSF)
    b64_data = base64.b64encode(raw_bytes).decode("ascii")

    badges_html = []
    svg_leaders = []
    footer_items = []
    for item in callouts:
        num, box, caption = item[0], item[1], item[2]
        anchor = item[3] if len(item) > 3 else "top-left"

        rel_x = box["x"] - origin["x"]
        rel_y = box["y"] - origin["y"]
        bw = box["width"]
        bh = box["height"]

        is_small = (bw <= 28 and bh <= 28)

        if anchor == "outside-left":
            bx = rel_x - 52
            by = rel_y + bh / 2
            tx = (rel_x + bw / 2) if is_small else (rel_x - 8)
            ty = (rel_y + bh / 2) if is_small else by
        elif anchor == "outside-top":
            bx = rel_x + bw / 2
            by = rel_y - 32
            tx = bx
            ty = (rel_y + bh / 2) if is_small else (rel_y - 6)
        elif anchor == "outside-right":
            bx = rel_x + bw + 52
            by = rel_y + bh / 2
            tx = (rel_x + bw / 2) if is_small else (rel_x + bw + 8)
            ty = (rel_y + bh / 2) if is_small else by
        elif anchor == "outside-bottom":
            bx = rel_x + bw / 2
            by = rel_y + bh + 32
            tx = bx
            ty = (rel_y + bh / 2) if is_small else (rel_y + bh + 6)
        elif anchor == "top-left":
            bx = rel_x - 36
            by = rel_y - 28
            tx = (rel_x + bw / 2) if is_small else (rel_x - 8)
            ty = (rel_y + bh / 2) if is_small else (rel_y - 6)
        elif isinstance(anchor, dict):
            bx = anchor["bx"] if "bx" in anchor else (rel_x + anchor.get("dx", -52))
            by = anchor["by"] if "by" in anchor else ((rel_y + bh / 2) if anchor.get("dy", 0) == 0 else rel_y + anchor["dy"])
            if "tx" in anchor:
                tx = anchor["tx"]
            else:
                if is_small:
                    tx = rel_x + bw / 2
                else:
                    tx = (rel_x - 8) if bx < rel_x else ((rel_x + bw + 8) if bx > rel_x + bw else bx)
            if "ty" in anchor:
                ty = anchor["ty"]
            else:
                if is_small:
                    ty = rel_y + bh / 2
                else:
                    ty = (rel_y - 6) if by < rel_y else ((rel_y + bh + 6) if by > rel_y + bh else by)
        elif isinstance(anchor, (list, tuple)) and len(anchor) == 2:
            dx, dy = anchor
            bx = rel_x + dx
            by = (rel_y + bh / 2) if dy == 0 else (rel_y + dy)
            if is_small:
                tx = rel_x + bw / 2
                ty = rel_y + bh / 2
            else:
                if dx < 0:
                    tx = rel_x - 8
                elif dx > bw:
                    tx = rel_x + bw + 8
                else:
                    tx = rel_x + dx
                if dy < 0:
                    ty = rel_y - 6
                elif dy > bh:
                    ty = rel_y + bh + 6
                else:
                    ty = rel_y + bh / 2 if (dx < 0 or dx > bw) else rel_y + dy
        else:
            bx = rel_x - 36
            by = rel_y - 28
            tx = (rel_x + bw / 2) if is_small else (rel_x - 8)
            ty = (rel_y + bh / 2) if is_small else (rel_y - 6)

        # Clamp badge coordinates so discs never bleed outside the canvas
        bx = max(14, min(css_w - 14, bx))
        by = max(14, min(css_h - 14, by))

        dist = ((bx - tx) ** 2 + (by - ty) ** 2) ** 0.5
        if dist > 4:
            svg_leaders.append(
                f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
                f'stroke="#f97316" stroke-width="1.8" stroke-dasharray="3 3"/>'
                f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="2.5" fill="#f97316"/>'
            )

        badges_html.append(
            f'<div class="tp-shot-badge" style="left: {bx:.1f}px; top: {by:.1f}px;">{num}</div>'
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
  .tp-shot-leaders {{
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 50;
  }}
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
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    z-index: 100;
    pointer-events: none;
  }}
</style>
</head>
<body>
<div id="tp-shot-wrap">
  <div class="tp-shot-canvas">
    <img src="data:image/png;base64,{b64_data}">
    <svg class="tp-shot-leaders" viewBox="0 0 {css_w} {css_h}">
      {''.join(svg_leaders)}
    </svg>
    {''.join(badges_html)}
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
    """Shot 01a: Sticky toolbar filter popover and batch scanner, cleanly focused on filter controls."""
    page.evaluate("window.scrollTo(0, 0)")
    page.evaluate("""() => {
        document.body.style.paddingLeft = '90px';
        document.getElementById('tp-bar-filter-popover')?.classList.add('tp-show');
        // Cleanly hide background cards and host page noise
        document.querySelectorAll('.Plugin_MainTopHead, .Plugin_GeneralBreadcrumb, .breadcrumb, #breadcrumb, .Plugin_TimePeriod, .f_Plugin_Filter_TimePeriod, .filterBoxContainer, .sidebarWrapper, .tpContentSidebar, .sidebar, .Plugin_IgnoredCategoriesHint, .Plugin_Hint, .alert, .mainContent, #pageContent, .mixedBrowsingListProduct, .Plugin_Product, .Plugin_CategoryList, .Plugin_IgnoredCategories, [class*="Breadcrumb"], [class*="Hint"]').forEach(el => el.style.setProperty('display', 'none', 'important'));
        // Hide right-hand toolbar groups so 01a focuses strictly on filter button and popover
        document.querySelectorAll('.tp-group-view, .tp-group-deals, .tp-divider').forEach(el => el.style.setProperty('display', 'none', 'important'));
        // Position floating CTA right below the filter popover with a clean gap
        const cta = document.getElementById('tp-floating-check-cta');
        const pop = document.getElementById('tp-bar-filter-popover');
        if (cta && pop) {
            const popRect = pop.getBoundingClientRect();
            cta.style.setProperty('position', 'absolute', 'important');
            cta.style.setProperty('bottom', 'auto', 'important');
            cta.style.setProperty('top', (popRect.bottom + 24) + 'px', 'important');
            cta.style.setProperty('left', popRect.left + 'px', 'important');
            cta.style.setProperty('right', 'auto', 'important');
            cta.style.setProperty('width', 'max-content', 'important');
            cta.style.setProperty('animation', 'none', 'important');
            cta.style.setProperty('transform', 'none', 'important');
            cta.style.setProperty('transition', 'none', 'important');
        }
    }""")
    page.wait_for_timeout(400)

    btn_box = css_box(page, "#tp-bar-filter-btn")
    pop_box = css_box(page, "#tp-bar-filter-popover")
    cta_box = try_box(page, "#tp-floating-check-btn") or try_box(page, "#tp-floating-check-cta")

    boxes = [btn_box, pop_box]
    if cta_box:
        boxes.append(cta_box)
    clip = union(boxes, pad=80)
    raw_bytes = page.screenshot(clip=clip)
    controls = [
        ("#tp-bar-filter-btn", "Filter-Button (Verbergen, Dimmen oder Hervorheben je Ursache)", {"bx": 32}),
        ("[data-filter-row='neg'] .tp-filter-label", "Negativ-Filter (Ausschluss nach Stichwort mit Wortgrenzen)", {"bx": 32}),
        ("[data-filter-row='min'] .tp-filter-label", "Min-Angebote (Marktplatz-Filter; nur auf Seiten mit Händlerzeilen aktiv)", {"bx": 32}),
        ("[data-filter-row='unchecked'] .tp-filter-label", "Ungeprüfte Angebote (Angebote ohne Historie verbergen/dimmen)", {"bx": 32}),
        ("[data-filter-row='vortief'] .tp-filter-label", "Fallback-Tiefs ein-/ausschliessen (geringe Historie)", {"bx": 32}),
        ("[data-filter-row='deal-disc'] .tp-filter-label", "Min-Rabatt Stepper (Angebote unter X% Rabatt filtern)", {"bx": 32}),
        ("#tp-floating-check-btn", "Tiefstpreise prüfen (1-Klick Batch-Scanner)", {"bx": 32}),
    ]
    callouts = []
    for item in controls:
        sel, cap = item[0], item[1]
        anchor = item[2] if len(item) > 2 else "outside-left"
        box = try_box(page, sel)
        if box is None:
            continue
        callouts.append((len(callouts) + 1, box, cap, anchor))
    return raw_bytes, {"x": clip["x"], "y": clip["y"]}, callouts, "01a-toolbar.webp"


def setup_calc_popover(page, pids):
    """Shot 01b: Calculation popover featuring live glitch preview chart and mathematical parameters."""
    page.evaluate("window.scrollTo(0, 0)")
    page.evaluate("""() => {
        document.body.style.paddingLeft = '90px';
        // Cleanly hide all background page content, tabs, time period and categories
        document.querySelectorAll('.mainContent, .leftColumn, #pageContent, .mainTopHeadContentWrapper, .mixedBrowsingListProduct, .Plugin_Product, .Plugin_IgnoredCategoriesHint, .Plugin_Hint, .alert, .tpContentSidebar, .sidebarWrapper, .sidebar, .Plugin_CategoryList, .Plugin_IgnoredCategories, .Plugin_TimePeriod, .f_Plugin_Filter_TimePeriod, .Plugin_Tab, .f_Plugin_Tab, .Plugin_Sort, .f_Plugin_Sort, .breadcrumb, #breadcrumb, [class*="Breadcrumb"], ul[class*="Tabs"], .Plugin_Tabs, .tabs, .tabWrapper, .Plugin_NavigationTab, .f_Plugin_NavigationTab, .Plugin_CollItemHead, .navigationTab, #feed-tabs, .tabbedContainer, .Plugin_TopProductListNavigation, .contentBox').forEach(el => el.style.setProperty('display', 'none', 'important'));
        // Hide toolbar buttons except calc button so no partial buttons are visible
        document.querySelectorAll('#tp-suite-filter-bar .tp-group:not(.tp-group-deals), #tp-suite-filter-bar .tp-divider, #tp-bar-bestpreise-btn').forEach(el => el.style.setProperty('display', 'none', 'important'));
    }""")
    page.locator("#tp-bar-calc-btn").click()
    page.wait_for_selector("#tp-bar-calc-popover.tp-show", timeout=10000)
    page.wait_for_timeout(300)

    # Select synthetic glitch preset to showcase live glitch detection with red ✕ markers and dynamic X-grid
    page.evaluate(r"""() => {
        const sel = document.getElementById('tp-preview-preset-select');
        if (sel) {
            sel.value = 'synthetic';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }""")
    page.wait_for_timeout(400)

    wrap_box = css_box(page, "#tp-bar-calc-wrap")
    pop_box = css_box(page, "#tp-bar-calc-popover")
    clip = union([wrap_box, pop_box], pad=88)
    raw_bytes = page.screenshot(clip=clip)

    controls = [
        ("#tp-bar-weight-wrapper", "Gewichtung Median / Rekord (Schieberegler für Deal-Score)", {"bx": 36}),
        ("#tp-bar-horizon-wrapper", "Ø-Zeitraum (Rolling Median von 30 bis 730 Tagen oder Lifetime)", {"bx": 36}),
        ("#tp-bar-minpoints-wrapper", "Mindestpunkte (erforderliche Datenpunkte für qualifizierten Ø-Vergleich)", {"bx": 36}),
        ("#tp-bar-outlier-wrapper", "Ausreisser filtern (Aktiviert automatische Glitch-Erkennung)", {"bx": 36}),
        ("#tp-bar-outlier-band-wrapper", "Glitch-Band (Toleranzband um den Median in ±%)", {"bx": 36}),
        ("#tp-bar-outlier-hours-wrapper", "Glitch-Fenster (Maximale Glitch-Dauer in Stunden)", {"bx": 36}),
        ("#tp-calc-preview svg", "Glitch-Vorschau (Live-Chart mit Ø-Preis, Rekord, Glitch-Band & roten ✕ Glitches)", {"bx": 36, "dy": 24}),
    ]
    callouts = []
    for item in controls:
        sel, cap = item[0], item[1]
        anchor = item[2] if len(item) > 2 else "outside-left"
        box = try_box(page, sel)
        if box is None:
            continue
        callouts.append((len(callouts) + 1, box, cap, anchor))
    return raw_bytes, {"x": clip["x"], "y": clip["y"]}, callouts, "01b-calc-popover.webp"


def setup_feed_cards(page, pids):
    """Shot 02: Hero deal cards with toolbar controls, authentic record low, deceptive markup exposure, and fallback low."""
    if page.locator("#tp-bar-calc-popover.tp-show").count() > 0:
        page.locator("#tp-bar-calc-btn").click()
        page.wait_for_selector("#tp-bar-calc-popover.tp-show", state="hidden", timeout=10000)

    # Hide time filter and other non-hero card rows so our 3 hero cards are cleanly isolated
    page.evaluate(r"""(heroPids) => {
        const style = document.createElement('style');
        style.textContent = '.Plugin_TimePeriod, .f_Plugin_Filter_TimePeriod, .Plugin_MainTopHead, .breadcrumb, #breadcrumb, .filterBoxContainer, .f_Plugin_Sort, .Plugin_Sort { display: none !important; }';
        document.head.appendChild(style);
        document.querySelectorAll('.mixedBrowsingListProduct, .Plugin_Product').forEach(el => {
            const hasHero = heroPids.some(pid => el.querySelector(`a[href*="-p${pid}"]`) || el.matches(`a[href*="-p${pid}"]`));
            if (!hasHero) el.style.display = 'none';
        });
    }""", pids[:3])

    anchors = [f'a[href*="-p{pid}"]' for pid in pids[:3]]
    deep, markup, fallback = anchors

    # Prepend dealer badge on deep deal card for demonstration
    page.evaluate(r'''([pid, deepSel]) => {
        const card = document.querySelector(deepSel);
        if (!card) return;
        const d = document.createElement('a');
        d.className = 'tp-dealer-name';
        d.innerHTML = '<span class="tp-dealer-icon">🏬</span> Digitec';
        d.href = 'https://www.toppreise.ch';
        const priceInfo = card.querySelector('.Plugin_PriceInformation, .price_information_product') || card;
        priceInfo.insertBefore(d, priceInfo.firstChild);
    }''', [pids[0], deep])

    card0 = page.locator(deep).first
    card0.hover()
    card0.evaluate("el => { el.style.outline = '2px solid rgba(239, 68, 68, 0.7)'; el.style.outlineOffset = '-1px'; }")
    page.wait_for_timeout(400)
    assert page.locator(f"{deep} > .tp-share-btn").count() > 0, "share button missing on deep deal"
    assert page.locator(".tp-is-verified").count() > 0, "no verified deal rendered"

    tb_box = css_box(page, "#tp-suite-filter-bar")
    card_boxes = [css_box(page, sel) for sel in anchors]
    boxes = [tb_box, *card_boxes]
    clip = union(boxes, pad=56)
    clip["y"] = max(0, tb_box["y"] - 14)
    bottom_y = max(b["y"] + b["height"] for b in card_boxes) + 56
    clip["height"] = bottom_y - clip["y"]
    raw_bytes = page.screenshot(clip=clip)
    origin = {"x": clip["x"], "y": clip["y"]}

    c1_box = css_box(page, deep)
    r2_box = css_box(page, f"{fallback} .badge-dif")
    r3_box = css_box(page, f"{markup} .badge-dif")

    callouts = [
        (1, css_box(page, "#tp-bar-heat-btn"), "Heatmap-Umschalter (Farbe folgt der Rabatt-Tiefe)", "outside-top"),
        (2, css_box(page, "#tp-bar-bestpreise-btn"), "💎 Tiefstpreis-Sortierung (nach gewichtetem Deal-Score)", "outside-top"),
        (3, c1_box, "Single-Hue Deal-Heatmap (Gewichteter Deal-Score; tiefrot = neuer Rekord-Tiefstpreis)",
         {"bx": c1_box["x"] - origin["x"] + c1_box["width"] / 2,
          "by": c1_box["y"] - origin["y"] - 26,
          "tx": c1_box["x"] - origin["x"] + c1_box["width"] / 2,
          "ty": c1_box["y"] - origin["y"]}),
        (4, r2_box, "Fallback-Tief (Vortief-Vergleich bei wenigen Datenpunkten, dezent hervorgehoben)",
         {"bx": r2_box["x"] - origin["x"] + r2_box["width"] / 2,
          "by": r2_box["y"] - origin["y"] - 26,
          "tx": r2_box["x"] - origin["x"] + r2_box["width"] / 2,
          "ty": r2_box["y"] - origin["y"] + 4}),
        (5, r3_box, "Schein-Rabatt entlarvt (Preiserhöhung statt Ersparnis; echter Aufschlag in Schiefer/Bernstein)",
         {"bx": r3_box["x"] - origin["x"] + r3_box["width"] / 2,
          "by": r3_box["y"] - origin["y"] - 26,
          "tx": r3_box["x"] - origin["x"] + r3_box["width"] / 2,
          "ty": r3_box["y"] - origin["y"] + 4}),
        (6, css_box(page, f"{deep} > .tp-share-btn"), "Discord 1-Klick Share-Button (erscheint bei Hover zum Teilen via Webhook)", [-48, 0]),
        (7, css_box(page, f"{deep} .tp-card-subline-row"), "Transparente Deal-Subline (Vortief-Abstand in % · 1-Jahres-Ø mit Abstand in %)", {"dx": 48, "dy": 38}),
        (8, css_box(page, f"{deep} .tp-dealer-name .tp-dealer-icon"), "Günstigster Händler (Direktlink zum Angebot ohne Zwischenhändler)", [-50, 0]),
        (9, css_box(page, f"{deep} .tp-sparkline-container svg"), "Mini-Trend Sparkline (Kompakter 30-Tage-Preistrend; Klick öffnet Detail-Chart)", {"dx": 30, "dy": 38}),
        (10, css_box(page, f"{deep} .tp-review-search-btn"), "1-Klick Review-Suche (🌐 erscheint bei Hover für direkte Google-Testberichtsuche)", {"dx": 10, "dy": 42}),
    ]
    return raw_bytes, origin, callouts, "02-feed-cards.webp"


def setup_search_cards(page, pids):
    """Shot 03: Search catalog listing highlighting variant protection and inline verification pills."""
    page.evaluate("""() => {
        document.body.style.paddingLeft = '50px';
        document.querySelectorAll('.Plugin_PriceSwitch, .f_Plugin_PriceSwitch, .Plugin_Sort, .f_Plugin_Sort, .filterBoxContainer, .breadcrumb, #breadcrumb, .Plugin_MainTopHead, [class*="ViewSwitch"], .top_content_wrapper, .Plugin_TopHead, .Plugin_CategoryList, .Plugin_CollItemHead').forEach(el => el.remove());
    }""")
    page.wait_for_timeout(200)

    block = page.locator(".Plugin_ProductCollItem").first
    block.scroll_into_view_if_needed()

    # Isolate the AirPods block: remove following and preceding items, sidebar, and pagination
    page.evaluate("""() => {
        document.querySelectorAll('.Plugin_ProductCollItem ~ .Plugin_ProductCollItem, .Plugin_ProductCollItem ~ .Plugin_Product, .tpContentSidebar, .sidebarWrapper, .filterBoxContainer, .sidebar, .pagination, .Plugin_Pagination, .f_Plugin_Pagination, .Plugin_PriceSwitch, .f_Plugin_PriceSwitch').forEach(el => el.remove());
        let prev = document.querySelector('.Plugin_ProductCollItem')?.previousElementSibling;
        while (prev) {
            prev.remove();
            prev = document.querySelector('.Plugin_ProductCollItem')?.previousElementSibling;
        }
        const coll = document.querySelector('.Plugin_ProductCollItem');
        if (coll) {
            coll.style.maxWidth = '540px';
            coll.style.margin = '0';
        }
    }""")

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

    # Blur active element and move mouse to remove lingering focus rings (e.g. alarm bell)
    page.evaluate("() => { if (document.activeElement?.blur) document.activeElement.blur(); }")
    page.mouse.move(0, 0)
    page.wait_for_timeout(200)

    b_box = block.bounding_box()
    pad = 16
    clip = {
        "x": max(0, b_box["x"] - pad),
        "y": max(0, b_box["y"] - pad),
        "width": b_box["width"] + pad * 2,
        "height": b_box["height"] + pad * 2,
    }
    raw_bytes = page.screenshot(clip=clip)
    origin = {"x": clip["x"], "y": clip["y"]}

    deal_box = css_box(page, deal)
    unchecked_box = css_box(page, unchecked)
    callouts = [
        (1, deal_box, "Verifizierte Rabatt-Pill (Kompakte 1-zeilige Anzeige über dem Händlerangebot)",
         {"bx": deal_box["x"] - origin["x"] + deal_box["width"] + 36,
          "by": deal_box["y"] - origin["y"] + deal_box["height"] / 2,
          "tx": deal_box["x"] - origin["x"] + deal_box["width"] + 4,
          "ty": deal_box["y"] - origin["y"] + deal_box["height"] / 2}),
        (2, unchecked_box, "Ungeprüft-Pill (Gestreiftes Signal für noch nicht verifizierte Varianten; Klick prüft Historie)",
         {"bx": unchecked_box["x"] - origin["x"] + unchecked_box["width"] + 36,
          "by": unchecked_box["y"] - origin["y"] + unchecked_box["height"] / 2,
          "tx": unchecked_box["x"] - origin["x"] + unchecked_box["width"] + 4,
          "ty": unchecked_box["y"] - origin["y"] + unchecked_box["height"] / 2}),
    ]

    return raw_bytes, origin, callouts, "03-search-cards.webp"


def setup_settings_core(page, pids):
    """Shot 04a: Settings dialog core sections 1–5 (Ansicht, Review-Suche, Sortieren, Filtern, Preisalarm)."""
    page.locator("#tp-root >> #tp-settings-fab").click()
    dlg = "#tp-root >> #tp-settings-dialog"
    page.wait_for_selector(dlg, state="visible", timeout=10000)
    page.wait_for_timeout(400)

    page.evaluate('''() => {
        const root = document.querySelector("#tp-root")?.shadowRoot;
        const d = root?.querySelector("#tp-settings-dialog");
        const s = root?.querySelector("#tp-settings-sections");
        if (d) {
            d.style.top = "40px";
            d.style.bottom = "auto";
            d.style.left = "50%";
            d.style.right = "auto";
            d.style.transform = "translateX(-50%)";
            d.style.maxHeight = "none";
            d.style.height = "auto";
        }
        if (s) { s.style.maxHeight = "none"; s.style.overflow = "visible"; }
        root.querySelector('#tp-section-discord').style.display = 'none';
        root.querySelector('#tp-section-data').style.display = 'none';
    }''')
    page.wait_for_timeout(300)

    dlg_loc = page.locator(dlg)
    dlg_box = dlg_loc.bounding_box()
    clip = union([dlg_box], pad=56)
    raw_bytes = page.screenshot(clip=clip)
    origin = {"x": clip["x"], "y": clip["y"]}

    controls = [
        ("#tp-dim-opacity-group", "Deckkraft / Dimmung für gefilterte Angebote (Schieberegler)", [-44, 0]),
        ("#tp-review-search-toggle", "Review-Suche (🌐): Google-Suche mit optionalem KI-Modus", [-44, 0]),
        ("#tp-bestpreise-mode-toggle", "Tiefstpreis-Sortierung: Rangfolge nach Gewichteter Differenz", [-44, 0]),
        ("#tp-margin-range", "Preis-Toleranz (%): Händler-Bestpreis-Marge", [-44, 0]),
        ("#tp-section-alarm .tp-range-container", "Preisalarm Auto-Fill: Zielpreis (%) & Dauer", [-44, 0]),
    ]
    callouts = []
    for sel, cap, anchor in controls:
        box = try_box(page, f"{dlg} >> {sel}")
        if box is None:
            continue
        callouts.append((len(callouts) + 1, box, cap, anchor))
    assert len(callouts) >= 3, "fewer than 3 settings core controls resolved"
    return raw_bytes, origin, callouts, "04a-settings-core.webp"


def setup_settings_advanced(page, pids):
    """Shot 04b: Settings dialog advanced sections 6–7 (Discord Share & Daten/Cache)."""
    page.locator("#tp-root >> #tp-settings-fab").click()
    dlg = "#tp-root >> #tp-settings-dialog"
    page.wait_for_selector(dlg, state="visible", timeout=10000)
    page.wait_for_timeout(400)

    page.evaluate('''() => {
        const root = document.querySelector("#tp-root")?.shadowRoot;
        const d = root?.querySelector("#tp-settings-dialog");
        const s = root?.querySelector("#tp-settings-sections");
        if (d) {
            d.style.top = "40px";
            d.style.bottom = "auto";
            d.style.left = "50%";
            d.style.right = "auto";
            d.style.transform = "translateX(-50%)";
            d.style.maxHeight = "none";
            d.style.height = "auto";
        }
        if (s) { s.style.maxHeight = "none"; s.style.overflow = "visible"; }
        root.querySelector('#tp-section-display').style.display = 'none';
        root.querySelector('#tp-section-review').style.display = 'none';
        root.querySelector('#tp-section-deals').style.display = 'none';
        root.querySelector('#tp-section-filter').style.display = 'none';
        root.querySelector('#tp-section-alarm').style.display = 'none';
    }''')
    page.wait_for_timeout(300)

    dlg_loc = page.locator(dlg)
    dlg_box = dlg_loc.bounding_box()
    clip = union([dlg_box], pad=56)
    raw_bytes = page.screenshot(clip=clip)
    origin = {"x": clip["x"], "y": clip["y"]}

    controls = [
        ("#tp-discord-webhook-collapsed", "Discord Webhook: Direkte 1-Klick Deal-Integration (lokal gespeichert)", [-44, 0]),
        ("#tp-discord-layout-chips", "Discord Layout-Baukasten mit variablen Tokens", [-44, 0]),
        ("#tp-discord-layout-preview", "Live-Markdown-Vorschau der generierten Nachricht", [-44, 0]),
        ("#tp-dealer-autofetch-toggle", "Händler automatisch im Hintergrund laden (max. 3 parallel)", [-44, 0]),
        ("#tp-cache-clear-btn", "Cache-Verwaltung: TTL-Regler, Speicherbereinigung & Konfigurations-Export", [-44, 0]),
    ]
    callouts = []
    for sel, cap, anchor in controls:
        box = try_box(page, f"{dlg} >> {sel}")
        if box is None:
            continue
        callouts.append((len(callouts) + 1, box, cap, anchor))
    assert len(callouts) >= 3, "fewer than 3 settings advanced controls resolved"
    return raw_bytes, origin, callouts, "04b-settings-advanced.webp"


SCENES = {
    "toolbar": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 1440, "height": 900},
        "setup": setup_toolbar,
    },
    "calc": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_MEDIAN_HORIZON_DAYS": 30,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 1440, "height": 900},
        "setup": setup_calc_popover,
    },
    "feed": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "HEATMAP_ACTIVE": True,
            "REVIEW_SEARCH_ENABLED": True,
        },
        "viewport": {"width": 1440, "height": 900},
        "setup": setup_feed_cards,
    },
    "search": {
        "snapshot": "search",
        "roles": [],
        "config": {},
        "viewport": {"width": 880, "height": 900},
        "setup": setup_search_cards,
    },
    "settings_core": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 1440, "height": 2500},
        "setup": setup_settings_core,
    },
    "settings_advanced": {
        "snapshot": "feed",
        "roles": ["deep", "markup", "fallback"],
        "config": {
            "BESTPREISE_MODE_ACTIVE": True,
            "BESTPREISE_WEIGHT_RECORD": 0.50,
            "BESTPREISE_HIDE_UNCHECKED": True,
        },
        "viewport": {"width": 1440, "height": 2500},
        "setup": setup_settings_advanced,
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
    import json
    meta_path = os.path.join(out_dir, "gallery_meta.json")
    all_items = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                all_items = json.load(f)
        except Exception:
            all_items = {}

    for it in items:
        all_items[it["name"]] = {
            "name": it["name"],
            "file": it["file"],
            "snapshot": it["snapshot"],
            "callouts": [(num, None, cap) for num, _box, cap, *_ in it["callouts"]],
        }

    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(all_items, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    ordered = [all_items[k] for k in SCENES.keys() if k in all_items]
    if not ordered:
        ordered = items

    cards_html = []
    for it in ordered:
        cap_rows = "".join(
            f"<tr><td class='num'>{num}</td><td class='cap'>{html.escape(cap)}</td></tr>"
            for num, _box, cap, *_ in it["callouts"]
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
                    annotator_ctx = browser.new_context(viewport={"width": 1920, "height": 4500}, device_scale_factor=DSF)
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
