# Toppreise.ch Suite — Research & Selector Reference

> **Status (2026-09-30):** Native `Plugin_IgnoredCategories` is authoritative for
> category exclusion. The suite ships **no** category engine (§6 is a tombstone,
> §23 records the removal). Code is truth for selectors — see
> `src/page/selectors.js`, `src/page/cards.js`, `src/page/sort.js`,
> `mock_toppreise.html`. This log keeps only what code doesn't say: live DOM
> contracts, formulas, and placement/observer rules.
>
> **Update (2026-10-04):** median honesty (true even-n median, `medianFallback`
> + honest horizon labels, raw 2%/5% thresholds), toolbar weight slider
> replaces the preset popover, legacy `FILTER_BESTPREIS_ENABLED` removed.

## 1. Live DOM reference

### Feed skeleton (`/neue-toppreise`)

```html
<body class="Page_ListTopPriceReductionProducts" data-current_url="/neue-toppreise">
<div id="FrameContent">                          <!-- suite bar anchors HERE, before page wrapper -->
  <div id="Page_ListTopPriceReductionProducts">
    <div class="row">                            <!-- 2-col layout: sidebar + main; never touch -->
      <div class="filterBoxContainer">…#Plugin_CategoryMainSelectionLeft_*…</div>
      <div class="contentBox">
        <div id="Plugin_IgnoredCategories_*">…native chips…</div>
        <div class="tabbedContainer"><div class="contentBox"><div class="f_tab selected"><div class="tabContent">
          <div id="Plugin_TimePeriod_*">…radio.f_timePeriod…</div>
          <div id="Plugin_TopPriceReductionProductListFull_*"><div class="standardList"><div class="row">
            <a class="Plugin_Product medium-box col-12 col-sm-6 col-lg-4 col-xxxl-3"
               data-entity-id="PID" href="/preisvergleich/…-pPID">…card…</a>
```

- `isNeueToppreisePage()` checks `data-current_url` **and** `data-current-url`,
  plus `location.href` (`neue-toppreise|new-best-prices|nouveaux-meilleurs-prix`)
  and `body.Page_ListTopPriceReductionProducts`. Excludes `Page_Browsing` /
  `Page_ProductSearch` and `produktsuche|katalog|search|suche` URLs.
- Cards are direct `<a>` anchors with grid classes on the anchor itself; on some
  catalog views the card sits inside a wrapper `div.col-*` instead — see §4
  (`getCardSortableUnit`). `card.closest('a[href]')` + tagName check required;
  `card.querySelectorAll('a')` returns 0 on feed cards.
- Image wrapper is `.product-image` inside `.col-auto` (not only
  `.image_container`): constrain `.product-image img, .image_container img`
  to ≤75px, `object-fit: contain`. Card interior: `.product-name`,
  `.product-rating` (stars), `.product-price` (`.shippingPrice` +
  `.productPrice` → `.Plugin_Price`). Feed cards have **no** offer counts or
  dealer sublines (`extractOfferCount → 0`, `pageHasOffers → false` hides the
  min-offers stepper).
- Discount badge: `.badge.badge-dif(.m_1_25|.m_26_50|.m_51_100)` —
  `m_51_100` is the consolidated ≥51% bracket (replaces `m_51_75`/`m_76_100`).
  Inner: `<div class="text">Differenz</div><p>-XX%</p>`.
- Detail pages: product id from `data-entity-id` or `/-p(\d+)/`; price from
  `.productPrice .Plugin_Price` → fallback `.Plugin_Price` (ordered single
  queries, never one grouped selector).

### Catalog / list differences

- Cards: `.Plugin_Product.mixedBrowsingList, .mixedBrowsingListProduct`;
  dealer rows `.Plugin_DealerRelProdPriceInfo`; offer counts present.
- Variant families group under `.Plugin_ProductCollItem >
  .Plugin_ProductCollectionRelProductsList > .Plugin_Product.f_collection`
  (indivisible sort unit — never split subcards out).
- No native `.badge-dif` → suite injects `.badge.badge-dif.tp-injected-badge`
  (feed: 50px circle) or compact inline `.tp-deal-pill`
  (`flex-direction: row !important`, icon + text on one line; subcards attach
  beside `.bold` variant title). List view needs
  `.mixedBrowsingListProduct { padding-right: 68px }`.

### Native surfaces (coexist, don't collide)

- Chip bar `#Plugin_IgnoredCategories_*` (`data-context-hash`,
  `data-ajax-url="/plugins/filter/IgnoredCategories"`, `data-ignored-count`,
  `data-active`): hint `.ignoreCategoryHint` when empty; chips
  `.ignoredCategory.f_IgnoredCategories_Show[data-vcat-id][data-ident]`,
  overflow `.moreChipsToggle`, reset `.resetAll.f_IgnoredCategories_Reset`
  (+ confirm dialog `.AbstractDialog_IgnoredCategoriesResetDialog`).
  Full-exclusion empty state `.emptyBecauseIgnored`.
- Sidebar `#Plugin_CategoryMainSelectionLeft_*[data-trgt="TopPriceReductionProductListFull"]`:
  `li.category_level_0` + `span.ignoreCategory.f_IgnoredCategories_Hide[data-vcat-id]`
  (excluded → `li.ignoredCategoryEntry`); toggles
  `.f_showMoreCatDetails.showClosedOnly` / `.f_hideMoreCatDetails.showExpandedOnly`.
- Per-card trigger `.hideCategoryTrigger.f_IgnoredCategories_MenuTrigger`
  at `top: 0; right: 0; z-index: 3` (card gets `.hasHideTrigger`); hover loads
  `.IgnoredCategoriesMenu .entry.f_IgnoredCategories_MenuEntry[data-vcat-id]`
  via `POST /plugins/filter/IgnoredCategories`
  (`aicat|aicatvc|aicatpr|aicatrs + fp_ic_ch + lang`, `X-Requested-With`).
- Suite keeps clear: bar at `#FrameContent`, badges at `top: 10px; right: 10px`,
  no quick-block overlap. Native AJAX grid reloads are observed passively —
  just re-run `processListings()`.

### Price alarm selectors

`.Plugin_NewInfoMailForm` in `.AbstractDialog_NewInfoMailFormDialog`:
present price `.shippingPrice .Plugin_Price` → fallback
`.productPrice .Plugin_Price`; target `input#f_NewInfoMailForm_priceFrom |
input[name="im_nimf_pvf"]`; duration hidden `input[name="im_nimf_du"]` +
`li[data-value="730"]`; GDPR `input#im_nimf_prtrm`; submit
`input.f_submitbtn`; close `.AbstractDialog_CloseButton`.
**Lifecycle:** 300ms pre-submit settle + 800ms post-submit grace before close —
closing synchronously aborts the `/plugins/infomails/NewInfoMailForm` POST
("unerwarteter Fehler") and races validator binding.

## 2. Suite architecture

- **Shadow DOM:** `<div id="tp-root">` (open shadow) on body; settings
  `<dialog id="tp-settings-dialog">` via `showModal()` (Top Layer, immune to
  site stacking). Host styles in a host `<style>`; dialog/FAB styles only in
  shadow (`SHADOW_MODAL_STYLES`); toasts in `#tp-toast-container` (shadow).
  Popovers inside an open Top-Layer dialog must mount **inside** the dialog
  (`mountContainer`), not `document.body`, or they land behind the backdrop.
- **Storage (2-layer, reinstall-proof):** `GM_setValue` + domain
  `localStorage['tp_suite_v2_'+key]` mirror; reads prefer GM → backup →
  default; corrupt JSON never throws. Survives script uninstall/reinstall.
- **Config dispatcher:** all mutations via `updateConfig(key, val)` /
  `updateConfigs(entries)` → `syncUiControl` (shadow modal + toolbar) + body
  classes + `processListings()`. Per-filter toggles `FILTER_NEG_ENABLED / FILTER_MIN_ENABLED` (`toolbar.js`;
  legacy `FILTER_BESTPREIS_ENABLED` removed 2026-10-04 — strictness lives in
  `BESTPREISE_MODE_ACTIVE`); `⚡ Filter AN/AUS` bypasses non-destructively (blacklists
  preserved; clearing lives only in drawer *"Alle freigeben"* + 5s Undo toast).
  `👁️ N` is the unified filtered-count preview. Weight `0` is valid —
  use `isNaN(raw) ? 50 : raw`, never `parseInt(…) || 50`.

## 3. Deal engine

### Endpoints (fast route first, fallback second)

1. `POST /plugins/product/pricechart`
   (`application/x-www-form-urlencoded`, `X-Requested-With: XMLHttpRequest`):
   `pcspagdpi={pid}&pcspagdfdt=0000-00-00&pcspagdtd=&p_pc_ch=&lang=de` →
   `[[[ts, price_product]…], [[ts, price_shipping]…]]`. One ~50ms call yields
   series + all aggregates. Live 2026-10-04: bare curl → 403 (bot protection);
   browser UA (`Firefox/132.0`) + `Origin`/`Referer` → 200. Origin fallback required for `file://` tests:
   `location.origin.startsWith('http') ? location.origin : 'https://www.toppreise.ch'`.
2. `GET /plugins/product/pricechart?p_pc_pid={pid}` (same XHR header) →
   pre-rendered dialog HTML; read aggregates after
   `<div class="title">Tiefstpreis|aktueller Toppreis|Höchstpreis</div>` →
   `.Plugin_Price`. Traverse via `nextElementSibling?.querySelector('.Plugin_Price')`
   or `closest('.col-4,.col-md-3,.col-md,[class*="col-"]:not(.title)')` + regex
   fallback — never bare `closest('.col-12')` (matches the title div itself).
   Labels resolved DE/FR/IT/EN.

### Validation formulas (all comparisons in integer cents via `priceToCents`)

- At low: `cents(P_curr) == cents(Tiefstpreis)`. New low:
  `cents(P_curr) < cents(Tiefstpreis)` — or equal cents with the analyzed-series
  `isNewAllTimeLow` flag (series include the current price). Trailing-plateau
  walk is strict-cent too (no tolerance band — a 1% band used to swallow
  sub-1% dips and overstate micro-records). Record breakthrough:
  `D_record = (P_prev_low − P_curr)/P_prev_low × 100` (raw decides the ≥2%
  gate, rounded % displays). Subline always shows `Bisher: CHF XX.XX` when
  known & ≥1¢ below current, combined with the Ø part when available.
  Markup: `(Curr − Tiefst)/Tiefst × 100`.
- Real discount vs high: `(Höchst − Curr)/Höchst × 100`;
  inflation gap vs low: `(Curr − Tiefst)/Tiefst × 100`.
- Feed `-XX%` is only the immediate drop vs previous/baseline — frequently a
  fake deal above the historical low. Trust pricechart only.

### Sanitizing + median horizon (`price.js`)

- `sanitizeTimeSeries`: median `M_raw`; dip candidate `< 0.35×M`
  (spike `> 2.5×M` mirrored); glitch if duration <48h with neighbours
  `≥ 0.60×M`, or extreme edge (`< 0.25×M` next to `≥ 0.70×M`). Stats derive
  from clean points only; count exposed as `filteredOutliers`
  (`ℹ️ N Ausreisser ignoriert`).
- Median horizon `BESTPREISE_MEDIAN_HORIZON_DAYS`: `365` default | `180` |
  `90` | `0` = lifetime; fallback to lifetime median if window has <3 points,
  flagged via `medianFallback`. True median (even-n averages the middle two,
  no upper bias). Labels via `medianHorizonLabel`: window label only when the
  median really comes from that window, else `Lifetime` (legacy cache without
  the flag keeps the old label until refresh). Sampling is strictly daily &
  uniform (live-verified 2026-10-04: 607–3825 pts/product, max gap 1.0d) —
  equal-weight == time-weighted, no duration weighting.
  Subline combines: `Bisher: CHF … · Ø-Preis (1J): CHF 460.00` (fallback reads
  `Lifetime`).

### Deal-Score (`deal-score.js`)

```
Score = max(0, round((1−W)·D_median + W·D_record))
D_median  = (P_median − P_curr)/P_median × 100      (everyday savings)
D_record  = (P_prev_low − P_curr)/P_prev_low × 100  (0 if matching record)
W         = BESTPREISE_WEIGHT_RECORD (default 0.50; toolbar slider 0–100 step 5
            with rast ticks at the old presets, labels via `weightShortText` /
            `weightTitleText`; drag debounced 150ms, flush + toast on release;
            modal control two-way synced, skipped mid-drag)
```

Gate: at/below low, ≥2% lifetime variance, ≥5 points, Score > 0 —
else `null` (hidden via `.tp-bestpreise-hidden`). The score **ranks only**
(feed sort, ⚖️ weight slider); it drives no color and no badge text. Badge
shows the event: `Real Deal · Rekord −D_record%` for significant new records
(raw ≥ 2.0% decides, rounded % displays; else plain `Tiefstpreis 🌟`), `Real Deal · Ø-Preis −D_median%` at a
matched low — never the score, never the site Differenz once verified.
Sub-pill `Rek: −X% · Ø: −Y%`; tooltip carries the ranking score + color
legend. Gold halo = significant new record, emerald = at low; tooltip breaks
down `Ø-Rabatt` / `Rekord-Marge`.
Feed sorts Score ↓. Toggle `💎 Neue Bestpreise` is instant client-side (0
network); `🔍 Check Deals` / `≥30%` stay active to stream-threshold-scan into it.

### Cache + scanner pacing

- `localStorage tp_hist_v1_{pid}`: valid TTL `REAL_DEAL_CACHE_HOURS` (default
  48; 24/72/7d/14d), negative `{unavailable:true}` TTL `NEGATIVE_CACHE_HOURS`
  (default 2; 1/6/12/24). Cap 300 entries + 10-min prune throttle (flush on
  `QuotaExceededError`); in-memory LRU 500. 1-click `🗑️ Cache leeren` in modal.
- Batch `runBatchDealCheck`: 250–350ms jitter, `Retry-After`-aware backoff on
  429/503 with live `⏳ Rate-Limit (Pause Ns)… ✕` + `interruptibleSleep`
  (100ms slices, cancellable). Bestpreise scan: fixed 200ms, priority = feed
  discount ↓, cancel flag on mode-off. Spinner (`⏳ Prüfe…`) only while that
  pid's fetch is in-flight (`currentlyScanningPid`) — never blanket-hide
  unscanned cards. Sparkline: inline SVG 60×18, `#10b981` down/new-low vs
  `#ef4444` up.

## 4. Rendering rules

### Heatmap (`getHeatmapStyles(diff, intensity)` in `page/cards.js`)

Single-hue gray → red (no cold side; markups clamp to neutral slate),
`t = -min(0, max(-100, diff)) / 100`, piecewise interpolated; card gets
`.tp-heatmap-active` + `--tp-heat-bg/--tp-heat-border/--tp-heat-glow`:

| t / discount | feel | base → accent |
|---|---|---|
| 0.00 / 0% (or any markup) | neutral slate | `[24,32,44]` → `[45,58,76]` |
| 0.50 / −50% | flame orange | `[75,42,12]` → `[215,85,18]` |
| 1.00 / −100% | volcanic ruby | `[98,14,32]` → `[238,25,65]` |

Feed heat comes from `getHeatInput()` = the headlined badge % (`deal-score.js`):
the Rekord headline (−D_record) at ≥50% Rekord weight, the Ø headline
(−D_median) below it or at-low — always the number the ribbon prints
(ADR-0002/ADR-0004). Verified markups, unqualified histories (plain-star
badges) and anything with a raw value inside the ±5% deadband → neutral gray
(the ribbon still prints the rounded %). The badge reuses
the ramp via `getBadgeHeatStyle()` (solid swatch, intensity-scaled like the
card), so badge color always matches card heat; it resyncs on every render,
not only on heat-key change. Unverified site discounts render at 0.55×
intensity so provisional heat reads provisional. Hover: stable shadow only —
no infinite
pulse keyframes, no `scale()`, no `brightness()` (all caused jitter/reflow).

### Badge / subline states

- Unchecked: native `-XX%` + `🔍` loupe, hover-scale only.
- Loading: in-place `⏳` pulse.
- Verified low: badge shows the real event (`Real Deal · Rekord −X%` /
  `Real Deal · Ø-Preis −Y%`, site-% evicted to tooltip) + emerald halo; the
  subline always carries `Bisher: CHF XX.XX` when previousLow is known &
  distinct (record and matched low alike), plus the Ø part when available —
  record line is bold + emerald pill (`tp-is-record-low`), matched-low with
  Bisher adds `tp-with-prev`. Markup cards show `Tiefstpreis: CHF XX.XX`.
- Fake deal: amber gradient `+XX%` + struck `<s>-YY%</s>` +
  `Tiefstpreis: CHF XX.XX` under price.

### Sorting + filtering (grid-safe)

- `getCardSortableUnit(card)`: `<a>` itself if it carries `col-*`, else nearest
  wrapper `div.col-*` / `.Plugin_ProductCollItem` — never climb past
  `.product-grid/.row/.contentBox/#FrameContent`. Sort **within**
  `cards[0].parentElement` (lowest common grid) via `insertBefore` only when
  order actually differs; record `data-tp-initial-order` for 1:1 restore.
  Never query page-level `.row` or `display:none` layout rows (kills sidebar).
- Filter classes `.tp-bestpreise-hidden, .tp-negative-filtered,
  .tp-min-offers-filtered, .tp-non-bestpreis-filtered` hide card **and**
  wrapper via CSS `:has(> .tp-*)`. Count `bestpreiseHidden` only if not already
  neg/category-filtered; empty state exits if `bestpreiseDeals > 0`.
- Store filter: cards cached as `card._tpDealerRows / _tpTextLower / _tpPriceInfo`
  (cleared on recycle); skip dimming when `dealerRows.length === 0` (catalog
  cards omit rows). `applyCardFilters/isCardFilteredOut` live in `page/cards.js`
  shared by UI + scanner (scanner passes real `pageHasOffers` — never assume
  `true`, feed has no counts).

### Card CSS contract (one rule-set, §15/20/21/25 merged)

```css
.Plugin_Product > .row { flex-wrap: nowrap !important; }          /* outer: image|details never stack */
.Plugin_Product .col-auto, .product-image { flex-shrink: 0 !important; max-width: 75px; }
.Plugin_Product > .row > .col { min-width: 0 !important; flex: 1 1 auto !important; overflow: hidden; }
.Plugin_Product .col > .row { flex-direction: column !important; flex-wrap: nowrap !important; height: 100% !important; }
.product-name { display: -webkit-box; -webkit-line-clamp: 2; padding-right: 52px; overflow-wrap: break-word; }
.Plugin_PriceInformation { margin-top: auto !important; }
.tp-card-historical-price, .tp-card-subline-row { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.price-availability a.col { min-width: 0 !important; }            /* subline+sparkline must not burst col */
```

Why: `min-width:auto` + long titles/sublines wrapped `.col` under the image,
and `align-items:stretch` then burst the whole row (90px → 300px+ voids).
Inner row must stay `column` or prices clip off-screen via card
`overflow:hidden`.

## 5. Integration contracts

- **Anchor:** `#tp-suite-filter-bar` as direct child of `#FrameContent`
  before `#Page_ListTopPriceReductionProducts` (or `#Page_Browsing` /
  `.f_browsingListContainer` / `#Plugin_MixedBrowsingList`). Never inside
  `.f_filter_plugin/.filters`/header (native `standard.js` AJAX wipes +
  backdrop traps). Immune to TimePeriod AJAX; observer re-processes new cards.
- **Observer:** scope to added/removed `.Plugin_Product`,
  `.Plugin_TopPriceReductionProductListFull/.standardList/.f_browsingListContainer/#product-list`,
  alarm modal, detail headers. Ignore `document.head` (DarkReader/fonts/ads)
  and in-card mutations (lazy images, badges). Guard with id checks /
  `dataset.processed`; debounce ~200ms.
- **Idempotent writes:** `setHtmlIfChanged/setTextIfChanged/setTitleIfChanged`,
  heat-key cache `card.dataset.tpAppliedHeat`, order-check before
  `append/insertBefore` — unconditional re-appends replay transitions, re-decode
  images, and loop the observer (the old ~200ms flicker).
- **Perf:** `textContent`, never `innerText` (forced reflow ×96 cards);
  memoize dealer rows/text/price per card; single `document.click` listener
  (floating CTA's `window._tpFloatingCtaDocBound` — the toolbar popover one
  died with the popover); null-check dual inputs before binding
  (range+number); flexbox inline labels, never absolute emoji icons in inputs;
  fixed overlays get `pointer-events:none` + `auto` only on controls; card
  buttons need `preventDefault+stopPropagation+stopImmediatePropagation`
  (anchors navigate otherwise); threshold counts via `dataset`, not stale
  closures.
- **Tests:** `mock_toppreise.html` mirrors production (2-col layout, tabs,
  TimePeriod radios, nested `.tabContent`, `.product-image`, `m_51_100`,
  both `data-current_url/-url`). Playwright needs
  `headers={'access-control-allow-origin':'*'}` on `file://` mocks;
  `input[type=checkbox]` inside `.tp-slider` asserts via `is_checked()`.

## 6. Native category engine + suite removal

Native exclusion is server-side (3 surfaces in §1, AJAX in §1); suite filtering
was client-side DOM hiding. Native breadcrumb segments each carry their own
`data-vcat-id` (per-level granularity) — the old "suite is more granular"
claim was wrong. No native-chip adapter: `👁️ N` counts suite filters only,
native bar shows its own count.

> **Removal (2026-09-30, kept verbatim):** Deleted the suite's client-side
> category engine (`src/domain/category.js`: `ROOT_SLUG_MAP`, `GROUP_EMOJIS`,
> `BRAND_RULES`, `resolveCategoryGroup`, `isPathExcluded`), the per-card
> quick-block button, the blocked-category chip drawer, and both taxonomy tools
> (`generate_category_map.py` — already dead code, its `CATEGORY_LOOKUP`
> injection target existed nowhere — and `verify_category_map.py`). Server-side
> native exclusion supersedes the client-side duplicate. Deliberately not built:
> no native-chip adapter feeding `👁️ N`. Stale storage `EXCLUDED_CATEGORIES` /
> `FILTER_CAT_ENABLED` lingers inert (JSON import whitelist auto-ignores).
> Follow-up: `applyCardFilters`/`isCardFilteredOut` moved to `src/page/cards.js`
> as shared imports; scanner builds explicit filters with real `pageHasOffers`.

## 7. Live gotchas (distilled)

1. Anchor cards → `closest('a[href]')`, never descendant-`a` queries.
2. Bar at `#FrameContent`, never `.f_filter_plugin`/header (AJAX wipe).
3. Dual-write storage (`GM_*` + `tp_suite_v2_*`); never per-card I/O —
   buffer + `flushDynamicMap()`.
4. Observer relevance-gate + idempotent setters, or self-trigger loop.
5. `textContent` not `innerText`; throttle prune; dedupe doc listeners.
6. Native `top:0;right:0` corner is taken — suite badges/buttons keep clear.
7. Pricechart: `nextElementSibling`/scoped-parent + regex, never
   `closest('.col-12')` on `.title.col-12`.
8. Feed has no offer counts — scanner needs explicit `pageHasOffers`;
   `0` weight is valid (`isNaN`, not `||`).

## 8. Product-page offers pipeline (live-probed 2026-10-08)

Product URL pattern `/preisvergleich/<Kat>/<Name>-p<PID>` (PID = `pcspagdpi`,
e.g. BELKIN SoundForm Mini 2 `p869380`). Static HTML (~294 KB) contains:

- **Zero** `.Plugin_DealerRelProdPriceInfo` rows — the dealer list renders via
  AJAX. The `<noscript>` inside `.Plugin_AuctionsOverview` is a 92-char
  placeholder, no data.
- JSON-LD, exactly 2 blocks: `BreadcrumbList` + `Product` with a single
  `AggregateOffer` (verbatim shape):

```json
{"@context":"https://schema.org","@type":"Product","brand":"Belkin","description":"…","gtin13":"…","image":"…","mpn":"…","name":"…","offers":{"@type":"AggregateOffer","highPrice":"82.00","lowPrice":"16.95","offerCount":6,"priceCurrency":"CHF"}}
```

  Correction 2026-10-09: per-offer sellers ARE in static HTML — the 10-08 probe
  searched catalog markup (`.Plugin_DealerRelProdPriceInfo`) and missed the
  product-page shape: `.Plugin_Offer` blocks (price-ascending, page 1) carrying
  `.Plugin_ShopLogo img[alt]` (= dealer) plus `.priceContainer.productPrice` /
  `.shippingPrice .Plugin_Price` per offer (verified live on 2 products, cheapest
  == JSON-LD `lowPrice`). Parsed by `parseProductOffers` + `pickCheapestOffer`
  (`src/features/share-discord.js`), cheapest on the card's price basis
  (min-selection, order-independent). `parseJsonLdOffer` stays last-resort count.
  Each block also links the shop directly: `a[href*="ext_de"]`
  (`/ext_de?pid=…&did=…&oid=…`, title + buy button; logo links `/shops/…` instead
  — not the offer). The dealer label uses it as its href (new tab, product-page
  fallback). Dealer + URL persist in `localStorage` (`tp_dealer_v1_<PID>`,
  p/s-slots per price basis, same TTL as price history, same janitor), so the
  label survives reloads; "Cache leeren" wipes them too.
- Offers endpoint (page JS, nothing inline): `POST
  /plugins/product/AuctionsOverview`, container `<div
  id="Plugin_AuctionsOverview_<instance>" data-context-hash="<hash>"
  data-ajax-url="/plugins/product/AuctionsOverview">`. Observed body carries
  timestamp-prefixed filter state (`<ts>_fi_opp_opp`, `data-ser-plgn-data` JSON
  in hidden inputs). Naive replay (all hidden inputs + ser-data, no session
  wiring) → `410 Gone`. Related: `POST /plugins/auction/AuctionTotalItems`
  (`…_fi_pidh_pid=<PID>&au_ati_ch=…&lang=de`), `POST
  /plugins/product/pricechart` (`pcspagdpi=<PID>&…&p_pc_ch=…&lang=de` — the
  suite's scanner route).
- Bot protection: default fetch/Chromium UA → `403` error page (~14 KB); real
  Chrome UA (`Chrome/126 …`) → `200`.
- Probes (scratch, not suite): `scratch/discord_live_check.py` +
  `scratch/share_probe.html` (real module import via local http,
  `--disable-web-security`), XHR capture `scratch/offers_xhr_sniff.py`.

Consequence: catalog cards → dealer name from DOM (`extractDealer`); feed
cards → dealer + count from the fetched product page (offer blocks, card price
basis), JSON-LD count only when blocks are absent. Fixture mirror of the live
`AggregateOffer` lives in `tests/mock_toppreise.html` `<head>`.

### Why history replays but offers don't need to

`pricechart` is a stateless data dump: PID (`pcspagdpi`, from the URL) + one
stable token → time series, no sellers by design. The suite's scanner replays
it freely. Sellers ride along in the static product HTML (`.Plugin_Offer`), so
feed shares parse them from the same fetch that already fetched the count —
no `AuctionsOverview` session replay, no standing maintenance item. (`AuctionsOverview`
itself stays a stateful UI plugin: naive replays answer `410 Gone`; still
deliberately not pursued — nothing needs it.)
