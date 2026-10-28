import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNativeRoomScan, roomScanToMeasurements } from '../lib/nativeRoomScan.ts';

const validScan = () => ({
  version: 1,
  source: 'apple-roomplan',
  scanId: 'scan-123',
  roomLengthInches: 192,
  roomWidthInches: 144,
  ceilingHeightInches: 96,
  items: [{
    id: 'object-1',
    label: 'Refrigerator',
    category: 'appliance',
    xInches: 24,
    yInches: 18,
    widthInches: 36,
    depthInches: 30,
    heightInches: 72,
    source: 'roomplan',
  }],
});

test('native RoomPlan scans import dimensions and removable measured-space items', () => {
  const parsed = parseNativeRoomScan(validScan());
  assert.ok(parsed);
  assert.deepEqual(parsed.items[0], {
    id: 'object-1',
    label: 'Refrigerator',
    category: 'appliance',
    xInches: 24,
    yInches: 18,
    widthInches: 36,
    depthInches: 30,
    heightInches: 72,
    source: 'roomplan',
  });
  assert.deepEqual(roomScanToMeasurements(parsed, 123), [
    { id: 'roomplan-scan-123-123-length', label: 'Scanned room length', kind: 'length', totalInches: 192, source: 'roomplan' },
    { id: 'roomplan-scan-123-123-width', label: 'Scanned room width', kind: 'width', totalInches: 144, source: 'roomplan' },
    { id: 'roomplan-scan-123-123-height', label: 'Scanned ceiling height', kind: 'height', totalInches: 96, source: 'roomplan' },
  ]);
});

test('native RoomPlan bridge rejects unsupported, non-finite, and out-of-room scan data', () => {
  assert.equal(parseNativeRoomScan(null), null);
  assert.equal(parseNativeRoomScan({ ...validScan(), source: 'other' }), null);
  assert.equal(parseNativeRoomScan({ ...validScan(), roomLengthInches: Infinity }), null);
  assert.equal(parseNativeRoomScan({
    ...validScan(),
    items: [{ ...validScan().items[0], xInches: 170 }],
  }), null);
  assert.equal(parseNativeRoomScan({ ...validScan(), items: Array(101).fill(validScan().items[0]) }), null);
});
