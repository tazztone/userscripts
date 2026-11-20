import { CONFIG } from '../../src/state/config.js';

export const DAY = 864e5;
export const HOUR = 36e5;

export function withConfig(k, v, fn) {
  const prev = CONFIG[k];
  CONFIG[k] = v;
  try {
    return fn();
  } finally {
    CONFIG[k] = prev;
  }
}

export function withConfigs(obj, fn) {
  const prev = {};
  for (const k of Object.keys(obj)) { prev[k] = CONFIG[k]; CONFIG[k] = obj[k]; }
  try {
    return fn();
  } finally {
    Object.assign(CONFIG, prev);
  }
}

export function createMockNode(tag = 'div', attrs = {}, text = '', children = []) {
  let classes = new Set(String(attrs.class || attrs.className || '').split(/\s+/).filter(Boolean));
  let _text = String(text ?? '');
  const attributes = { ...attrs };
  delete attributes.class;
  delete attributes.className;

  const el = {
    tagName: tag.toUpperCase(),
    id: attrs.id || '',
    children: [],
    parentElement: null,
    isConnected: true,
    title: attrs.title || '',
    href: attrs.href || '',
    style: {},
    dataset: {},
    get textContent() {
      if (el.children.length > 0) return el.children.map(c => c.textContent).join(' ');
      return _text;
    },
    set textContent(val) {
      _text = String(val ?? '');
    },
    get innerHTML() {
      return el.children.map(c => `<${c.tagName.toLowerCase()}${c.className ? ` class="${c.className}"` : ''}>${c.textContent}</${c.tagName.toLowerCase()}>`).join('');
    },
    set innerHTML(html) {
      el.children = [];
      const matches = [...String(html).matchAll(/<([a-z0-9]+)(?: class="([^"]*)")?>([^<]*)<\/\1>/gi)];
      for (const m of matches) {
        const child = createMockNode(m[1], { class: m[2] }, m[3]);
        child.parentElement = el;
        el.children.push(child);
      }
      _text = el.children.length > 0 ? el.children.map(c => c.textContent).join(' ') : String(html).replace(/<[^>]+>/g, '');
    },
    get className() {
      return [...classes].join(' ');
    },
    set className(val) {
      classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
    },
    classList: {
      add(...cls) { for (const c of cls) if (c) classes.add(c); },
      remove(...cls) { for (const c of cls) classes.delete(c); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        if (force !== undefined) {
          if (force) this.add(c); else this.remove(c);
          return force;
        }
        if (this.contains(c)) { this.remove(c); return false; }
        this.add(c); return true;
      }
    },
    setAttribute(k, v) { attributes[k] = String(v); el[k] = v; },
    getAttribute(k) { return attributes[k] ?? el[k] ?? null; },
    get firstElementChild() {
      return el.children[0] || null;
    },
    get nextElementSibling() {
      if (!el.parentElement) return null;
      const idx = el.parentElement.children.indexOf(el);
      return idx >= 0 && idx + 1 < el.parentElement.children.length ? el.parentElement.children[idx + 1] : null;
    },
    appendChild(child) {
      if (!child) return;
      child.parentElement = el;
      el.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      if (!child) return;
      child.parentElement = el;
      const idx = el.children.indexOf(ref);
      if (idx >= 0) el.children.splice(idx, 0, child);
      else el.children.push(child);
      return child;
    },
    after(sibling) {
      if (el.parentElement) el.parentElement.insertBefore(sibling, el.nextElementSibling);
    },
    replaceChildren(...nodes) {
      el.children = [];
      for (const n of nodes) el.appendChild(n);
    },
    remove() {
      if (el.parentElement) {
        const idx = el.parentElement.children.indexOf(el);
        if (idx >= 0) el.parentElement.children.splice(idx, 1);
        el.parentElement = null;
      }
    },
    _listeners: {},
    shadowRoot: null,
    attachShadow() {
      if (!el.shadowRoot) el.shadowRoot = createMockNode('shadow');
      return el.shadowRoot;
    },
    getElementById: id => el.querySelector(`#${id}`),
    addEventListener(type, fn) {
      (el._listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      if (el._listeners[type]) el._listeners[type] = el._listeners[type].filter(f => f !== fn);
    },
    querySelector: sel => {
      const pool = [...el.children];
      for (let i = 0; i < pool.length; i++) pool.push(...pool[i].children);
      const parts = sel.split(',').map(s => s.trim());
      for (const part of parts) {
        const lastPart = part.trim().split(/\s+/).pop();
        if (lastPart.startsWith('#')) {
          const id = lastPart.slice(1);
          const found = pool.find(c => c.id === id) || (el.id === id ? el : null);
          if (found) return found;
        } else if (lastPart.startsWith('.')) {
          const cls = lastPart.slice(1).split(/[\s.:>+]/)[0];
          const found = pool.find(c => c.classList.contains(cls)) || (el.classList.contains(cls) ? el : null);
          if (found) return found;
        } else {
          const tagMatch = lastPart.split(/[\s.:>+]/)[0].toLowerCase();
          const found = pool.find(c => c.tagName.toLowerCase() === tagMatch) || (el.tagName.toLowerCase() === tagMatch ? el : null);
          if (found) return found;
        }
      }
      return null;
    },
    querySelectorAll: sel => {
      const pool = [...el.children];
      for (let i = 0; i < pool.length; i++) pool.push(...pool[i].children);
      const parts = sel.split(',').map(s => s.trim());
      const results = [];
      for (const node of pool) {
        for (const part of parts) {
          const lastPart = part.trim().split(/\s+/).pop();
          if (lastPart.startsWith('.')) {
            const cls = lastPart.slice(1).split(/[\s.:>+[]/)[0];
            if (node.classList.contains(cls) && !results.includes(node)) results.push(node);
          } else if (lastPart.startsWith('#')) {
            const id = lastPart.slice(1);
            if (node.id === id && !results.includes(node)) results.push(node);
          } else {
            const tagMatch = lastPart.split(/[\s.:>+[]/)[0].toLowerCase();
            if (node.tagName.toLowerCase() === tagMatch && !results.includes(node)) results.push(node);
          }
        }
      }
      return results;
    }
  };

  for (const c of children) {
    el.appendChild(c);
  }

  return el;
}
