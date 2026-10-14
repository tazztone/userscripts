# Filter-Ansicht-Split (shipped)

## Filter-Ansicht-Split (shipped)

Bar-Gruppen: Filter (blendet aus) / Ansicht (entfernt nichts) / Sortieren (💎-Button plus Rechen-Slider ⚖️/Ø/Pkt, per Border getrennt).

Removal causes (5):
- Negativ-Terme
- Min-Angebote
- Händler (nicht Toppreis)
- Ungeprüfte
- Fallback-ausgeschlossen

👁️ peek stays as transient reveal-all (pure CSS override, no key).

`MODE` deleted with one-time migration toast; `DIM_OPACITY` survives as Ansicht status-dimmer.

See `docs/adr/0006-sort-only-feed-filter-global.md`.
