import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMaterialHandoff,
  calculateRoomMetrics,
  clampPin,
  formatMeasurement,
  isSafeSpatialImageDataUrl,
  measurementToInches,
  parseSpatialMaterialHandoff,
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

test('saved records reject invalid roots and only retain bounded image data', () => {
  assert.equal(parseSpatialWorkspaceRecord([]), null);
  assert.equal(isSafeSpatialImageDataUrl('data:image/jpeg;base64,aGVsbG8='), true);
  assert.equal(isSafeSpatialImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isSafeSpatialImageDataUrl('data:image/jpeg;base64,' + 'a'.repeat(450_001)), false);

  const withPhoto = parseSpatialWorkspaceRecord({
    title: 'Bathroom',
    imageDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
    measurements: [{ id: 'long', label: 'Long wall', kind: 'length', totalInches: 1e100 }],
  });
  assert.equal(withPhoto?.imageDataUrl, 'data:image/jpeg;base64,aGVsbG8=');
  assert.equal(withPhoto?.measurements[0].totalInches, 1_000_000);

  const withInvalidPhoto = parseSpatialWorkspaceRecord({
    title: 'Kitchen',
    imageDataUrl: 'data:text/html;base64,PHNjcmlwdD4=',
    measurements: [["not", "a", "record"]],
    notes: [["not", "a", "record"]],
  });
  assert.equal(withInvalidPhoto?.imageDataUrl, undefined);
  assert.deepEqual(withInvalidPhoto?.measurements, []);
  assert.deepEqual(withInvalidPhoto?.notes, []);
});

test('material handoff validates imported numbers before applying dimensions', () => {
  assert.equal(parseSpatialMaterialHandoff([]), null);
  assert.equal(parseSpatialMaterialHandoff({ measurements: { length: '12' } }), null);

  assert.deepEqual(parseSpatialMaterialHandoff({
    projectName: '  Hallway  ',
    measurements: {
      length: 8,
      width: Number.NaN,
      height: Number.POSITIVE_INFINITY,
      area: -1,
      volume: 64,
    },
  }), {
    projectName: 'Hallway',
    measurements: { length: 8, volume: 64 },
  });
});
