/**
 * DOM & URL Sanitization for Imported HTML Fragments
 * Strips unsafe tags (including <style>), inline event handlers, and dangerous URL schemes.
 */

const UNSAFE_IMPORT_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'style']);
const URL_ATTRIBUTES = new Set([
  'href', 'src', 'srcset', 'action', 'formaction', 'poster',
  'xlink:href', 'data-ajax-url', 'data-ajax-form-url'
]);
const BLOCKED_URL_SCHEME = /^(?:javascript|vbscript|data):/i;
const stripControlChars = value => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '');

export function isSafeImportedUrl(value, { srcset = false } = {}) {
  const cleaned = stripControlChars(value);
  if (!srcset) return !BLOCKED_URL_SCHEME.test(cleaned.replace(/\s+/g, ''));
  return cleaned.split(',').every(part => {
    const candidate = part.trim().split(/\s+/)[0] || '';
    return !candidate || !BLOCKED_URL_SCHEME.test(candidate);
  });
}

export function sanitizeImportedNode(root) {
  if (!root || root.nodeType !== 1) return root;
  if (UNSAFE_IMPORT_TAGS.has(root.tagName?.toLowerCase())) return null;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    const tag = node.tagName?.toLowerCase();
    if (UNSAFE_IMPORT_TAGS.has(tag)) {
      node.remove();
      continue;
    }
    for (const attr of Array.from(node.attributes || [])) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') {
        node.removeAttribute(attr.name);
      } else if (URL_ATTRIBUTES.has(name) && !isSafeImportedUrl(attr.value, { srcset: name === 'srcset' })) {
        node.removeAttribute(attr.name);
      }
    }
    // querySelectorAll does not enter template content, so walk it explicitly.
    if (tag === 'template' && node.content) {
      for (const child of Array.from(node.content.children)) stack.push(child);
    }
    for (const child of Array.from(node.children || [])) stack.push(child);
  }
  return root;
}
