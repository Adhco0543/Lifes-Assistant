import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMaterialHandoff,
  calculateRoomMetrics,
  clampPin,
  formatMeasurement,
  isSafeSpatialImageDataUrl,
  measurementToInches,
  persistSpatialItem,
  placeSpatialItem,
  spatialItemsOverlap,
  parseSpatialMaterialHandoff,
  parseSpatialWorkspaceRecord,
  summarizeSpatialWorkspace,
} from '../lib/spatialWorkspace.ts';
import { boxCornersInWorld, distanceInMeters, metersToInches } from '../lib/webxrSpatial.ts';
import nextConfig from '../next.config.ts';

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
  items: [],
  createdAt: 1,
  updatedAt: 2,
};

test('spatial measurement helpers keep trusted field dimensions stable', () => {
  assert.equal(measurementToInches(10, 6), 126);
  assert.equal(formatMeasurement(126), '10\' 6"');
  assert.equal(formatMeasurement(23.999), '2\' 0"');
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

test('room metrics use the newest recorded value when a dimension is measured again', () => {
  assert.equal(calculateRoomMetrics([
    { id: 'old', label: 'Length', kind: 'length', totalInches: 120 },
    { id: 'new', label: 'Length AR', kind: 'length', totalInches: 180, source: 'webxr-hit-test' },
  ]).length, 15);
});

test('material handoff and summary preserve spatial context', () => {
  const handoff = buildMaterialHandoff(room);
  assert.equal(handoff.projectName, 'Bathroom');
  assert.equal(handoff.measurements.area, 120);
  assert.match(summarizeSpatialWorkspace(room), /Widen doorway/);
});

test('room items are placed inside measured bounds and carried into workspace handoffs', () => {
  const placed = placeSpatialItem({
    id: 'vanity',
    label: 'Vanity',
    category: 'fixture',
    widthInches: 30,
    depthInches: 21,
  }, 0, 0, 120, 144);
  assert.deepEqual(placed, {
    id: 'vanity',
    label: 'Vanity',
    category: 'fixture',
    widthInches: 30,
    depthInches: 21,
    xInches: 0,
    yInches: 0,
  });
  assert.equal(placeSpatialItem({
    id: 'oversized', label: 'Island', category: 'furniture', widthInches: 150, depthInches: 36,
  }, 60, 72, 120, 144), null);
  assert.equal(spatialItemsOverlap(placed, {
    id: 'nearby', label: 'Cabinet', category: 'cabinet', xInches: 30, yInches: 0, widthInches: 24, depthInches: 21,
  }), false);
  assert.equal(spatialItemsOverlap(placed, {
    id: 'overlap', label: 'Cabinet', category: 'cabinet', xInches: 29, yInches: 0, widthInches: 24, depthInches: 21,
  }), true);

  const plan = { ...room, items: [placed] };
  assert.match(summarizeSpatialWorkspace(plan), /Vanity \(fixture, 2' 6" × 1' 9" footprint at/);
  assert.ok(buildMaterialHandoff(plan).notes.some((note) => /Planned fixture: Vanity/.test(note)));
  assert.equal(parseSpatialMaterialHandoff(buildMaterialHandoff(plan)).layoutItems[0].label, 'Vanity');
});

test('AR item boxes use hit-pose transforms and do not persist session-only positions', () => {
  const box = {
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1],
    widthMeters: 2,
    heightMeters: 3,
    depthMeters: 4,
    category: 'cabinet',
  };
  assert.deepEqual(boxCornersInWorld(box)[0], { x: 9, y: 20, z: 28 });
  assert.equal(boxCornersInWorld({ ...box, transform: [1, 2] }).length, 0);

  const item = {
    id: 'cabinet', label: 'Cabinet', category: 'cabinet',
    xInches: 12, yInches: 24, widthInches: 24, depthInches: 24,
    arTransform: box.transform,
  };
  assert.equal('arTransform' in persistSpatialItem(item), false);
});

test('WebXR point distances convert meters to inches and mark estimates in handoffs', () => {
  assert.equal(distanceInMeters({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 1);
  assert.equal(metersToInches(1), 39.37);
  assert.equal(metersToInches(Number.NaN), 0);

  const arRoom = {
    ...room,
    measurements: [
      { id: 'ar-1', label: 'Room length', kind: 'length', totalInches: 120, source: 'webxr-hit-test' },
      ...room.measurements.slice(1),
    ],
  };
  assert.match(summarizeSpatialWorkspace(arRoom), /AR estimate; verify on site/);
  const arHandoff = buildMaterialHandoff(arRoom);
  assert.match(arHandoff.measurementWarning, /verify them with a tape/i);
  assert.ok(arHandoff.notes.some((note) => /verify all dimensions on site/i.test(note)));
  assert.match(parseSpatialMaterialHandoff(arHandoff).measurementWarning, /AR estimates/);
});

test('the app permits same-origin WebXR spatial tracking sessions', async () => {
  const rules = await nextConfig.headers();
  const policy = rules.flatMap((rule) => rule.headers)
    .find((header) => header.key.toLowerCase() === 'permissions-policy');
  assert.equal(policy?.value, 'xr-spatial-tracking=(self)');
});

test('saved spatial data is normalized before reuse', () => {
  const parsed = parseSpatialWorkspaceRecord({
    title: 'Hall',
    roomType: 'Hallway',
    measurements: [
      { id: 'm', label: 'Width', kind: 'width', totalInches: 48, source: 'webxr-hit-test' },
      { id: 'bad', label: 'Bad', kind: 'width', totalInches: -5 },
    ],
    notes: [
      { id: 'n', text: 'Door', category: 'idea', x: 140, y: -8 },
    ],
    items: [
      { id: 'cabinet', label: 'Base cabinet', category: 'cabinet', xInches: -5, yInches: 11, widthInches: 24, depthInches: 24, heightInches: 34 },
      { id: 'invalid', label: 'No footprint', category: 'fixture', xInches: 0, yInches: 0, widthInches: 0, depthInches: 24 },
    ],
    createdAt: 10,
    updatedAt: 20,
  });

  assert.ok(parsed);
  assert.equal(parsed.measurements.length, 1);
  assert.equal(parsed.measurements[0].source, 'webxr-hit-test');
  assert.equal(parsed.notes[0].x, 100);
  assert.equal(parsed.notes[0].y, 0);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].widthInches, 24);
  assert.equal(parsed.items[0].heightInches, 34);
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
