import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScanMeasurement,
  createScanState,
  currentScanStep,
  isScanComplete,
  recordScanMeasurement,
  redoScan,
  scanProgressLabel,
  skipScanStep,
  undoScan,
} from '../lib/spatialScan.ts';

test('guided scan records length, width and height in order with progress', () => {
  let state = createScanState();
  const kinds = [];
  const inches = [144, 120, 96];
  for (const value of inches) {
    assert.match(scanProgressLabel(state), /^Step [123] of 3$/);
    const measurement = buildScanMeasurement(state, `m-${value}`, value);
    kinds.push(measurement.kind);
    assert.equal(measurement.source, 'webxr-hit-test');
    state = recordScanMeasurement(state, measurement);
  }
  assert.deepEqual(kinds, ['length', 'width', 'height']);
  assert.equal(isScanComplete(state), true);
  assert.equal(scanProgressLabel(state), 'Step 3 of 3');
  assert.equal(buildScanMeasurement(state, 'x', 1), null);
  assert.equal(recordScanMeasurement(state, { id: 'y' }), state);
});

test('skip, undo and redo move through the scan without losing measurements', () => {
  let state = createScanState();
  assert.equal(scanProgressLabel(state), 'Step 1 of 3');
  assert.equal(undoScan(state), null);
  assert.equal(redoScan(state), null);

  const length = buildScanMeasurement(state, 'len', 100);
  state = recordScanMeasurement(state, length);
  state = skipScanStep(state);
  assert.equal(currentScanStep(state).kind, 'height');

  let undone = undoScan(state);
  assert.equal(undone.removed, null);
  state = undone.state;
  assert.equal(currentScanStep(state).kind, 'width');

  undone = undoScan(state);
  assert.equal(undone.removed.id, 'len');
  state = undone.state;
  assert.equal(currentScanStep(state).kind, 'length');

  const redone = redoScan(state);
  assert.equal(redone.restored.id, 'len');
  assert.equal(currentScanStep(redone.state).kind, 'width');

  const fresh = recordScanMeasurement(undone.state, buildScanMeasurement(undone.state, 'new', 90));
  assert.equal(redoScan(fresh), null, 'a new measurement clears the redo history');
});
