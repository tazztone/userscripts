"""Vendor real Toppreise pages as offline snapshots for screenshot rendering.

Usage (requires display :0, headed Chrome passes the site WAF):
    venv/bin/python toppreise/tools/capture-snapshots.py [FEED_URL] [SEARCH_URL]

Writes toppreise/tools/snapshots/{feed,search}/{index.html,assets/,manifest.json}.
Run once, re-run only when site markup changes. The gallery renderer
(refresh-screenshot.py) consumes these snapshots headless and offline.
"""

import hashlib
import json
import os
import re
import sys
import urllib.parse
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SNAP_DIR = os.path.join(BASE_DIR, "snapshots")
READY = {"feed": ".badge-dif", "search": ".Plugin_ProductCollItem"}

COOKIE_RE = r"akzeptieren|einverstanden|zustimmen|accept"
WANT_TYPES = {"stylesheet", "image", "font"}

CT_EXT = {
    "text/css": "css",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "font/woff2": "woff2",
    "application/font-woff2": "woff2",
    "font/woff": "woff",
    "application/font-woff": "woff",
    "font/ttf": "ttf",
    "application/x-font-ttf": "ttf",
    "font/otf": "otf",
}

# Sanitize + rewrite runs in-page (real HTML parser, not regex on markup).
SANITIZE_JS = """(urlmap) => {
  const mapped = (abs) => urlmap[abs] || null;
  const unmapped = new Set();
  const rewriteOne = (val) => {
    if (!val || val.startsWith('data:') || val.startsWith('blob:')) return val;
    let abs;
    try { abs = new URL(val, location.href).href; } catch (e) { return val; }
    const hit = mapped(abs);
    if (hit) return hit;
    if (/toppreise\\.ch/i.test(abs)) unmapped.add(abs);
    return val;
  };
  document.querySelectorAll(
    'script, iframe, noscript, [id*=cookie i], [class*=cookie i], [id*=consent i], base, .fc-consent-root, [class*="fc-dialog"], [class*="fc-help"]'
  ).forEach(el => el.remove());
  document.querySelectorAll('[src]').forEach(el => {
    el.setAttribute('src', rewriteOne(el.getAttribute('src')));
  });
  document.querySelectorAll('[href]').forEach(el => {
    el.setAttribute('href', rewriteOne(el.getAttribute('href')));
  });
  document.querySelectorAll('[srcset]').forEach(el => {
    const out = el.getAttribute('srcset').split(',').map(part => {
      const toks = part.trim().split(/\\s+/);
      if (!toks[0]) return part;
      return [rewriteOne(toks[0]), ...toks.slice(1)].join(' ');
    });
    el.setAttribute('srcset', out.join(', '));
  });
  const cssUrls = (css) => css.replace(/url\\(\\s*(['"]?)(.*?)\\1\\s*\\)/g, (m, q, u) => {
    const r = rewriteOne(u);
    return r === u ? m : `url("${r}")`;
  });
  document.querySelectorAll('style').forEach(el => { el.textContent = cssUrls(el.textContent); });
  document.querySelectorAll('[style]').forEach(el => {
    el.setAttribute('style', cssUrls(el.getAttribute('style') || ''));
  });
  // Card pids in DOM order, suite rule (cards.js getCardProductId): -p<digits> hrefs.
  const pids = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const m = (a.getAttribute('href') || '').match(/-p(\\d+)/i);
    if (m && !seen.has(m[1])) { seen.add(m[1]); pids.push(m[1]); }
    if (pids.length >= 8) break;
  }
  return { html: document.documentElement.outerHTML, unmapped: [...unmapped], pids };
}"""


def ext_for(content_type, url):
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct in CT_EXT:
        return CT_EXT[ct]
    suffix = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower().lstrip(".")
    if re.fullmatch(r"[a-z0-9]{2,4}", suffix):
        return suffix
    return "bin"


def rewrite_css_urls(css_text, css_url, urlmap):
    # CSS files live in assets/ next to their siblings: rewrite to bare filenames.
    def sub(m):
        raw = m.group(2)
        if raw.startswith(("data:", "blob:")):
            return m.group(0)
        abs_url = urllib.parse.urljoin(css_url, raw)
        hit = urlmap.get(abs_url)
        return f'url("{os.path.basename(hit)}")' if hit else m.group(0)

    return re.sub(r"url\(\s*(['\"]?)(.*?)\1\s*\)", sub, css_text)

def capture(browser, name, url, out_dir):
    os.makedirs(os.path.join(out_dir, "assets"), exist_ok=True)
    bodies = {}

    page = browser.new_page(viewport={"width": 1440, "height": 900})

    def on_response(resp):
        try:
            if resp.request.resource_type in WANT_TYPES and resp.status == 200:
                bodies[resp.url] = (resp.body(), resp.headers.get("content-type", ""))
        except Exception:
            pass

    page.on("response", on_response)
    page.goto(url, timeout=120000)
    try:
        page.get_by_role("button", name=re.compile(COOKIE_RE, re.I)).first.click(timeout=5000)
    except Exception:
        pass
    page.wait_for_selector(READY[name], timeout=60000)
    last_h, steps = 0, 0
    while steps < 20:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(300)
        h = page.evaluate("document.body.scrollHeight")
        if h == last_h:
            break
        last_h, steps = h, steps + 1
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(1000)

    urlmap, saved = {}, {}
    for abs_url, (body, ct) in bodies.items():
        digest = hashlib.sha256(body).hexdigest()[:12]
        name = f"assets/{digest}.{ext_for(ct, abs_url)}"
        if body not in saved:
            saved[body] = name
        urlmap[abs_url] = saved[body]
    css_urls = [u for u, (_, ct) in bodies.items() if ct.split(";")[0].strip().lower() == "text/css"]
    for abs_url in css_urls:
        body, _ = bodies[abs_url]
        text = body.decode("utf-8", errors="replace")
        fixed = rewrite_css_urls(text, abs_url, urlmap)
        if fixed != text:
            bodies[abs_url] = (fixed.encode("utf-8"), "text/css")
            digest = hashlib.sha256(bodies[abs_url][0]).hexdigest()[:12]
            urlmap[abs_url] = f"assets/{digest}.css"
    for abs_url, (body, _) in bodies.items():
        with open(os.path.join(out_dir, urlmap[abs_url]), "wb") as f:
            f.write(body)

    result = page.evaluate(SANITIZE_JS, urlmap)
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write("<!DOCTYPE html>\n" + result["html"])
    manifest = {
        "source_url": url,
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pids": result["pids"],
    }
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    page.close()
    print(f"{out_dir}: {len(urlmap)} assets, pids={result['pids']}")
    for u in result["unmapped"]:
        print(f"  unmapped (stays absolute): {u}")
    return manifest


def main():
    feed_url = sys.argv[1] if len(sys.argv) > 1 else FEED_URL
    jobs = [("feed", feed_url)]
    if len(sys.argv) > 2:
        jobs.append(("search", sys.argv[2]))
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            headless=False,
            ignore_default_args=["--enable-automation"],
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            for name, url in jobs:
                manifest = capture(browser, name, url, os.path.join(SNAP_DIR, name))
                assert manifest["pids"], f"no card pids found at {url}"
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
