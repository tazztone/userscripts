/**
 * Fresh-deal glow bookkeeping.
 * Marked pids stay for the tab session (until reload); user input never clears them.
 */

import { scanState } from '../state/store.js';

export function markFreshVerified(pid) {
  if (pid) scanState.freshPids.add(pid);
}
