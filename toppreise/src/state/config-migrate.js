/**
 * Config one-time migrations (split from state/config.js).
 * Storage helpers live in ./config-store.js; side effects run once at import.
 */

import { _getValue, _setValue, DEFAULTS } from './config-store.js';

// One-time migration: DEBUG default flipped true→false, but stored true
// persists via _getValue precedence. No settings UI ever wrote DEBUG
// (modal import/export skips it), so stored true came only from console —
// silence it once. Marker keeps this a single read per load afterwards.
export function migrateLegacyDebug() {
  if (_getValue('MIGRATED_DEBUG_OFF', false)) return false;
  _setValue('DEBUG', false);
  _setValue('MIGRATED_DEBUG_OFF', true);
  return true;
}
// One-time migration: filter-mode defaults flipped hide→dim. Stored 'hide'
// (silent default or explicit choice) moves to 'dim' once; the toggle stays
// one click away. Marker keeps this a single pass per profile afterwards.
export function migrateHideToDimDefaults() {
  if (_getValue('MIGRATED_DIM_DEFAULT', false)) return false;
  for (const k of ['FILTER_NEG_MODE', 'FILTER_MIN_MODE', 'HIDE_UNCHECKED_MODE', 'VORTIEF_MODE', 'DEALER_MODE']) {
    if (_getValue(k, DEFAULTS[k]) !== 'dim') _setValue(k, 'dim');
  }
  _setValue('MIGRATED_DIM_DEFAULT', true);
  return true;
}
// One-time migration: single DISCORD_WEBHOOK_URL migrated to DISCORD_CHANNELS
export function migrateDiscordChannels() {
  if (_getValue('MIGRATED_DISCORD_CHANNELS', false)) return false;
  const channels = _getValue('DISCORD_CHANNELS', null);
  const legacyHook = (_getValue('DISCORD_WEBHOOK_URL', '') || '').trim();
  if ((!channels || (Array.isArray(channels) && channels.length === 0)) && legacyHook) {
    _setValue('DISCORD_CHANNELS', [{ id: 'default', name: 'Standard', url: legacyHook }]);
  }
  _setValue('MIGRATED_DISCORD_CHANNELS', true);
  return true;
}
migrateHideToDimDefaults();
migrateLegacyDebug();
migrateDiscordChannels();
// One-time migration: MODE (highlight/dim/hide) deleted — Filtern removes,
// Ansicht paints. Clears the stale stored key once so the mode toast fires
// exactly once per user (marker-guarded, silent afterwards). The 'MODE'
// literals below are that intentional cleanup — exempt from the MODE-zero sweep.
export function migrateFilterSplit() {
  if (_getValue('MIGRATED_FILTER_SPLIT', false)) return { hadMode: false, modeWasActive: false };
  let storedMode;
  let hadMode = false;
  if (typeof GM_getValue !== 'undefined') {
    try {
      storedMode = GM_getValue('MODE');
      if (typeof storedMode !== 'undefined') hadMode = true;
    } catch { /* ignore */ }
  }
  if (!hadMode) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('tp_suite_v2_MODE') !== null) hadMode = true;
    } catch { /* ignore */ }
  }
  const modeWasActive = _getValue('BESTPREISE_MODE_ACTIVE', false) === true;
  try {
    if (typeof GM_deleteValue !== 'undefined') GM_deleteValue('MODE');
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('tp_suite_v2_MODE');
  } catch { /* ignore */ }
  _setValue('MIGRATED_FILTER_SPLIT', true);
  return { hadMode, modeWasActive };
}
