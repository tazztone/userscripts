# Strictness lives in the mode; one color language
> Headline rule superseded by ADR-0005 (badge shows the blend; heat/sort follow it).
Screenshot review showed three defects sharing one root cause — two controls
(and two color systems) for one concept:

1. The toolbar `Nur Tiefstpreise` toggle (default ON) did nothing on fresh
   installs: outside the mode, hiding additionally required the modal
   `Nur echte Tiefstpreise filtern` toggle (default OFF). Two AND-ed toggles
   with opposite defaults = a control that usually does nothing.
2. Ribbons spoke two color languages: event-kind (emerald at-low, gold
   record, amber/rose markup, via classes) vs badge-% heat (via inline
   style, winning when present). A -3% at-low glowed the same green as -60%.
3. Badge HTML and card heat could desync: the mode non-deal branch preserved
   stale badge HTML while the heat-removal path stripped heat (e.g. after a
   refresh landed on minimal HTML-fallback stats without median).

## Consequences

- Strictness = mode, one control: `💎 Neue Tiefstpreise` an = nur
  Tiefstpreise, aus = alles zeigen (badges stay truthful). Both the toolbar
  toggle and its modal twin are removed; `FILTER_BESTPREIS_ENABLED` and
  `REAL_DEAL_FILTER_ACTIVE` stay as dormant storage keys (never renamed).
  Behavior delta is explicit: outside the mode, above-low cards always show
  with `Aufschlag +XX%` (default users see no change — nothing was hidden
  for them anyway); inside the mode it is always strict (the old hole where
  the toolbar toggle could defuse the mode is closed).
- One rule for color: color always = badge-% heat, text always = kind.
  Event-kind classes stay as logic hooks but no longer paint; markups stay
  neutral gray with `+XX%` text (as the legend always promised).
- Every badge branch repaints from current stats — no HTML preservation —
  and the stats cache is upgrade-only (median-bearing entries are never
  replaced by median-less fallback stats). A DEBUG tripwire logs if heat is
  ever stripped while a verified badge is present, so the original trigger
  can still be caught live. Unavailable-markers keep current semantics
  (2h negative TTL bounds them; they render a consistent loupe + no-heat).
- OFF mini-toggles are gray and dim their tool (input/stepper stay editable).
