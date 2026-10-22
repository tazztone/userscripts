# Unified Tiefstpreis-Sortierung by badge %

Tiefstpreis-Sortierung (`CONFIG.BESTPREISE_MODE_ACTIVE`) previously segregated verified deals into artificial tiers: verified blend deals in `Tier 3` and verified fallback-tiefs (thin history / no median) in `Tier 2`. Because `b.tier - a.tier` was the primary comparator, fallback-tiefs with high discounts (e.g. `-81%`) were forced behind weak blend deals (e.g. `-29%`), contradicting the core premise that the feed sorts by the percentage displayed on the card badge (ADR-0005).

Now, all verified Tiefstpreise (both blend deals and fallback-tiefs) share a unified deal tier (`Tier 2`), sorted strictly by badge % (`badgePct`) descending. Unchecked/unavailable cards remain in `Tier 1` (preventing unverified site badges from outranking authentic verified deals), and verified markups remain in `Tier 0` (sunk to the bottom as negative percentages).

## Consequences

- `cards.js`: `getCardEffectiveDiscount(cd)` computes exact badge % for all cards (blend `weightedDiff`, fallback `vortiefDropPct` or site fallback, unverified site discount, or `-markup`).
- `sort.js`:
  - `CONFIG.BESTPREISE_MODE_ACTIVE`: evaluated as `tier = isDeal ? 2 : (usable ? 0 : 1)`, sorted by `(b.tier - a.tier) || (b.badgePct - a.badgePct) || (a.initialOrder - b.initialOrder)`.
  - `CONFIG.SORT_BY_OFFERS === 'discount-desc'`: consumes `getCardEffectiveDiscount(cd)` when `level` is null, giving fallback-tiefs their authentic verified drop in offer sorting too.
- `GLOSSARY.md`, `README.md`, `README.de.md`: documentation updated to reflect unified deal tier ranking by badge %.
