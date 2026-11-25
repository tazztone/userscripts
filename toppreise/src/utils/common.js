/**
 * Shared Pure Helpers
 * HTML escaping and bounded Map/Set utilities shared across UI and badge modules.
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

export function boundedMapSet(map, key, val, limit = 500) {
  map.set(key, val);
  while (map.size > limit) {
    map.delete(map.keys().next().value);
  }
}
