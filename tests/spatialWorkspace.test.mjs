import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMaterialHandoff,
  calculateRoomMetrics,
  clampPin,
  formatMeasurement,
  measurementToInches,
  parseSpatialWorkspaceRecord,
  summarizeSpatialWorkspace,
} from '../lib/spatialWorkspace.ts';

const room = {
  title: 'Bathroom',
  roomType: 'Bathroom',
  measurements: [
    { id: '1', label: 'Room length', kind: 'length', totalInches: 120 },
    { id: '2', label: 'Room width', kind: 'width', totalInches: 144 },
    { id: '3', label: 'Ceiling height', kind: 'height', totalInches: 96 },
  ],
  notes: [
    { id: 'n1', text: 'Widen doorway', category: 'work', x: 42, y: 58 },
  ],
  createdAt: 1,
  updatedAt: 2,
};

test('spatial measurement helpers keep trusted field dimensions stable', () => {
  assert.equal(measurementToInches(10, 6), 126);
  assert.equal(formatMeasurement(126), '10\' 6"');
  assert.equal(clampPin(-20), 0);
  assert.equal(clampPin(120), 100);
});

test('room metrics derive area and volume only from explicit dimensions', () => {
  assert.deepEqual(calculateRoomMetrics(room.measurements), {
    length: 10,
    width: 12,
    height: 8,
    area: 120,
    volume: 960,
  });
});

test('material handoff and summary preserve spatial context', () => {
  const handoff = buildMaterialHandoff(room);
  assert.equal(handoff.projectName, 'Bathroom');
  assert.equal(handoff.measurements.area, 120);
  assert.match(summarizeSpatialWorkspace(room), /Widen doorway/);
});

test('saved spatial data is normalized before reuse', () => {
  const parsed = parseSpatialWorkspaceRecord({
    title: 'Hall',
    roomType: 'Hallway',
    measurements: [
      { id: 'm', label: 'Width', kind: 'width', totalInches: 48 },
      { id: 'bad', label: 'Bad', kind: 'width', totalInches: -5 },
    ],
    notes: [
      { id: 'n', text: 'Door', category: 'idea', x: 140, y: -8 },
    ],
    createdAt: 10,
    updatedAt: 20,
  });

  assert.ok(parsed);
  assert.equal(parsed.measurements.length, 1);
  assert.equal(parsed.notes[0].x, 100);
  assert.equal(parsed.notes[0].y, 0);
});
