from playwright.sync_api import Page

from conftest import seed_verified_deal


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
