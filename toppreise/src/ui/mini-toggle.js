/**
 * Shared mini-toggle sync (single dialect for checkbox toggles with ON/OFF
 * caption). Imported by toolbar.js and state/config.js — lives here because
 * toolbar imports config (cycle).
 */

export function syncMiniToggle(input, enabled, titleBase) {
  if (!input) return;
  input.checked = !!enabled;
  const label = input.closest?.('.tp-mini-switch');
  const title = `${titleBase} ${enabled ? 'AN' : 'AUS'}`;
  if (label) label.title = title;
  const state = label?.querySelector('.tp-mini-state');
  if (state) state.textContent = enabled ? 'ON' : 'OFF';
  const scope = input.closest?.('.tp-bar-stepper-group, .tp-threshold-wrapper, .tp-input-wrapper, .tp-group');
  const caption = scope?.querySelector('.tp-mini-caption');
  if (caption) caption.title = title;
}
