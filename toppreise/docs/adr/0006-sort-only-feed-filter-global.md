# Sort-only feed; filtering is global, display is dim-only

💎 Neue Tiefstpreise was filter+sort (`isBadDeal = MODE_ACTIVE && …`, `cards.js:270-271`), so search pages could never filter markups and the mode's meaning mixed ordering with hiding. Now 💎 only sorts the feed by Gewichtete Differenz (nothing hidden); Schlechter Deal, Fallback-Tief and Ungeprüfte are ordinary filter causes everywhere. Anzeige is dim-only: `MODE` freezes to `dim`, highlight/hide paths and `tp-reveal-all` are deleted.

## Consequences

- `cards.js` drops `MODE_ACTIVE &&` from `isBadDeal`; `displayHidden` collapses to false and its call sites go; `sort.js` keeps blend ranking for 💎-on, restore for 💎-off.
- Toolbar: 💎 stays in `tp-group-deals` (relabeled `Sortieren`, feed-only, tooltip sort-only); labels `Filter`→`Filtergründe`, `Ansicht`→`Anzeige`; sliders ⚖️/Ø/Pkt stay FEED-bar; `#timeframe-filter`-Evakuierung entfällt; 👁️ becomes counter-only; hide/highlight CSS (`styles.js`) and empty-state hide-gate + reveal handlers (`badges.js`) deleted.
- `MODE` key stays `dim` (no rename per ADR-0001, writes ignored); `hide`/`highlight` users get a one-time migrate toast like `migrateLegacyDebug`.
- `BESTPREISE_MODE_ACTIVE` key stays, old strict users get a toast.
- Supersedes the strictness rule in ADR-0002; heat/badge rules in ADR-0004/0005 unchanged.
