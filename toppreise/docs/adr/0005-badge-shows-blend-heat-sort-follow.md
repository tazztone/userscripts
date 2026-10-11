# Badge shows the blend; heat and sort follow it

The feed showed two competing numbers — a Rek/Ø headline on the ribbon versus a blended score that sorted (as tiebreak) and appeared in a second subline — which users read as a contradiction (ribbon `-7%` vs `Score: 15` on the same card). Now one metric, the **Gewichtete Differenz** (weight-blended Ø-discount + record-margin at the current slider mix), prints on the ribbon, drives card heat and feed sort, while Rek/Ø survive only as a consolidated split in a single merged subline; the percent-less star fallback and the `Rekord`/`Ø-Preis` ribbon kind words are gone. This supersedes the headline rule in ADR-0002–0004 (color = badge-% and emphasis-follows-weight now resolve to the blend, not a picked headline).

## Consequences

- `getHeatInput()` takes the already-computed blend (or computes it) and
  returns `{ value, provisional, pct, kind: 'blend' }`; `renderCardEffects`
  feeds card heat and badge headline from that single computation — in each
  mode heat follows that mode's own badge number (ADR-0004 invariant kept,
  driver simplified to the blend).
- Documented exceptions stay: ±5% deadband (tiny blend prints but stays
  gray, decided on the raw blend), markups (gray card, `+XX%` text),
  no-blend fallback (Vortief-Abstand + inset edge glow only, never full wash).
- Feed sorts blend ↓ (`sort.js`); event-kind classes stay as logic hooks but
  no longer paint; `Rekord`/`Ø-Preis` ribbon kind words and the `→ Score:`
  subline suffix are deleted.
