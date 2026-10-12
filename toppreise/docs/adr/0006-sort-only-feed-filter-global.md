# Sort-only feed; filtering is global

💎 Neue Tiefstpreise was filter+sort (`isBadDeal = MODE_ACTIVE && …`, `cards.js:270-271`), so search pages could never filter markups and the mode's meaning mixed ordering with hiding. Now 💎 only sorts the feed by Gewichtete Differenz (nothing hidden); Schlechter Deal, Fallback-Tief and Ungeprüfte are ordinary filter causes everywhere and follow Anzeige, and ⚖️/Ø/Pkt parametrize the shared number.

## Consequences

- `cards.js` drops `MODE_ACTIVE &&` from `isBadDeal`; `sort.js` keeps blend ranking for 💎-on, restore for 💎-off.
- Toolbar regions: Sort (💎) · Filter (Negativ, Nur geprüfte, Min-Angebote, Fallback+Pkt, 👁️) · View (Heatmap) · Daten/Berechnung (⚖️, Ø, Pkt-Schwelle als Eingaben der Zahl, keine Sort/Filter). Feed zeigt alle Regionen, Suche Filter+View in Leiste und Daten nur im Modal, Detail keine Leiste; `#timeframe-filter`-Evakuierung entfällt.
- `BESTPREISE_MODE_ACTIVE` key stays (no rename per ADR-0001), old strict users get a toast.
- Supersedes the strictness rule in ADR-0002; heat/badge rules in ADR-0004/0005 unchanged.
