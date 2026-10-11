import re

from playwright.sync_api import Page

from conftest import open_settings, seed_verified_deal


def _site_colors(page: Page):
    return page.evaluate("""() => {
        const card = document.getElementById('card-cheapest');
        const cs = getComputedStyle(card);
        const pick = el => el ? getComputedStyle(el).color : null;
        return {
            title: pick(card.querySelector('.product-name')),
            price: pick(card.querySelector('.priceContainer.shippingPrice .Plugin_Price')),
            currency: pick(card.querySelector('.priceContainer.shippingPrice .currency')),
            bg: cs.backgroundImage,
        };
    }""")


def test_heatmap_chrome_preserves_light_site(page: Page):
    # Seed a verified -50% deal so the card heats (unchecked cards never heat)
    seed_verified_deal(page)
    page.wait_for_selector('#card-cheapest.tp-heat-blend')
    heat_btn = page.locator('#tp-bar-heat-btn')

    heated = _site_colors(page)

    # Toggle heat off: card must fall back to the untouched site skin
    heat_btn.click()
    page.wait_for_timeout(200)
    assert 'tp-heat-blend' not in (page.locator('#card-cheapest').get_attribute('class') or '')
    plain = _site_colors(page)

    # Toggle heat back on
    heat_btn.click()
    page.wait_for_timeout(200)
    page.wait_for_selector('#card-cheapest.tp-heat-blend')

    # Chrome-only heat: no fill, so site text colors are byte-identical on/off
    assert heated['title'] == plain['title']
    assert heated['price'] == plain['price']
    assert heated['currency'] == plain['currency']
    assert 'linear-gradient' not in heated['bg']

    # Solid badge keeps white text on an opaque swatch
    badge = page.locator('#card-cheapest .badge-dif')
    assert badge.evaluate("el => getComputedStyle(el).color") == 'rgb(255, 255, 255)'
    badge_bg = badge.evaluate("el => getComputedStyle(el).backgroundColor")
    assert badge_bg not in ('rgba(0, 0, 0, 0)', 'transparent')

    # Bell trigger stays visible on the heated card
    assert page.locator('#mock-alarm-bell').is_visible()



def _chan(v):
    v /= 255.0
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def _lum(rgb):
    r, g, b = rgb
    return 0.2126 * _chan(r) + 0.7152 * _chan(g) + 0.0722 * _chan(b)


def _ratio(fg, bg):
    a, b = sorted([_lum(fg), _lum(bg)], reverse=True)
    return (a + 0.05) / (b + 0.05)


def _parse_rgba(s):
    m = re.match(r'rgba?\(([^)]+)\)', s or '')
    if not m:
        return None
    parts = [p.strip() for p in m.group(1).split(',')]
    if len(parts) < 3:
        return None
    return (int(parts[0]), int(parts[1]), int(parts[2]),
            float(parts[3]) if len(parts) > 3 else 1.0)


def _parse_hex(s):
    m = re.match(r'#([0-9a-fA-F]{6})', s or '')
    if not m:
        return None
    h = m.group(1)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0)


def _over(fg, bg):
    """Alpha-composite fg rgba over opaque bg rgb."""
    r, g, b, a = fg
    return (r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a))


def _stops(bg_image):
    """Every color stop of a gradient (or solid) background, composited over white."""
    found = re.findall(r'rgba?\([^)]+\)|#[0-9a-fA-F]{6}', bg_image or '')
    colors = []
    for token in found:
        c = _parse_rgba(token) or _parse_hex(token)
        if c:
            colors.append(_over(c, (255, 255, 255)))
    return colors


def _pair_ratio(fg_str, bg_str, bg_image=None, page_bg=(255, 255, 255)):
    """Worst-case contrast of fg text over its rendered background.

    Uniform element opacity is ignored on purpose: it scales text and its own
    background together, so text-vs-background contrast is preserved.
    """
    fg = _parse_rgba(fg_str) or _parse_hex(fg_str)
    assert fg, f'unparsable fg {fg_str!r}'
    bg = _parse_rgba(bg_str) or _parse_hex(bg_str) or (0, 0, 0, 0)
    if bg_image and bg_image != 'none':
        candidates = _stops(bg_image)
    elif bg[3] < 1.0:
        candidates = [_over(bg, page_bg)]
    else:
        candidates = [bg[:3]]
    assert candidates, f'no background found (bg={bg_str!r} image={bg_image!r})'
    return min(_ratio(_over(fg, c), c) for c in candidates)


def _dump(page, selector, props=('color', 'backgroundColor', 'backgroundImage')):
    return page.evaluate("""([selector, props]) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out = {text: (el.innerText || '').slice(0, 40)};
        for (const p of props) out[p] = cs[p];
        return out;
    }""", [selector, list(props)])


def test_suite_text_contrast_on_light(page: Page):
    # Record-low (natural), markup (natural); at-low forced onto the record
    # subline since its CSS rule is what is under test.
    seed_verified_deal(page, '797571', {
        'tiefstpreis': 1800, 'hoechstpreis': 2600, 'medianPrice': 2400,
        'previousLow': 2200, 'isNewAllTimeLow': True,
        'realDiscountVsPrevLow': 18, 'dataPointCount': 10})
    seed_verified_deal(page, '797573', {
        'tiefstpreis': 10, 'hoechstpreis': 25,
        'isNewAllTimeLow': False, 'dataPointCount': 10}, clear=False)
    page.wait_for_selector('#card-cheapest .tp-card-historical-price.tp-is-record-low')

    rec = _dump(page, '#card-cheapest .tp-card-historical-price')
    assert _pair_ratio(rec['color'], rec['backgroundColor']) >= 7.0

    page.evaluate("""() => {
        const el = document.querySelector('#card-cheapest .tp-card-historical-price');
        el.classList.remove('tp-is-record-low');
        el.classList.add('tp-is-at-low');
    }""")
    low = _dump(page, '#card-cheapest .tp-card-historical-price')
    assert _pair_ratio(low['color'], low['backgroundColor']) >= 4.5

    mark = _dump(page, '#card-negative .tp-card-historical-price.tp-is-markup')
    assert mark, 'markup subline did not render'
    assert _pair_ratio(mark['color'], mark['backgroundColor']) >= 4.5

    # Ribbon white % on the heat swatch (13px bold: small text, needs 4.5).
    # Background lives on the badge root, not the <p>.
    badge = _dump(page, '#card-cheapest .badge-dif p')
    badge_bg = _dump(page, '#card-cheapest .badge-dif')
    assert badge['color'] == 'rgb(255, 255, 255)'
    assert _pair_ratio(badge['color'], badge_bg['backgroundColor'],
                       badge_bg['backgroundImage']) >= 4.5

    # Unverified ribbon: dark slate inners over the gray stripes
    unv = _dump(page, '#card-low-offers .badge-dif p')
    stripe_bg = page.evaluate("""() => {
        const b = document.querySelector('#card-low-offers .badge-dif');
        return b ? getComputedStyle(b).backgroundImage : 'none';
    }""")
    assert _pair_ratio(unv['color'], 'rgba(0, 0, 0, 0)', stripe_bg) >= 4.5

    # Markup badge: struck-through site % + white +XX% on the site red.
    # Background lives on the badge root, not the inners.
    notlow_bg = _dump(page, '#card-negative .tp-deal-not-low')
    fake = _dump(page, '#card-negative .tp-deal-not-low .tp-fake-discount')
    if fake:
        assert _pair_ratio(fake['color'], notlow_bg['backgroundColor']) >= 4.5
    markup = _dump(page, '#card-negative .tp-deal-not-low p.tp-markup-val')
    if markup:
        assert _pair_ratio(markup['color'], notlow_bg['backgroundColor']) >= 4.5

    # Loading pill (list-view classes forced: the rule under test)
    page.evaluate("""() => {
        const b = document.querySelector('#card-low-offers .badge-dif');
        b.classList.add('tp-deal-pill', 'tp-deal-loading');
    }""")
    loading = _dump(page, '#card-low-offers .badge-dif.tp-deal-loading .text')
    assert _pair_ratio(loading['color'], loading['backgroundColor']) >= 4.5

    # Floating CTA: white main text over the emerald gradient
    cta = _dump(page, '#tp-floating-check-main')
    assert cta, 'floating CTA did not render'
    cta_bg = page.evaluate("""() => {
        const b = document.querySelector('#tp-floating-check-btn');
        return b ? getComputedStyle(b).backgroundImage : 'none';
    }""")
    assert _pair_ratio(cta['color'], 'rgba(0, 0, 0, 0)', cta_bg) >= 4.5

    # Detail-page badges: shipped gradient rules pinned via synthetic hosts
    page.evaluate("""() => {
        for (const cls of ['tp-is-alltime-low', 'tp-is-not-low', 'tp-is-severe-markup']) {
            const s = document.createElement('span');
            s.className = 'tp-detail-deal-badge ' + cls;
            s.id = 'tp-contrast-probe-' + cls;
            s.textContent = '-25%';
            document.body.appendChild(s);
        }
    }""")
    for cls in ['tp-is-alltime-low', 'tp-is-not-low', 'tp-is-severe-markup']:
        probe = _dump(page, f'#tp-contrast-probe-{cls}')
        assert _pair_ratio(probe['color'], probe['backgroundColor'],
                           probe['backgroundImage']) >= 4.5, cls
    page.evaluate("""() => {
        document.querySelectorAll('[id^="tp-contrast-probe-"]').forEach(el => el.remove());
    }""")

    # Threshold popover selected option: white on dark emerald
    page.locator('#tp-floating-threshold-btn').click()
    page.wait_for_selector('#tp-floating-threshold-popover .tp-floating-option.tp-selected')
    sel = page.evaluate("""() => {
        const el = document.querySelector(
            '#tp-floating-threshold-popover .tp-floating-option.tp-selected');
        const cs = getComputedStyle(el);
        return {color: cs.color, bg: cs.backgroundColor};
    }""")
    assert _pair_ratio(sel['color'], sel['bg']) >= 4.5
    page.keyboard.press('Escape')

    # Modal section headers (shadow DOM): each accent on dialog white
    open_settings(page)
    headers = page.evaluate("""() => {
        const root = document.getElementById('tp-root').shadowRoot;
        return [...root.querySelectorAll('.tp-section-header')].map(el => ({
            text: el.innerText.slice(0, 24), color: getComputedStyle(el).color,
        }));
    }""")
    assert len(headers) >= 4, headers
    for h in headers:
        assert _pair_ratio(h['color'], 'rgb(255, 255, 255)') >= 4.5, h

    # Keyboard focus ring: dark emerald outline on dialog white (FAB lives in
    # shadow DOM, so _dump can't reach it; focusVisible forces :focus-visible)
    fab_ring = page.evaluate("""() => {
        const fab = document.getElementById('tp-root').shadowRoot.getElementById('tp-settings-fab');
        fab.focus({focusVisible: true});
        return getComputedStyle(fab).outlineColor;
    }""")
    assert _pair_ratio(fab_ring, 'rgb(255, 255, 255)') >= 3.0, fab_ring

    # Bestpreise-empty notice: check-deals button on the white notice card
    page.keyboard.press('Escape')
    seed_verified_deal(page, '797572', {'tiefstpreis': 500, 'hoechstpreis': 600,
        'medianPrice': 550, 'isNewAllTimeLow': False, 'dataPointCount': 10})
    page.evaluate("""() => {
        window.ToppreiseSuite.updateConfig('MODE', 'hide');
        window.ToppreiseSuite.updateConfig('BESTPREISE_MODE_ACTIVE', true);
        window.ToppreiseSuite.updateConfig('BESTPREISE_HIDE_UNCHECKED', true);
        window.ToppreiseSuite.processListings();
    }""")
    page.wait_for_selector('#tp-empty-check-deals-btn')
    btn = _dump(page, '#tp-empty-check-deals-btn')
    assert _pair_ratio(btn['color'], btn['backgroundColor']) >= 4.5
