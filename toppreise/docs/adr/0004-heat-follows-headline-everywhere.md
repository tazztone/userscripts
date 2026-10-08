# Heat follows the headlined badge number in every mode
> Headline rule superseded by ADR-0005 (badge shows the blend; heat/sort follow it).
Screenshot review found two cards showing the same `-51%` ribbon (and the
same `Ø → Score: 26` pill) with different card colors: one heated brown, one
dark gray. Root cause, three related defects sharing one violation of the
ADR-0002 invariant (color always = badge-%, text = kind):

1. Micro-records: a 1-cent fresh dip far below the median headlines the Ø-%
   (correct — micro-dips don't earn the Rekord headline) but the heat used
   the ≈0 record breakthrough, landing in the ±5% deadband → gray card under
   a `-51%` ribbon.
2. Ungated heat: the heat driver ignored the Tiefstpreise-mode history/score
   qualification, so unqualified histories rendered hot cards under plain-star
   (percent-less) badges.
3. Weight leak: the Ø-emphasis heat override applied globally, but the browse
   badge never switches its headline — with weight < 50% Rekord, browse cards
   heated Ø-level under Rekord ribbons.

## Consequences

- `getHeatInput` takes the badge branch inputs (`{ display, dealScore, mode,
  weightRecord }`) and returns the headlined `{ pct, kind }` alongside
  `{ value, provisional }`. `renderCardEffects` feeds both the card heat and
  the badge headline from that single computation — in each mode the heat
  follows that mode's own headline (feed emphasis per ADR-0003 untouched).
- Documented exceptions stay: ±5% deadband (tiny % prints but stays gray),
  markups (gray card, `+XX%` text), provisional paler, intensity scaling
  (badge now scales exactly like the card instead of fixed alphas).
- Badge recoloring is synced on every render, not only on heat-key change,
  so re-rendered badge nodes can't desync from the card.
- `extractCardDiff` never parses our own injected badge text as the site
  Differenz (guarded textContent fallback).
