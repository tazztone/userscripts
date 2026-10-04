# Headline emphasis follows the sort weight; no triple numbers

With the weight at 100% Ø the feed ranked by Ø-ersparnis while ribbons and
card colors still shouted record numbers (sort hierarchy vs color hierarchy
disagreed), and each card printed the same number up to three times
(ribbon, `Ø: -59% → Score: 59`, hist-line suffix).

## Consequences

- Emphasis, not just order, follows the weight — but the ribbon number
  always matches its color (the deeper invariant from 0002): below 50%
  Rekord the badge headline is the Ø-% and the heat is the Ø-level; at or
  above 50% it is the record event (status quo, default untouched).
  At-low cards (no record) are unchanged everywhere.
- No event truth is buried: the breakdown pill always shows the Rek/Ø
  split, the factual `tp-deal-new-record` class stays, and tooltips name
  the emphasis (`Ø-Emphase: Badge = Ø-Rabatt … (Rekord … steht in der Pille)`).
- Dedup: `→ Score:` prints only when the score differs from every shown
  input (under 100% Ø it equals Ø by construction); hist lines keep the
  CHF anchor + horizon but lose the third `%` copy (`Bisher: CHF x`,
  `Ø-Preis (1J): CHF y`). Ribbon (headline + heat), breakdown (formula
  when non-trivial), hist line (CHF anchor) each keep exactly one job.
- All "nur Sortierung" strings are retired: weight = Reihenfolge +
  Farb-Emphase. The `getHeatInput`/`getHeatmapStyles` unit invariants are
  untouched — emphasis lives in the render layer (`renderCardEffects`
  chooses which verified number feeds badge + heat).
