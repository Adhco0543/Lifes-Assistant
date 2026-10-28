import {
  formatMeasurement,
  MAX_SPATIAL_IMAGE_DATA_URL_LENGTH,
  type SpatialItem,
  type SpatialItemCategory,
  type SpatialMeasurement,
  type SpatialMeasurementKind,
  type SpatialNoteCategory,
  type SpatialWorkspaceRecord,
} from '../lib/spatialWorkspace';

export type SavedSpace = {
  id: string;
  data: SpatialWorkspaceRecord;
};

export type CapabilityState = {
  camera: boolean;
  secureContext: boolean;
};

export const ROOM_TYPES = [
  'Room',
  'Bathroom',
  'Kitchen',
  'Bedroom',
  'Living room',
  'Hallway',
  'Exterior',
  'Deck',
  'Stairway',
  'Garage',
  'Other',
];

export const MEASUREMENT_TYPES: Array<{ value: SpatialMeasurementKind; label: string }> = [
  { value: 'length', label: 'Room length' },
  { value: 'width', label: 'Room width' },
  { value: 'height', label: 'Ceiling height' },
  { value: 'opening', label: 'Door / window opening' },
  { value: 'object', label: 'Object / fixture' },
  { value: 'other', label: 'Other' },
];

export const NOTE_TYPES: Array<{ value: SpatialNoteCategory; label: string }> = [
  { value: 'work', label: 'Work item' },
  { value: 'damage', label: 'Damage / concern' },
  { value: 'material', label: 'Material' },
  { value: 'idea', label: 'Idea' },
];

export const SPATIAL_ITEM_TYPES: Array<{ value: SpatialItemCategory; label: string }> = [
  { value: 'cabinet', label: 'Cabinet / counter' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'fixture', label: 'Fixture' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'opening', label: 'Door / window' },
  { value: 'custom', label: 'Other item' },
];

const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;

export function encodeSpatialImage(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): string {
  const scale = Math.min(1, 1440 / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));

  for (let attempt = 0; attempt < 12 && width > 0 && height > 0; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the room image.');
    context.drawImage(source, 0, 0, width, height);

    for (const quality of [0.72, 0.58, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_SPATIAL_IMAGE_DATA_URL_LENGTH) return dataUrl;
    }

    width = Math.round(width * 0.78);
    height = Math.round(height * 0.78);
  }

  throw new Error('This room image is too detailed to save. Try a smaller photo.');
}

export async function prepareSpatialImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for the room view.');
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error('Room photos must be 20 MB or smaller.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot prepare photos for saved workspaces.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    return encodeSpatialImage(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


export type RoomSnapshotInput = {
  title: string;
  roomType: string;
  measurements: SpatialMeasurement[];
  items: SpatialItem[];
  roomLengthInches: number;
  roomWidthInches: number;
};

/** Draws the measured room state (plan and measurements) to an image; AR camera frames are not readable by the page. */
export function renderRoomSnapshot(input: RoomSnapshotInput): string {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the room snapshot.');

  context.fillStyle = '#1c2327';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#eef3f6';
  context.font = '600 40px sans-serif';
  context.fillText(input.title.slice(0, 48), 48, 28 + 40);
  context.fillStyle = '#9bb4d0';
  context.font = '24px sans-serif';
  context.fillText(`${input.roomType} · measured room snapshot · ${new Date().toLocaleString()}`, 48, 112);

  const planBox = { x: 48, y: 150, width: 700, height: 600 };
  if (input.roomLengthInches > 0 && input.roomWidthInches > 0) {
    const scale = Math.min(planBox.width / input.roomLengthInches, planBox.height / input.roomWidthInches);
    const roomW = input.roomLengthInches * scale;
    const roomH = input.roomWidthInches * scale;
    context.strokeStyle = '#a9bdcc';
    context.lineWidth = 4;
    context.strokeRect(planBox.x, planBox.y, roomW, roomH);
    context.font = '18px sans-serif';
    for (const item of input.items) {
      const x = planBox.x + item.xInches * scale;
      const y = planBox.y + item.yInches * scale;
      const w = item.widthInches * scale;
      const h = item.depthInches * scale;
      context.fillStyle = 'rgba(74, 137, 149, 0.78)';
      context.fillRect(x, y, w, h);
      context.strokeStyle = '#eff7f9';
      context.lineWidth = 2;
      context.strokeRect(x, y, w, h);
      context.fillStyle = '#ffffff';
      context.fillText(item.label.slice(0, 18), x + 6, y + 22, Math.max(10, w - 10));
    }
  } else {
    context.fillStyle = '#9d9d9d';
    context.font = '24px sans-serif';
    context.fillText('Record room length and width to draw the plan.', planBox.x, planBox.y + 40);
  }

  context.fillStyle = '#eef3f6';
  context.font = '600 26px sans-serif';
  context.fillText('Measurements', 790, 180);
  context.font = '22px sans-serif';
  const lines = input.measurements.slice(0, 16);
  lines.forEach((measurement, index) => {
    context.fillStyle = '#d7e3ea';
    context.fillText(
      `${measurement.label.slice(0, 22)}: ${formatMeasurement(measurement.totalInches)}${measurement.source === 'webxr-hit-test' ? ' (AR)' : ''}`,
      790,
      222 + index * 34,
      370
    );
  });
  if (input.measurements.length === 0) {
    context.fillStyle = '#9d9d9d';
    context.fillText('None recorded yet', 790, 222);
  }
  context.fillStyle = '#c9b77e';
  context.font = '18px sans-serif';
  context.fillText('AR estimates can drift. Verify with a tape.', 790, 760, 370);

  return encodeSpatialImage(canvas, width, height);
}
