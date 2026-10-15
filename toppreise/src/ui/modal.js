/**
 * Settings modal orchestrator (split into modal-template/bindings/actions):
 * setupUI wires section inject -> elements -> collapse -> pairs -> actions.
 */

import { ensureSkeleton } from './shell.js';
import { ensureModalSection, initCollapse } from './modal-template.js';
import { collectModalElements, bindControlPairs } from './modal-bindings.js';
import { wireModalActions, openSettingsAt } from './modal-actions.js';

export function setupUI() {
  const { shadow } = ensureSkeleton();
  ensureModalSection(shadow);
  const els = collectModalElements(shadow);
  initCollapse(shadow);
  bindControlPairs(els);
  wireModalActions(els);
}

export { openSettingsAt };
