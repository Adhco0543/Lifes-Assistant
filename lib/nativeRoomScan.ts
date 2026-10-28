import type { SpatialItem, SpatialMeasurement } from './spatialWorkspace';

export type NativeRoomScanItem = Omit<SpatialItem, 'arTransform'>;

export type NativeRoomScan = {
  version: 1;
  source: 'apple-roomplan';
  scanId: string;
  roomLengthInches: number;
  roomWidthInches: number;
  ceilingHeightInches: number;
  items: NativeRoomScanItem[];
};

const ITEM_CATEGORIES = new Set<SpatialItem['category']>([
  'cabinet', 'appliance', 'fixture', 'furniture', 'opening', 'custom',
]);

const numberInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** Validates native bridge data before it can enter the room workspace or be saved. */
export function parseNativeRoomScan(value: unknown): NativeRoomScan | null {
  if (!isObject(value) || value.version !== 1 || value.source !== 'apple-roomplan') return null;
  if (typeof value.scanId !== 'string' || !/^[\w-]{1,80}$/.test(value.scanId)) return null;
  if (!numberInRange(value.roomLengthInches, 12, 2400)) return null;
  if (!numberInRange(value.roomWidthInches, 12, 2400)) return null;
  if (!numberInRange(value.ceilingHeightInches, 24, 240)) return null;
  if (!Array.isArray(value.items) || value.items.length > 100) return null;

  const items: NativeRoomScanItem[] = [];
  for (const rawItem of value.items) {
    if (!isObject(rawItem)) return null;
    if (typeof rawItem.id !== 'string' || !/^[\w-]{1,120}$/.test(rawItem.id)) return null;
    if (typeof rawItem.label !== 'string' || !rawItem.label.trim() || rawItem.label.length > 80) return null;
    if (typeof rawItem.category !== 'string' || !ITEM_CATEGORIES.has(rawItem.category as SpatialItem['category'])) return null;
    if (!numberInRange(rawItem.xInches, 0, value.roomLengthInches)) return null;
    if (!numberInRange(rawItem.yInches, 0, value.roomWidthInches)) return null;
    if (!numberInRange(rawItem.widthInches, 1, value.roomLengthInches)) return null;
    if (!numberInRange(rawItem.depthInches, 1, value.roomWidthInches)) return null;
    if (rawItem.xInches + rawItem.widthInches > value.roomLengthInches + 0.5) return null;
    if (rawItem.yInches + rawItem.depthInches > value.roomWidthInches + 0.5) return null;
    if (rawItem.heightInches !== undefined && !numberInRange(rawItem.heightInches, 1, 240)) return null;

    items.push({
      id: rawItem.id,
      label: rawItem.label.trim(),
      category: rawItem.category as SpatialItem['category'],
      xInches: Math.round(rawItem.xInches * 100) / 100,
      yInches: Math.round(rawItem.yInches * 100) / 100,
      widthInches: Math.round(rawItem.widthInches * 100) / 100,
      depthInches: Math.round(rawItem.depthInches * 100) / 100,
      ...(rawItem.heightInches === undefined
        ? {}
        : { heightInches: Math.round(rawItem.heightInches * 100) / 100 }),
      source: 'roomplan',
    });
  }

  return {
    version: 1,
    source: 'apple-roomplan',
    scanId: value.scanId,
    roomLengthInches: Math.round(value.roomLengthInches * 100) / 100,
    roomWidthInches: Math.round(value.roomWidthInches * 100) / 100,
    ceilingHeightInches: Math.round(value.ceilingHeightInches * 100) / 100,
    items,
  };
}

export function roomScanToMeasurements(scan: NativeRoomScan, timestamp = Date.now()): SpatialMeasurement[] {
  const stem = `roomplan-${scan.scanId}-${Math.trunc(timestamp)}`;
  return [
    { id: `${stem}-length`, label: 'Scanned room length', kind: 'length', totalInches: scan.roomLengthInches, source: 'roomplan' },
    { id: `${stem}-width`, label: 'Scanned room width', kind: 'width', totalInches: scan.roomWidthInches, source: 'roomplan' },
    { id: `${stem}-height`, label: 'Scanned ceiling height', kind: 'height', totalInches: scan.ceilingHeightInches, source: 'roomplan' },
  ];
}
