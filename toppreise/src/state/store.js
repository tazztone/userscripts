/**
 * Runtime Session State Store
 * Tracks active scanner status and cancellation flags for reactive UI updates.
 */

export const scanState = {
  isBatchChecking: false,
  batchCancelRequested: false,
  currentlyScanningPid: null,
  singleScanningPids: new Set(),
  batchScanningPids: new Set(),
  progress: { completed: 0, total: 0 },
  freshPids: new Set(),
  freshUntil: 0
};

export function isScanningPid(pid) {
  return pid != null && (
    scanState.currentlyScanningPid === pid ||
    scanState.singleScanningPids.has(pid) ||
    scanState.batchScanningPids.has(pid)
  );
}
