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

const finite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function measurementToInches(feet: number, inches: number): number {
  return Math.max(0, Math.round((finite(feet) * 12 + finite(inches)) * 100) / 100);
}

export function formatMeasurement(totalInches: number): string {
  const normalized = Math.max(0, finite(totalInches));
  const feet = Math.floor(normalized / 12);
  const inches = Math.round((normalized - feet * 12) * 100) / 100;
  return `${feet}' ${inches}"`;
}

export function clampPin(value: number): number {
  return Math.min(100, Math.max(0, finite(value)));
}

export function calculateRoomMetrics(measurements: SpatialMeasurement[]): RoomMetrics {
  const findFeet = (kind: SpatialMeasurementKind) => {
    const item = measurements.find((measurement) => measurement.kind === kind);
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
        .map((item) => `${item.label}: ${formatMeasurement(item.totalInches)}`)
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

  return {
    projectName: record.title,
    measurements: metrics,
    source: 'Spatial Workspace',
    notes: record.notes.map((note) => note.text),
  };
}

export function parseSpatialWorkspaceRecord(
  value: unknown
): SpatialWorkspaceRecord | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  const rawMeasurements = Array.isArray(source.measurements)
    ? source.measurements
    : [];
  const rawNotes = Array.isArray(source.notes) ? source.notes : [];

  const measurements: SpatialMeasurement[] = rawMeasurements
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: String(item.id || `measurement-${index}`),
      label: String(item.label || 'Measurement').slice(0, 80),
      kind:
        item.kind === 'length' ||
        item.kind === 'width' ||
        item.kind === 'height' ||
        item.kind === 'opening' ||
        item.kind === 'object'
          ? item.kind
          : 'other',
      totalInches: Math.max(0, finite(item.totalInches)),
    }))
    .filter((item) => item.totalInches > 0);

  const notes: SpatialNote[] = rawNotes
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: String(item.id || `note-${index}`),
      text: String(item.text || '').slice(0, 500),
      category:
        item.category === 'damage' ||
        item.category === 'material' ||
        item.category === 'idea'
          ? item.category
          : 'work',
      x: clampPin(finite(item.x)),
      y: clampPin(finite(item.y)),
    }))
    .filter((item) => item.text.trim());

  const now = Date.now();

  return {
    title: String(source.title || 'Untitled space').slice(0, 120),
    roomType: String(source.roomType || 'Room').slice(0, 80),
    measurements,
    notes,
    createdAt: finite(source.createdAt) || now,
    updatedAt: finite(source.updatedAt) || now,
  };
}
