/**
 * Styles barrel (split into ui/styles/ parts): composes the document
 * stylesheet; app.js and shell.js imports stay untouched.
 */

import { TP_TOKEN_VARS } from './styles/tokens.js';
import { STYLES_CARDS } from './styles/cards.js';
import { STYLES_CHROME } from './styles/chrome.js';
import { STYLES_OVERLAYS } from './styles/overlays.js';
import { SHADOW_MODAL_STYLES } from './styles/shadow-modal.js';

export const STYLES = STYLES_CARDS + STYLES_CHROME + STYLES_OVERLAYS;
export { TP_TOKEN_VARS, SHADOW_MODAL_STYLES };
