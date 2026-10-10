/**
 * Shared mini-toggle sync (single dialect for checkbox toggles with ON/OFF
 * caption and dimming of the tools they own). Imported by toolbar.js and
 * state/config.js — lives here because toolbar imports config (cycle).
 */

// Tools dimmed when their mini-toggle is OFF (the toggle itself stays bright).
export const DIM_TARGETS_BY_TOGGLE = {
  'tp-toggle-neg': ['.tp-input-field-box'],
  'tp-toggle-min': ['.tp-stepper-btn', '#tp-bar-min-val', '.tp-stepper-label'],
};

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
  for (const sel of (DIM_TARGETS_BY_TOGGLE[input.id] || [])) {
    scope?.querySelectorAll(sel).forEach(node => node.classList.toggle('tp-tool-dim', !enabled));
  }
}
