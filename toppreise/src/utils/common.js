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

export function openTabUrl(url, { active = false } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (typeof GM_openInTab === 'function') {
    try {
      GM_openInTab(url, { active: !!active, insert: true });
      return true;
    } catch {}
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      const w = window.open(url, '_blank', 'noopener');
      return !!w;
    } catch {
      return false;
    }
  }
  return false;
}
