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

export type SpatialWorkspaceRecord = {
  title: string;
  roomType: string;
  imageDataUrl?: string;
  measurements: SpatialMeasurement[];
  notes: SpatialNote[];
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
};

const finite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MAX_MEASUREMENTS = 200;
const MAX_NOTES = 200;
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

  return [
    `Spatial workspace: ${record.title}`,
    `Room type: ${record.roomType || 'Unspecified'}`,
    `Measurements: ${measurements}`,
    `Notes: ${notes}`,
  ].join('\n');
}

export function buildMaterialHandoff(record: SpatialWorkspaceRecord) {
  const metrics = calculateRoomMetrics(record.measurements);
  const hasArEstimate = record.measurements.some((measurement) => measurement.source === 'webxr-hit-test');

  return {
    projectName: record.title,
    measurements: metrics,
    ...(hasArEstimate ? { measurementWarning: 'These dimensions include WebXR AR estimates. Verify them with a tape before pricing or ordering materials.' } : {}),
    source: 'Spatial Workspace',
    notes: [
      ...record.notes.map((note) => note.text),
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

  if (!projectName && !Object.keys(parsedMeasurements).length) return null;

  return {
    ...(projectName ? { projectName } : {}),
    ...(Object.keys(parsedMeasurements).length ? { measurements: parsedMeasurements } : {}),
    ...(typeof source.measurementWarning === 'string' && source.measurementWarning.length <= 300
      ? { measurementWarning: source.measurementWarning }
      : {}),
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

  const now = Date.now();

  return {
    title: String(source.title || 'Untitled space').slice(0, 120),
    roomType: String(source.roomType || 'Room').slice(0, 80),
    ...(isSafeSpatialImageDataUrl(source.imageDataUrl)
      ? { imageDataUrl: source.imageDataUrl }
      : {}),
    measurements,
    notes,
    createdAt: finite(source.createdAt) || now,
    updatedAt: finite(source.updatedAt) || now,
  };
}
