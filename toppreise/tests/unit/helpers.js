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
