# Filter-Ansicht-Split (shipped)

## Filter-Ansicht-Split (shipped)

Filtern entfernt Karten (`display:none`), Ansicht malt nur (dim/heatmap/stripes/glow), 💎 sortiert nur.

Removal causes (5):
- Negativ-Terme
- Min-Angebote
- Händler (nicht Toppreis)
- Ungeprüfte (Nur geprüfte)
- Fallback-ausgeschlossen

👁️ peek stays as transient reveal-all (pure CSS override, no key).

`MODE` deleted with one-time migration toast; `DIM_OPACITY` survives as Ansicht status-dimmer.

See `docs/adr/0006-sort-only-feed-filter-global.md`.
