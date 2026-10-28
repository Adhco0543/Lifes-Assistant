import type { SpatialMeasurement, SpatialMeasurementKind } from './spatialWorkspace';

export type ScanStep = {
  kind: Extract<SpatialMeasurementKind, 'length' | 'width' | 'height'>;
  label: string;
  instruction: string;
};

export const SCAN_STEPS: readonly ScanStep[] = [
  { kind: 'length', label: 'Room length', instruction: 'Set a point at each end of the longest wall.' },
  { kind: 'width', label: 'Room width', instruction: 'Set a point at each end of the shorter wall.' },
  { kind: 'height', label: 'Ceiling height', instruction: 'Set a point on the floor, then one on the ceiling.' },
];

export type ScanEntry = { step: number; measurement: SpatialMeasurement | null };
export type ScanState = { step: number; done: ScanEntry[]; undone: ScanEntry[] };

export function createScanState(): ScanState {
  return { step: 0, done: [], undone: [] };
}

export function isScanComplete(state: ScanState): boolean {
  return state.step >= SCAN_STEPS.length;
}

export function currentScanStep(state: ScanState): ScanStep | null {
  return SCAN_STEPS[state.step] || null;
}

export function scanProgressLabel(state: ScanState): string {
  return `Step ${Math.min(state.step + 1, SCAN_STEPS.length)} of ${SCAN_STEPS.length}`;
}

function advance(state: ScanState, measurement: SpatialMeasurement | null): ScanState {
  if (isScanComplete(state)) return state;
  return {
    step: state.step + 1,
    done: [...state.done, { step: state.step, measurement }],
    undone: [],
  };
}

/** Builds the measurement for the current step, or null when the scan is finished. */
export function buildScanMeasurement(
  state: ScanState,
  id: string,
  totalInches: number
): SpatialMeasurement | null {
  const step = currentScanStep(state);
  if (!step) return null;
  return { id, label: step.label, kind: step.kind, totalInches, source: 'webxr-hit-test' };
}

export function recordScanMeasurement(state: ScanState, measurement: SpatialMeasurement): ScanState {
  return advance(state, measurement);
}

export function skipScanStep(state: ScanState): ScanState {
  return advance(state, null);
}

export function undoScan(state: ScanState): { state: ScanState; removed: SpatialMeasurement | null } | null {
  const last = state.done[state.done.length - 1];
  if (!last) return null;
  return {
    state: { step: last.step, done: state.done.slice(0, -1), undone: [...state.undone, last] },
    removed: last.measurement,
  };
}

export function redoScan(state: ScanState): { state: ScanState; restored: SpatialMeasurement | null } | null {
  const next = state.undone[state.undone.length - 1];
  if (!next) return null;
  return {
    state: { step: next.step + 1, done: [...state.done, next], undone: state.undone.slice(0, -1) },
    restored: next.measurement,
  };
}
