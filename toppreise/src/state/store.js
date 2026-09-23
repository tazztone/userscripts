/**
 * Runtime Session State Store
 * Manages active scanner status, cancellation flags, filter count metrics,
 * and event subscription listeners for reactive UI updates.
 */

const scanState = {
  isBatchChecking: false,
  batchCancelRequested: false,
  isBestpreiseScanning: false,
  bestpreiseScanCancel: false,
  currentlyScanningPid: null,
  progress: { completed: 0, total: 0 }
};

let filterCounts = {
  neg: 0,
  cat: 0,
  min: 0,
  nonBest: 0,
  uncheckedDeals: 0,
  bestpreiseDeals: 0,
  bestpreiseHidden: 0
};

const listeners = new Set();

export function getScanState() {
  return { ...scanState };
}

export function setScanState(patch) {
  Object.assign(scanState, patch);
  notify('scan-state-changed', scanState);
}

export function getFilterCounts() {
  return { ...filterCounts };
}

export function setFilterCounts(counts) {
  filterCounts = { ...filterCounts, ...counts };
  notify('filter-counts-changed', filterCounts);
}

export function subscribe(listener) {
  if (typeof listener === 'function') {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  return () => {};
}

export function notify(event, data) {
  for (const listener of listeners) {
    try {
      listener(event, data);
    } catch (err) {
      console.warn('[Toppreise-Store] Error in subscriber', err);
    }
  }
}
