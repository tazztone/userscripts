/**
 * Shared Pure Helpers
 * HTML escaping and bounded Set utilities shared across UI and badge modules.
 */

export const escapeHtml = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function boundedSetAdd(set, key, limit = 500) {
  set.add(key);
  while (set.size > limit) {
    set.delete(set.values().next().value);
  }
}
