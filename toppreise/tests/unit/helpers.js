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
