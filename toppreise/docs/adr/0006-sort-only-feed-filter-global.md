# Sort-only feed; filtering removes, view only paints

💎 Neue Tiefstpreise was filter+sort (`isBadDeal = MODE_ACTIVE && …`, `cards.js:270-271`), so search pages could never filter markups and hiding wore the name Anzeige. Now the split is strict: Filtern removes (`display:none`), Ansicht only paints (dim/heatmap/stripes/glow, never removes). 💎 only sorts the feed by Gewichtete Differenz; verified markups (Schlechte Deals) are never removed — badge marks them, sort puts them last. `MODE` (highlight/dim/hide) and `tp-reveal-all` are deleted; `DIM_OPACITY` survives as Ansicht status-dimmer.

## Consequences

- `cards.js`: `isBadDeal` cause deleted (no markup removal anywhere); removal causes are Negativ, Min-Angebote, Händler, Ungeprüfte, Fallback-ausgeschlossen; `displayHidden` becomes the plain removal predicate (no `MODE` read); `sort.js` keeps blend ranking for 💎-on, restore for 💎-off.
- Toolbar: 💎 stays in `tp-group-deals` (relabeled `Sortieren`, feed-only, tooltip sort-only); labels `Filter`→`Filtergründe`, `Ansicht` stays (now honest); sliders ⚖️/Ø/Pkt stay FEED-bar; `#timeframe-filter`-Evakuierung entfällt; 👁️ stays as peek-toggle for removed cards (transient, no key).
- `MODE` key deleted with all `tp-mode-*` branches; `hide`/`highlight` users get a one-time migrate toast like `migrateLegacyDebug`. `BESTPREISE_MODE_ACTIVE` key stays, old strict users get a toast.
- Supersedes the strictness rule in ADR-0002 and the dim-only freeze; heat/badge rules in ADR-0004/0005 unchanged.
