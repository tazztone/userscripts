# UI vocabulary and contextual placement

The suite toolbar packed ~8 controls into one row while UI strings ran three vocabularies at once (`REAL_DEAL_*` keys, `Deal-Filter`/`Check Deals`/`Site-%` labels, `Real Deal` badges). We decided: user-facing language follows `GLOSSARY.md` (Tiefstpreis, Differenz (ungeprüft), Prüfen; Toppreis for the native cheapest-offer highlight), code identifiers (`REAL_DEAL_*`, `BESTPREISE_*`, `tp-deal-*`, GM storage keys) stay as legacy mapping, and controls live where they are used — toolbar keeps filtering + view, the verify action lives in the floating CTA and on-card loupes.

## Consequences

Storage keys must never be renamed without a migration (users lose settings on update). Full code-identifier rename deferred — **REVISIT**: cheap while the mapping is documented here, expensive the moment new code learns the old names. No coachmark and no walkthrough test by decision (Q6/Q9): the renamed UI must be self-explanatory; if it needs explaining, that is a defect in the rename.
