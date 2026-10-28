'use client';

export type SpatialMeasurementKind =
  | 'length'
  | 'width'
  | 'height'
  | 'opening'
  | 'object'
  | 'other';

export type SpatialMeasurement = {
  id: string;
  label: string;
  kind: SpatialMeasurementKind;
  totalInches: number;
  source?: 'field' | 'webxr-hit-test';
};

export type SpatialNoteCategory = 'work' | 'damage' | 'material' | 'idea';

export type SpatialNote = {
  id: string;
  text: string;
  category: SpatialNoteCategory;
  x: number;
  y: number;
};

export type SpatialItemCategory =
  | 'cabinet'
  | 'appliance'
  | 'fixture'
  | 'furniture'
  | 'opening'
  | 'custom';

export type SpatialItem = {
  id: string;
  label: string;
  category: SpatialItemCategory;
  /** Distance from the plan's left edge, in inches. */
  xInches: number;
  /** Distance from the plan's top edge, in inches. */
  yInches: number;
  widthInches: number;
  depthInches: number;
  heightInches?: number;
  /** WebXR local-space transform, valid only while the current AR session remains active. */
  arTransform?: number[];
};

export type SpatialWorkspaceRecord = {
  title: string;
  roomType: string;
  imageDataUrl?: string;
  measurements: SpatialMeasurement[];
  notes: SpatialNote[];
  items: SpatialItem[];
  createdAt: number;
  updatedAt: number;
};

export type RoomMetrics = {
  length: number;
  width: number;
  height: number;
  area: number;
  volume: number;
};

export type SpatialMaterialHandoff = {
  projectName?: string;
  measurements?: Partial<RoomMetrics>;
  measurementWarning?: string;
  layoutItems?: SpatialItem[];
};

const finite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MAX_MEASUREMENTS = 200;
const MAX_NOTES = 200;
const MAX_SPATIAL_ITEMS = 100;
export const MAX_SPATIAL_IMAGE_DATA_URL_LENGTH = 450_000;

export function isSafeSpatialImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= MAX_SPATIAL_IMAGE_DATA_URL_LENGTH &&
    /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+=*$/i.test(value);
}

export function measurementToInches(feet: number, inches: number): number {
  return Math.max(0, Math.round((finite(feet) * 12 + finite(inches)) * 100) / 100);
}

export function formatMeasurement(totalInches: number): string {
  const normalized = Math.round(Math.max(0, finite(totalInches)) * 100) / 100;
  const feet = Math.floor(normalized / 12);
  const inches = Math.round((normalized - feet * 12) * 100) / 100;
  return `${feet}' ${inches}"`;
}

export function clampPin(value: number): number {
  return Math.min(100, Math.max(0, finite(value)));
}

export function placeSpatialItem(
  item: Omit<SpatialItem, 'xInches' | 'yInches'>,
  centerXInches: number,
  centerYInches: number,
  roomLengthInches: number,
  roomWidthInches: number,
): SpatialItem | null {
  const length = finite(roomLengthInches);
  const width = finite(roomWidthInches);
  const itemWidth = finite(item.widthInches);
  const itemDepth = finite(item.depthInches);
  if (
    length <= 0 || width <= 0 || itemWidth <= 0 || itemDepth <= 0 ||
    itemWidth > length || itemDepth > width
  ) return null;

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    ...item,
    xInches: round(Math.min(length - itemWidth, Math.max(0, finite(centerXInches) - itemWidth / 2))),
    yInches: round(Math.min(width - itemDepth, Math.max(0, finite(centerYInches) - itemDepth / 2))),
  };
}

export function spatialItemsOverlap(a: SpatialItem, b: SpatialItem): boolean {
  return a.xInches < b.xInches + b.widthInches &&
    a.xInches + a.widthInches > b.xInches &&
    a.yInches < b.yInches + b.depthInches &&
    a.yInches + a.depthInches > b.yInches;
}

export function persistSpatialItem(item: SpatialItem): Omit<SpatialItem, 'arTransform'> {
  const persisted = { ...item };
  delete persisted.arTransform;
  return persisted;
}

export function calculateRoomMetrics(measurements: SpatialMeasurement[]): RoomMetrics {
  const findFeet = (kind: SpatialMeasurementKind) => {
    const item = [...measurements].reverse().find((measurement) => measurement.kind === kind);
    return item ? item.totalInches / 12 : 0;
  };

  const length = findFeet('length');
  const width = findFeet('width');
  const height = findFeet('height');
  const area = length > 0 && width > 0 ? length * width : 0;
  const volume = area > 0 && height > 0 ? area * height : 0;

  return {
    length: Math.round(length * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    area: Math.round(area * 100) / 100,
    volume: Math.round(volume * 100) / 100,
  };
}

export function summarizeSpatialWorkspace(record: SpatialWorkspaceRecord): string {
  const measurements = record.measurements.length
    ? record.measurements
        .map((item) => `${item.label}: ${formatMeasurement(item.totalInches)}${item.source === 'webxr-hit-test' ? ' (AR estimate; verify on site)' : ''}`)
        .join('; ')
    : 'No measurements saved yet';

  const notes = record.notes.length
    ? record.notes.map((note) => `[${note.category}] ${note.text}`).join('; ')
    : 'No spatial notes saved yet';
  const roomItems = record.items || [];
  const items = roomItems.length
    ? roomItems
        .map((item) => `${item.label} (${item.category}, ${formatMeasurement(item.widthInches)} × ${formatMeasurement(item.depthInches)} footprint at ${formatMeasurement(item.xInches)} from left, ${formatMeasurement(item.yInches)} from top)`)
        .join('; ')
    : 'No room items placed';

  return [
    `Spatial workspace: ${record.title}`,
    `Room type: ${record.roomType || 'Unspecified'}`,
    `Measurements: ${measurements}`,
    `Notes: ${notes}`,
    `Room items: ${items}`,
  ].join('\n');
}

export function buildMaterialHandoff(record: SpatialWorkspaceRecord) {
  const metrics = calculateRoomMetrics(record.measurements);
  const hasArEstimate = record.measurements.some((measurement) => measurement.source === 'webxr-hit-test');
  const itemNotes = (record.items || []).map((item) =>
    `Planned ${item.category}: ${item.label}, ${formatMeasurement(item.widthInches)} × ${formatMeasurement(item.depthInches)} footprint, positioned ${formatMeasurement(item.xInches)} from the plan origin.`
  );

  return {
    projectName: record.title,
    measurements: metrics,
    layoutItems: record.items || [],
    ...(hasArEstimate ? { measurementWarning: 'These dimensions include WebXR AR estimates. Verify them with a tape before pricing or ordering materials.' } : {}),
    source: 'Spatial Workspace',
    notes: [
      ...record.notes.map((note) => note.text),
      ...itemNotes,
      ...(hasArEstimate ? ['Includes WebXR AR estimates. Verify all dimensions on site before ordering materials.'] : []),
    ],
  };
}

export function parseSpatialMaterialHandoff(value: unknown): SpatialMaterialHandoff | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const projectName = typeof source.projectName === 'string'
    ? source.projectName.trim().slice(0, 120)
    : '';
  const raw = source.measurements;
  const measurements = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null;
  const parsedMeasurements: Partial<RoomMetrics> = {};

  if (measurements) {
    for (const key of ['length', 'width', 'height', 'area', 'volume'] as const) {
      const rawValue = measurements[key];
      if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0) {
        parsedMeasurements[key] = Math.min(rawValue, 1_000_000_000);
      }
    }
  }

  const layoutItems = Array.isArray(source.layoutItems)
    ? parseSpatialWorkspaceRecord({ items: source.layoutItems })?.items || []
    : [];

  if (!projectName && !Object.keys(parsedMeasurements).length && !layoutItems.length) return null;

  return {
    ...(projectName ? { projectName } : {}),
    ...(Object.keys(parsedMeasurements).length ? { measurements: parsedMeasurements } : {}),
    ...(typeof source.measurementWarning === 'string' && source.measurementWarning.length <= 300
      ? { measurementWarning: source.measurementWarning }
      : {}),
    ...(layoutItems.length ? { layoutItems } : {}),
  };
}

export function parseSpatialWorkspaceRecord(
  value: unknown
): SpatialWorkspaceRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const rawMeasurements = Array.isArray(source.measurements)
    ? source.measurements
    : [];
  const rawNotes = Array.isArray(source.notes) ? source.notes : [];
  const rawItems = Array.isArray(source.items) ? source.items : [];

  const measurements: SpatialMeasurement[] = rawMeasurements
    .slice(0, MAX_MEASUREMENTS)
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
    )
    .map((item, index): SpatialMeasurement => {
      const kind: SpatialMeasurementKind =
        item.kind === 'length' ||
        item.kind === 'width' ||
        item.kind === 'height' ||
        item.kind === 'opening' ||
        item.kind === 'object'
          ? item.kind
          : 'other';

      return {
        id: String(item.id || `measurement-${index}`),
        label: String(item.label || 'Measurement').slice(0, 80),
        kind,
        totalInches: Math.min(1_000_000, Math.max(0, finite(item.totalInches))),
        ...(item.source === 'webxr-hit-test' ? { source: 'webxr-hit-test' as const } : { source: 'field' as const }),
      };
    })
    .filter((item) => item.totalInches > 0);

  const notes: SpatialNote[] = rawNotes
    .slice(0, MAX_NOTES)
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
    )
    .map((item, index): SpatialNote => {
      const category: SpatialNoteCategory =
        item.category === 'damage' ||
        item.category === 'material' ||
        item.category === 'idea'
          ? item.category
          : 'work';

      return {
        id: String(item.id || `note-${index}`),
        text: String(item.text || '').slice(0, 500),
        category,
        x: clampPin(finite(item.x)),
        y: clampPin(finite(item.y)),
      };
    })
    .filter((item) => Boolean(item.text.trim()));

  const items: SpatialItem[] = rawItems
    .slice(0, MAX_SPATIAL_ITEMS)
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
    )
    .map((item, index): SpatialItem => {
      const category: SpatialItemCategory =
        item.category === 'cabinet' ||
        item.category === 'appliance' ||
        item.category === 'fixture' ||
        item.category === 'furniture' ||
        item.category === 'opening'
          ? item.category
          : 'custom';
      const heightInches = finite(item.heightInches);
      return {
        id: String(item.id || `item-${index}`),
        label: String(item.label || 'Room item').trim().slice(0, 80) || 'Room item',
        category,
        xInches: Math.min(1_000_000, Math.max(0, finite(item.xInches))),
        yInches: Math.min(1_000_000, Math.max(0, finite(item.yInches))),
        widthInches: Math.min(1_000_000, Math.max(0, finite(item.widthInches))),
        depthInches: Math.min(1_000_000, Math.max(0, finite(item.depthInches))),
        ...(heightInches > 0 ? { heightInches: Math.min(1_000_000, heightInches) } : {}),
      };
    })
    .filter((item) => item.widthInches > 0 && item.depthInches > 0);

  const now = Date.now();

  return {
    title: String(source.title || 'Untitled space').slice(0, 120),
    roomType: String(source.roomType || 'Room').slice(0, 80),
    ...(isSafeSpatialImageDataUrl(source.imageDataUrl)
      ? { imageDataUrl: source.imageDataUrl }
      : {}),
    measurements,
    notes,
    items,
    createdAt: finite(source.createdAt) || now,
    updatedAt: finite(source.updatedAt) || now,
  };
}
