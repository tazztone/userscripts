/**
 * Badges barrel (split into ui/badges/ parts): every existing
 * `from './ui/badges.js'` path keeps working.
 */

import { setTextIfChanged, setHtmlIfChanged } from './badges/dom-helpers.js';
import { clearDealerMemory, clearDealerAutoTried } from './badges/deal-badge.js';
import { renderCardEffects, renderEmptyState } from './badges/card-chrome.js';

export { setTextIfChanged, setHtmlIfChanged, clearDealerMemory, clearDealerAutoTried, renderCardEffects, renderEmptyState };
