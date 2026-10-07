/**
 * Runtime Session State Store
 * Tracks active scanner status and cancellation flags for reactive UI updates.
 */

export const scanState = {
  isBatchChecking: false,
  batchCancelRequested: false,
  isBestpreiseScanning: false,
  bestpreiseScanCancel: false,
  currentlyScanningPid: null,
  progress: { completed: 0, total: 0 }
};
