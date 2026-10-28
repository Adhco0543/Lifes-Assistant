'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import { reportIntegrationFailure } from '../lib/integrationDiagnostics';
import { useWebXRAR } from './useWebXRAR';
import {
  buildMaterialHandoff,
  calculateRoomMetrics,
  clampPin,
  formatMeasurement,
  measurementToInches,
  persistSpatialItem,
  placeSpatialItem,
  spatialItemsOverlap,
  MAX_SPATIAL_IMAGE_DATA_URL_LENGTH,
  parseSpatialWorkspaceRecord,
  summarizeSpatialWorkspace,
  type SpatialMeasurement,
  type SpatialMeasurementKind,
  type SpatialItem,
  type SpatialItemCategory,
  type SpatialNote,
  type SpatialNoteCategory,
  type SpatialWorkspaceRecord,
} from '../lib/spatialWorkspace';
import { distanceInMeters, metersToInches, type WebXRPoint } from '../lib/webxrSpatial';

type SpatialWorkspaceProps = {
  userId: string;
  onNavigate: (view: string) => void;
};

type SavedSpace = {
  id: string;
  data: SpatialWorkspaceRecord;
};

type CapabilityState = {
  camera: boolean;
  secureContext: boolean;
};

const ROOM_TYPES = [
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

const MEASUREMENT_TYPES: Array<{ value: SpatialMeasurementKind; label: string }> = [
  { value: 'length', label: 'Room length' },
  { value: 'width', label: 'Room width' },
  { value: 'height', label: 'Ceiling height' },
  { value: 'opening', label: 'Door / window opening' },
  { value: 'object', label: 'Object / fixture' },
  { value: 'other', label: 'Other' },
];

const NOTE_TYPES: Array<{ value: SpatialNoteCategory; label: string }> = [
  { value: 'work', label: 'Work item' },
  { value: 'damage', label: 'Damage / concern' },
  { value: 'material', label: 'Material' },
  { value: 'idea', label: 'Idea' },
];

const SPATIAL_ITEM_TYPES: Array<{ value: SpatialItemCategory; label: string }> = [
  { value: 'cabinet', label: 'Cabinet / counter' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'fixture', label: 'Fixture' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'opening', label: 'Door / window' },
  { value: 'custom', label: 'Other item' },
];

const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;

function encodeSpatialImage(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): string {
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

async function prepareSpatialImage(file: File): Promise<string> {
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

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function SpatialWorkspace({ userId, onNavigate }: SpatialWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const savingRef = useRef(false);
  const firstArPointRef = useRef<WebXRPoint | null>(null);
  const wasArActiveRef = useRef(false);
  const arActionRef = useRef<'measure' | 'place-item'>('measure');
  const placeSelectedARItemRef = useRef<(transform: number[]) => void>(() => undefined);

  const [title, setTitle] = useState('New room scan');
  const [roomType, setRoomType] = useState('Room');
  const [createdAt, setCreatedAt] = useState(Date.now());
  const [recordId, setRecordId] = useState('');
  const [measurements, setMeasurements] = useState<SpatialMeasurement[]>([]);
  const [notes, setNotes] = useState<SpatialNote[]>([]);
  const [items, setItems] = useState<SpatialItem[]>([]);
  const [savedSpaces, setSavedSpaces] = useState<SavedSpace[]>([]);
  const [status, setStatus] = useState('Ready to map a space.');
  const [cameraActive, setCameraActive] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [capabilities, setCapabilities] = useState<CapabilityState>({
    camera: false,
    secureContext: false,
  });

  const [measurementKind, setMeasurementKind] = useState<SpatialMeasurementKind>('length');
  const [measurementLabel, setMeasurementLabel] = useState('Room length');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<SpatialNoteCategory>('work');
  const [arPointStep, setArPointStep] = useState<0 | 1>(0);
  const [itemCategory, setItemCategory] = useState<SpatialItemCategory>('fixture');
  const [itemLabel, setItemLabel] = useState('Vanity');
  const [itemWidthInches, setItemWidthInches] = useState('30');
  const [itemDepthInches, setItemDepthInches] = useState('21');
  const [itemHeightInches, setItemHeightInches] = useState('34');
  const [isPlacingItem, setIsPlacingItem] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [arAction, setArAction] = useState<'measure' | 'place-item'>('measure');

  const addArPoint = useCallback((point: WebXRPoint, transform: number[] | null) => {
    if (arActionRef.current === 'place-item') {
      if (!transform) {
        setStatus('The AR surface did not return a stable placement pose. Move the reticle and try again.');
        return;
      }
      placeSelectedARItemRef.current(transform);
      return;
    }
    const firstPoint = firstArPointRef.current;
    if (!firstPoint) {
      firstArPointRef.current = point;
      setArPointStep(1);
      setStatus('First AR point set. Move to the other end and set the second point.');
      return;
    }

    const inches = metersToInches(distanceInMeters(firstPoint, point));
    if (inches < 0.25) {
      setStatus('Those AR points are too close. Move to the other end of the dimension.');
      return;
    }

    const defaultLabel = MEASUREMENT_TYPES.find((item) => item.value === measurementKind)?.label || 'Measurement';
    setMeasurements((current) => [
      ...current,
      {
        id: makeId('ar-measurement'),
        label: measurementLabel.trim() || defaultLabel,
        kind: measurementKind,
        totalInches: inches,
        source: 'webxr-hit-test',
      },
    ]);
    firstArPointRef.current = null;
    setArPointStep(0);
    setStatus(`AR estimate: ${formatMeasurement(inches)}. Verify with a tape before quoting or ordering.`);
  }, [measurementKind, measurementLabel]);
  const ar = useWebXRAR(addArPoint);

  const placeSelectedARItem = useCallback((transform: number[]) => {
    const selected = items.find((item) => item.id === selectedItemId) || items[0];
    if (!selected) {
      setStatus('Choose an item from the room list before placing it in AR.');
      return;
    }
    setItems((current) => current.map((item) => item.id === selected.id
      ? { ...item, arTransform: transform }
      : item));
    setStatus(`${selected.label} placed in the live AR view. Its dimensions are saved; its AR location lasts for this session.`);
  }, [items, selectedItemId]);
  placeSelectedARItemRef.current = placeSelectedARItem;

  const metrics = useMemo(() => calculateRoomMetrics(measurements), [measurements]);
  const roomLengthInches = [...measurements].reverse().find((measurement) => measurement.kind === 'length')?.totalInches || 0;
  const roomWidthInches = [...measurements].reverse().find((measurement) => measurement.kind === 'width')?.totalInches || 0;
  const planIsTransposed = roomLengthInches < roomWidthInches;
  const planLengthInches = planIsTransposed ? roomWidthInches : roomLengthInches;
  const planWidthInches = planIsTransposed ? roomLengthInches : roomWidthInches;
  const planAspect = planLengthInches > 0 && planWidthInches > 0
    ? planLengthInches / planWidthInches
    : 1;

  useEffect(() => {
    if (!ar.active) return;
    ar.setObjects(items.flatMap((item) => item.arTransform
      ? [{
          transform: item.arTransform,
          widthMeters: item.widthInches / 39.37007874,
          heightMeters: (item.heightInches || 36) / 39.37007874,
          depthMeters: item.depthInches / 39.37007874,
          category: item.category,
        }]
      : []));
  }, [ar.active, ar.setObjects, items]);

  const currentRecord = useCallback((): SpatialWorkspaceRecord => ({
    title: title.trim() || 'Untitled space',
    roomType,
    ...(imageDataUrl ? { imageDataUrl } : {}),
    measurements,
    notes,
    items: items.map(persistSpatialItem),
    createdAt,
    updatedAt: Date.now(),
  }), [createdAt, imageDataUrl, items, measurements, notes, roomType, title]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    let active = true;

    const detect = async () => {
      const secureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
      const camera = Boolean(navigator.mediaDevices?.getUserMedia);
      if (active) {
        setCapabilities({ camera, secureContext });
      }
    };

    void detect();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSaved = async () => {
      try {
        const records = await firebaseBackend.getRecentBusinessRecords(100);
        if (!active) return;

        const next = records
          .filter((record) => record.kind === 'spatial-workspace')
          .map((record) => {
            const parsed = parseSpatialWorkspaceRecord(record.data);
            if (!parsed) return null;
            return { id: String(record.id || ''), data: parsed };
          })
          .filter((item): item is SavedSpace => Boolean(item?.id));

        setSavedSpaces(next);
      } catch (error) {
        reportIntegrationFailure('firebase', 'load');
        setStatus('Saved spaces could not be loaded. Your current workspace is still available.');
      }
    };

    void loadSaved();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startAR = async () => {
    if (!capabilities.secureContext) {
      setStatus('WebXR AR requires a secure HTTPS connection.');
      return;
    }
    setItems((current) => current.map((item) => {
      if (!item.arTransform) return item;
      const next = { ...item };
      delete next.arTransform;
      return next;
    }));
    stopCamera();
    setStatus('Starting WebXR AR…');
    try {
      await ar.start();
      setStatus(arActionRef.current === 'place-item'
        ? 'AR is live. Select an item, aim at a surface, and place its 3D box preview.'
        : 'AR is live. Center the reticle on a surface, then set two points to measure.');
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      setStatus(name === 'NotAllowedError'
        ? 'AR needs camera and motion permission. Allow access in the browser and try again.'
        : name === 'NotSupportedError'
          ? 'This browser or device does not provide the AR hit-testing feature. Continue with the camera or manual dimensions.'
          : 'Could not start WebXR AR. Use a compatible browser on a supported device, or continue with the camera/photo tools.');
    }
  };

  const stopAR = async () => {
    await ar.stop();
    firstArPointRef.current = null;
    setArPointStep(0);
    setStatus('AR session ended. Saved item footprints remain; place their AR previews again in a new session.');
  };

  useEffect(() => {
    const wasActive = wasArActiveRef.current;
    wasArActiveRef.current = ar.active;
    if (!ar.active) {
      firstArPointRef.current = null;
      setArPointStep(0);
      if (wasActive) {
        setItems((current) => current.map((item) => {
          if (!item.arTransform) return item;
          const next = { ...item };
          delete next.arTransform;
          return next;
        }));
      }
      if (wasActive) {
        setStatus((current) => current.startsWith('AR is live') || current.startsWith('First AR point set')
          ? 'AR session ended.'
          : current);
      }
    }
    ar.setAnchor(ar.active && arPointStep === 1 ? firstArPointRef.current : null);
  }, [ar.active, arPointStep, ar.setAnchor]);

  const startCamera = async () => {
    if (ar.active) await stopAR();
    setStatus('Opening rear camera…');

    try {
      if (!window.isSecureContext) {
        throw new Error('Camera access requires a secure HTTPS connection.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not expose camera access.');
      }

      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setPhotoUrl('');
      setImageDataUrl('');
      setStatus('Camera live. Add verified dimensions and tap the view to pin notes.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open the camera.');
    }
  };

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (ar.active) await stopAR();
    stopCamera();
    event.target.value = '';
    setStatus('Preparing room photo…');

    try {
      const dataUrl = await prepareSpatialImage(file);
      setImageDataUrl(dataUrl);
      setPhotoUrl(dataUrl);
      setStatus('Room photo ready. It will be saved with this workspace.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load this room photo.');
    }
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setStatus('Wait for the camera view to become ready, then capture again.');
      return;
    }

    try {
      const dataUrl = encodeSpatialImage(video, video.videoWidth, video.videoHeight);
      setImageDataUrl(dataUrl);
      setPhotoUrl(dataUrl);
      stopCamera();
      setStatus('Room view captured. Notes and the photo will be saved together.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not capture this room view.');
    }
  };

  const addMeasurement = () => {
    const totalInches = measurementToInches(Number(feet || 0), Number(inches || 0));
    if (totalInches <= 0) {
      setStatus('Enter a verified measurement first.');
      return;
    }

    const defaultLabel =
      MEASUREMENT_TYPES.find((item) => item.value === measurementKind)?.label ||
      'Measurement';

    setMeasurements((current) => [
      ...current,
      {
        id: makeId('measurement'),
        label: measurementLabel.trim() || defaultLabel,
        kind: measurementKind,
        totalInches,
        source: 'field',
      },
    ]);
    setFeet('');
    setInches('');
    setStatus('Measurement added.');
  };

  const beginPlacingItem = () => {
    const width = Number(itemWidthInches);
    const depth = Number(itemDepthInches);
    const height = Number(itemHeightInches);
    if (roomLengthInches <= 0 || roomWidthInches <= 0) {
      setStatus('Measure the room length and width before placing items on its plan.');
      return;
    }
    if (!itemLabel.trim() || !Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
      setStatus('Add an item name and valid footprint dimensions first.');
      return;
    }
    if (items.length >= 100) {
      setStatus('This room plan has reached its 100-item limit.');
      return;
    }
    if (width > roomLengthInches || depth > roomWidthInches) {
      setStatus('That footprint is larger than the measured room. Check its size or room dimensions.');
      return;
    }
    if (itemHeightInches.trim() && (!Number.isFinite(height) || height <= 0)) {
      setStatus('Enter a valid height or leave the height blank.');
      return;
    }
    setIsPlacingItem(true);
    setStatus(`Click the room plan to place ${itemLabel.trim()}.`);
  };

  const finishItemPlacement = (centerX: number, centerY: number) => {
    if (!isPlacingItem || roomLengthInches <= 0 || roomWidthInches <= 0) return;
    const height = Number(itemHeightInches);
    const item = placeSpatialItem({
      id: makeId('space-item'),
      label: itemLabel.trim().slice(0, 80),
      category: itemCategory,
      widthInches: Number(itemWidthInches),
      depthInches: Number(itemDepthInches),
      ...(itemHeightInches.trim() ? { heightInches: height } : {}),
    }, centerX, centerY, roomLengthInches, roomWidthInches);
    if (!item) {
      setIsPlacingItem(false);
      setStatus('That item does not fit inside the measured room.');
      return;
    }
    if (items.some((existing) => spatialItemsOverlap(existing, item))) {
      setIsPlacingItem(false);
      setStatus('That footprint overlaps another item. Choose an open area or remove the item in the way.');
      return;
    }
    setItems((current) => [...current, item]);
    setSelectedItemId(item.id);
    setIsPlacingItem(false);
    setStatus(`${item.label} added to the room plan. Click it on the plan or its list entry to remove it.`);
  };

  const placeItemOnPlan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacingItem || roomLengthInches <= 0 || roomWidthInches <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const planX = ((event.clientX - rect.left) / rect.width) * planLengthInches;
    const planY = ((event.clientY - rect.top) / rect.height) * planWidthInches;
    finishItemPlacement(planIsTransposed ? planY : planX, planIsTransposed ? planX : planY);
  };

  const removeSpatialItem = (id: string) => {
    const removed = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    if (selectedItemId === id) setSelectedItemId('');
    setStatus(removed ? `${removed.label} removed from the room plan.` : 'Room item removed.');
  };

  const pinNote = (event: React.MouseEvent<HTMLDivElement>) => {
    const text = noteText.trim();
    if (!text) {
      setStatus('Type a note first, then tap the room view where it belongs.');
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampPin(((event.clientX - rect.left) / rect.width) * 100);
    const y = clampPin(((event.clientY - rect.top) / rect.height) * 100);

    setNotes((current) => [
      ...current,
      {
        id: makeId('note'),
        text,
        category: noteCategory,
        x,
        y,
      },
    ]);
    setNoteText('');
    setStatus('Spatial note pinned.');
  };

  const persist = async () => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setIsSaving(true);
    const record = currentRecord();
    setStatus('Saving spatial workspace…');
    try {
      const savedId = recordId || await firebaseBackend.saveBusinessRecord('spatial-workspace', record);
      if (recordId) await firebaseBackend.updateBusinessRecord(recordId, record);
      setRecordId(savedId);
      setSavedSpaces((current) => [
        { id: savedId, data: record },
        ...current.filter((space) => space.id !== savedId),
      ].slice(0, 100));

      try {
        await firebaseBackend.saveContinuityState({
          view: 'spatial',
          label: 'Spatial workspace',
          context: record.title,
          contextId: savedId,
          device:
            window.innerWidth <= 640
              ? 'phone'
              : window.innerWidth <= 1024
                ? 'tablet'
                : 'desktop',
        });
      } catch {
        reportIntegrationFailure('firebase', 'save');
      }

      setStatus(record.imageDataUrl
        ? 'Workspace saved with its room photo, measurements, notes, and layout items.'
        : 'Workspace saved with its measurements, notes, and layout items. No room photo was attached.');
      return record;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const safePersist = async () => {
    try {
      return await persist();
    } catch {
      reportIntegrationFailure('firebase', 'save');
      setStatus('Could not save this workspace. Check your connection and sign-in, then try again.');
      return null;
    }
  };

  const handoffTask = async () => {
    const record = await safePersist();
    if (!record) return;

    const firstNote = record.notes[0]?.text;
    try {
      await firebaseBackend.saveDraft('handoff-task', {
        title: firstNote
          ? `${record.title}: ${firstNote}`
          : `Review spatial plan for ${record.title}`,
        source: 'Spatial Workspace',
      });
      onNavigate('tasks');
    } catch {
      reportIntegrationFailure('firebase', 'save');
      setStatus('Workspace saved, but the task draft could not be opened. Try again.');
    }
  };

  const handoffQuote = async () => {
    const record = await safePersist();
    if (!record) return;

    try {
      await firebaseBackend.saveDraft('handoff-quote', {
        projectDescription: summarizeSpatialWorkspace(record),
        notes: record.measurements.some((measurement) => measurement.source === 'webxr-hit-test')
          ? 'Room dimensions include WebXR AR estimates. Verify them on site before pricing or ordering.'
          : 'Room dimensions were entered as verified field dimensions in Spatial Workspace.',
        items: [],
        source: 'Spatial Workspace',
      });
      onNavigate('quotes');
    } catch {
      reportIntegrationFailure('firebase', 'save');
      setStatus('Workspace saved, but the quote draft could not be opened. Try again.');
    }
  };

  const handoffMaterials = async () => {
    const record = await safePersist();
    if (!record) return;

    try {
      await firebaseBackend.saveDraft('handoff-materials', buildMaterialHandoff(record));
      onNavigate('materials');
    } catch {
      reportIntegrationFailure('firebase', 'save');
      setStatus('Workspace saved, but the material estimate could not be opened. Try again.');
    }
  };

  const loadSpace = (space: SavedSpace) => {
    if (ar.active) void stopAR();
    stopCamera();
    setRecordId(space.id);
    setTitle(space.data.title);
    setRoomType(space.data.roomType);
    setMeasurements(space.data.measurements);
    setNotes(space.data.notes);
    setItems(space.data.items);
    setSelectedItemId(space.data.items[0]?.id || '');
    setArAction('measure');
    arActionRef.current = 'measure';
    setImageDataUrl(space.data.imageDataUrl || '');
    setPhotoUrl(space.data.imageDataUrl || '');
    setCreatedAt(space.data.createdAt);
    setFeet('');
    setInches('');
    setNoteText('');
    setIsPlacingItem(false);
    setStatus('Saved space loaded.');
  };

  const newSpace = () => {
    if (ar.active) void stopAR();
    stopCamera();
    setRecordId('');
    setTitle('New room scan');
    setRoomType('Room');
    setMeasurements([]);
    setNotes([]);
    setItems([]);
    setSelectedItemId('');
    setArAction('measure');
    arActionRef.current = 'measure';
    setImageDataUrl('');
    setPhotoUrl('');
    setCreatedAt(Date.now());
    setFeet('');
    setInches('');
    setNoteText('');
    setIsPlacingItem(false);
    setStatus('New spatial workspace ready.');
  };

  return (
    <div className="spatial-page">
      <div className="spatial-inner">
        <header className="spatial-header">
          <div>
            <span className="kicker">ARCHITECTURAL AR</span>
            <h1>Spatial Workspace</h1>
            <p>
              Measure a room with WebXR, preview dimensioned items in the live AR view,
              then carry the saved room plan into Life&apos;s Assistant.
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost" disabled={isSaving} onClick={newSpace}>New space</button>
            <button type="button" className="primary" disabled={isSaving} onClick={() => void safePersist()}>
              {isSaving ? 'Saving…' : 'Save workspace'}
            </button>
          </div>
        </header>

        <div className="capability-row" aria-label="Device capability status">
          <span className={capabilities.camera ? 'cap ok' : 'cap'}>
            <b>Camera</b>{capabilities.camera ? 'Ready' : 'Unavailable'}
          </span>
          <span className={capabilities.secureContext ? 'cap ok' : 'cap'}>
            <b>HTTPS</b>{capabilities.secureContext ? 'Secure' : 'Required'}
          </span>
          <span className={ar.supported ? 'cap ok' : 'cap'}>
            <b>WebXR AR</b>{ar.supported === null ? 'Checking…' : ar.supported ? 'Available' : 'Browser fallback'}
          </span>
          <span className={ar.surfaceAvailable ? 'cap ok' : 'cap'}>
            <b>AR hit test</b>{ar.active ? ar.surfaceAvailable ? 'Surface found' : 'Searching' : ar.supported ? 'Checked at start' : ar.supported === null ? 'Checking…' : 'Unavailable'}
          </span>
        </div>

        <section className="workspace-grid">
          <div className="viewer-panel">
            <div className="viewer-toolbar">
              {ar.supported && !ar.active && (
                <button type="button" className="tool-button ar-launch" title="Measure with two tracked surface points or place a room item in AR." disabled={isSaving || ar.starting || !capabilities.secureContext} onClick={() => { setArAction('measure'); arActionRef.current = 'measure'; void startAR(); }}>
                  {ar.starting ? 'Starting AR…' : 'Start AR measure'}
                </button>
              )}
              {ar.active && (
                <button type="button" className="tool-button" onClick={() => void stopAR()}>
                  End AR
                </button>
              )}
              <button type="button" className="tool-button" disabled={isSaving || ar.active} onClick={() => void startCamera()}>
                {cameraActive ? 'Restart camera' : 'Open rear camera'}
              </button>
              {cameraActive && (
                <button type="button" className="tool-button" disabled={isSaving} onClick={captureCameraFrame}>
                  Capture room view
                </button>
              )}
              {cameraActive && (
                <button type="button" className="tool-button" disabled={isSaving} onClick={stopCamera}>Stop camera</button>
              )}
              <label className={`tool-button upload ${ar.active ? 'disabled' : ''}`}>
                Use photo
                <input type="file" accept="image/*" capture="environment" disabled={ar.active} onChange={handlePhoto} />
              </label>
            </div>

            <div
              className="scan-stage"
              onClick={ar.active ? undefined : pinNote}
              role="group"
              tabIndex={0}
              aria-label="Room view. Type a spatial note, then tap this view to place it. Press Enter or Space to place it at the center."
              onKeyDown={(event) => {
                if (ar.active) return;
                if ((event.key === 'Enter' || event.key === ' ') && noteText.trim()) {
                  event.preventDefault();
                  setNotes((current) => [
                    ...current,
                    {
                      id: makeId('note'),
                      text: noteText.trim(),
                      category: noteCategory,
                      x: 50,
                      y: 50,
                    },
                  ]);
                  setNoteText('');
                  setStatus('Spatial note pinned to center.');
                }
              }}
            >
              <video
                ref={videoRef}
                className={cameraActive && !ar.active ? 'camera visible' : 'camera'}
                playsInline
                muted
              />
              {photoUrl && !ar.active && <img className="photo" src={photoUrl} alt="Selected room reference" />}
              <canvas
                ref={ar.canvasRef}
                className={ar.active ? 'ar-canvas visible' : 'ar-canvas'}
                aria-hidden="true"
              />
              {!ar.active && !cameraActive && !photoUrl && (
                <div className="empty-stage">
                  <div className="scan-cube" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <strong>Open the camera or choose a room photo</strong>
                  <small>The workspace still works without WebAR or a depth sensor.</small>
                </div>
              )}

              {!ar.active && <div className="scan-grid" aria-hidden="true" />}
              {!ar.active && <div className="reticle" aria-hidden="true"><span /></div>}

              {!ar.active && notes.map((note, index) => (
                <button
                  type="button"
                  key={note.id}
                  className={`pin pin-${note.category}`}
                  style={{ left: `${note.x}%`, top: `${note.y}%` }}
                  title={note.text}
                  aria-label={`Spatial note ${index + 1}: ${note.text}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setNotes((current) => current.filter((item) => item.id !== note.id));
                    setStatus('Spatial note removed.');
                  }}
                >
                  {index + 1}
                </button>
              ))}

              <div className="stage-status">
                <span className={ar.active && ar.surfaceAvailable || cameraActive ? 'live-dot active' : 'live-dot'} />
                {ar.active
                  ? ar.surfaceAvailable ? 'AR SURFACE LOCK' : 'AR SEARCHING'
                  : cameraActive ? 'LIVE CAMERA' : photoUrl ? 'REFERENCE PHOTO' : 'SPATIAL PLAN'}
              </div>

              <div
                ref={ar.overlayRootRef}
                className={ar.active ? 'xr-dom-overlay active' : 'xr-dom-overlay'}
                aria-label="AR measuring controls"
              >
                {ar.active && (
                  <div className="ar-controls">
                    <p>{arAction === 'place-item'
                      ? `Place ${items.find((item) => item.id === selectedItemId)?.label || items[0]?.label || 'an item'} at the reticle. AR placements are temporary to this session.`
                      : arPointStep === 1
                        ? 'First point set. Move to the other end.'
                        : ar.surfaceAvailable ? 'Surface detected' : 'Move slowly to find a surface'}</p>
                    {items.length > 0 && (
                      <select
                        aria-label="AR item to place"
                        value={selectedItemId || items[0].id}
                        onChange={(event) => setSelectedItemId(event.target.value)}
                      >
                        {items.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.widthInches} × {item.depthInches} in</option>)}
                      </select>
                    )}
                    <button
                      type="button"
                      disabled={!ar.surfaceAvailable || (arAction === 'place-item' && items.length === 0)}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!ar.placeCurrentPoint()) setStatus('No surface detected at the reticle.');
                      }}
                    >
                      {arAction === 'place-item'
                        ? (items.find((item) => item.id === selectedItemId) || items[0])?.arTransform ? 'Move item to reticle' : 'Place item at reticle'
                        : arPointStep === 0 ? 'Set first point' : 'Set second point'}
                    </button>
                    {arAction === 'place-item' && (selectedItemId || items[0]?.id) && (
                      <button type="button" className="end-ar-overlay" onClick={(event) => { event.stopPropagation(); removeSpatialItem(selectedItemId || items[0].id); }}>
                        Remove selected item
                      </button>
                    )}
                    {items.length > 0 && <button type="button" className="end-ar-overlay" onClick={(event) => {
                      event.stopPropagation();
                      const nextAction = arAction === 'measure' ? 'place-item' : 'measure';
                      setArAction(nextAction);
                      arActionRef.current = nextAction;
                      firstArPointRef.current = null;
                      setArPointStep(0);
                    }}>
                      {arAction === 'measure' ? 'Place room item' : 'Measure distance'}
                    </button>}
                    <button type="button" className="end-ar-overlay" onClick={(event) => { event.stopPropagation(); void stopAR(); }}>
                      End AR
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="accuracy-note">
              <b>AR preview:</b> WebXR measurements are estimates and can drift; verify with a tape before quoting or ordering. Room items appear as dimensioned 3D box previews. Their live AR positions last for the current session; saved workspaces keep their measured 2D footprints and dimensions. This web flow does not collect a LiDAR/depth map.
            </div>
          </div>

          <aside className="inspector">
            <div className="panel">
              <div className="panel-title">
                <span>SPACE</span>
                <strong>Project identity</strong>
              </div>
              <label>
                Name
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                Type
                <select value={roomType} onChange={(event) => setRoomType(event.target.value)}>
                  {ROOM_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            </div>

            <div className="panel">
              <div className="panel-title">
                <span>MEASURE</span>
                <strong>Verified dimensions</strong>
              </div>
              <div className="field-grid">
                <label>
                  Measurement
                  <select
                    value={measurementKind}
                    onChange={(event) => {
                      const next = event.target.value as SpatialMeasurementKind;
                      setMeasurementKind(next);
                      setMeasurementLabel(
                        MEASUREMENT_TYPES.find((item) => item.value === next)?.label || 'Measurement'
                      );
                    }}
                  >
                    {MEASUREMENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Label
                  <input
                    value={measurementLabel}
                    onChange={(event) => setMeasurementLabel(event.target.value)}
                  />
                </label>
              </div>
              <div className="dimension-row">
                <label>
                  Feet
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    value={feet}
                    onChange={(event) => setFeet(event.target.value)}
                  />
                </label>
                <label>
                  Inches
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    value={inches}
                    onChange={(event) => setInches(event.target.value)}
                  />
                </label>
                <button className="add-button" onClick={addMeasurement}>Add</button>
              </div>
              {ar.supported && (
                <small className="ar-step-hint">For an AR estimate, choose the type and label above, start AR, then set two surface points.</small>
              )}

              <div className="measurement-list">
                {measurements.length === 0 ? (
                  <span className="empty-copy">No dimensions recorded yet.</span>
                ) : measurements.map((measurement) => (
                  <button
                    className="measurement-chip"
                    key={measurement.id}
                    title="Remove measurement"
                    onClick={() =>
                      setMeasurements((current) =>
                        current.filter((item) => item.id !== measurement.id)
                      )
                    }
                  >
                    <span>{measurement.label}{measurement.source === 'webxr-hit-test' ? ' · AR estimate' : ''}</span>
                    <b>{formatMeasurement(measurement.totalInches)}</b>
                  </button>
                ))}
              </div>

              <div className="metrics">
                <div><span>Area</span><b>{metrics.area ? `${metrics.area} ft²` : '—'}</b></div>
                <div><span>Volume</span><b>{metrics.volume ? `${metrics.volume} ft³` : '—'}</b></div>
              </div>
              {measurements.some((measurement) => measurement.source === 'webxr-hit-test') && (
                <p className="ar-warning">Area and volume include AR estimates. Verify before using them for materials or pricing.</p>
              )}
            </div>

            <div className="panel room-layout-panel">
              <div className="panel-title">
                <span>LAYOUT</span>
                <strong>Place room items</strong>
              </div>
              <p className="layout-copy">Add cabinets, fixtures, appliances, furniture, doors, or windows to a plan scaled from the measured room.</p>
              {roomLengthInches <= 0 || roomWidthInches <= 0 ? (
                <div className="layout-empty">Record both room length and width to unlock the measured-space plan.</div>
              ) : (
                <>
                  <div className="plan-measurements">
                    <span>{planIsTransposed ? 'Room width' : 'Room length'} <b>{formatMeasurement(planLengthInches)}</b></span>
                    <span>{planIsTransposed ? 'Room length' : 'Room width'} <b>{formatMeasurement(planWidthInches)}</b></span>
                  </div>
                  <div className="plan-wrap">
                    <div
                      className={`room-plan${isPlacingItem ? ' placing' : ''}`}
                      style={{
                        width: `min(100%, ${Math.min(400, Math.max(150, 320 * planAspect))}px)`,
                        aspectRatio: `${planLengthInches} / ${planWidthInches}`,
                      }}
                      onClick={placeItemOnPlan}
                      role="group"
                      tabIndex={0}
                      aria-label={`Measured room layout, ${formatMeasurement(roomLengthInches)} long by ${formatMeasurement(roomWidthInches)} wide${isPlacingItem ? '. Click to place the selected item.' : ''}`}
                      onKeyDown={(event) => {
                        if (isPlacingItem && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          finishItemPlacement(roomLengthInches / 2, roomWidthInches / 2);
                        }
                      }}
                    >
                      <div className="room-plan-grid" aria-hidden="true" />
                      {items.map((item) => {
                        const left = planIsTransposed
                          ? item.yInches / roomWidthInches
                          : item.xInches / roomLengthInches;
                        const top = planIsTransposed
                          ? item.xInches / roomLengthInches
                          : item.yInches / roomWidthInches;
                        const itemWidth = planIsTransposed
                          ? item.depthInches / roomWidthInches
                          : item.widthInches / roomLengthInches;
                        const itemHeight = planIsTransposed
                          ? item.widthInches / roomLengthInches
                          : item.depthInches / roomWidthInches;
                        return (
                          <button
                            type="button"
                            className={`room-item room-item-${item.category}`}
                            key={item.id}
                            style={{
                              left: `${left * 100}%`,
                              top: `${top * 100}%`,
                              width: `${itemWidth * 100}%`,
                              height: `${itemHeight * 100}%`,
                            }}
                            title={`Remove ${item.label} · ${formatMeasurement(item.widthInches)} × ${formatMeasurement(item.depthInches)}`}
                            aria-label={`Remove ${item.label}, ${formatMeasurement(item.widthInches)} by ${formatMeasurement(item.depthInches)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isPlacingItem) {
                                setStatus('Choose an open area of the plan to place this item.');
                                return;
                              }
                              removeSpatialItem(item.id);
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="item-form">
                    <label>
                      Item type
                      <select value={itemCategory} onChange={(event) => setItemCategory(event.target.value as SpatialItemCategory)}>
                        {SPATIAL_ITEM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label>
                      Name
                      <input value={itemLabel} maxLength={80} onChange={(event) => setItemLabel(event.target.value)} placeholder="Example: Base cabinet" />
                    </label>
                    <div className="item-size-grid">
                      <label>
                        Width (in)
                        <input type="number" inputMode="decimal" min="0.1" step="0.1" value={itemWidthInches} onChange={(event) => setItemWidthInches(event.target.value)} />
                      </label>
                      <label>
                        Depth (in)
                        <input type="number" inputMode="decimal" min="0.1" step="0.1" value={itemDepthInches} onChange={(event) => setItemDepthInches(event.target.value)} />
                      </label>
                      <label>
                        Height (in)
                        <input type="number" inputMode="decimal" min="0.1" step="0.1" value={itemHeightInches} onChange={(event) => setItemHeightInches(event.target.value)} placeholder="36 if blank" />
                      </label>
                    </div>
                    <div className="placement-actions">
                      <button type="button" className="add-button" disabled={isSaving} onClick={beginPlacingItem}>
                        {isPlacingItem ? 'Choose plan location' : 'Place on plan'}
                      </button>
                      {isPlacingItem && <button type="button" className="cancel-place" onClick={() => { setIsPlacingItem(false); setStatus('Item placement cancelled.'); }}>Cancel</button>}
                    </div>
                  </div>
                  <p className="plan-hint" role="status" aria-live="polite">
                    {isPlacingItem ? 'Tap an open area to place the footprint. Items stay inside the room boundary and cannot overlap.' : 'Tap an item on the plan to remove it.'}
                  </p>
                </>
              )}
              {items.length > 0 && (
                <ul className="room-item-list" aria-label="Items in this room">
                      {items.map((item) => (
                    <li key={item.id}>
                          <span><b>{item.label}</b><small>{item.category} · {formatMeasurement(item.widthInches)} × {formatMeasurement(item.depthInches)}{item.arTransform ? ' · visible in AR' : ''}</small></span>
                          <div className="room-item-actions">
                            {ar.supported && <button type="button" aria-label={`${item.arTransform ? 'Move' : 'Place'} ${item.label} in AR`} disabled={ar.starting || !capabilities.secureContext} onClick={() => {
                              setSelectedItemId(item.id);
                              setArAction('place-item');
                              arActionRef.current = 'place-item';
                              if (!ar.active) void startAR();
                            }}>{item.arTransform ? 'AR' : 'Place in AR'}</button>}
                            <button type="button" aria-label={`Remove ${item.label}`} onClick={() => removeSpatialItem(item.id)}>Remove</button>
                          </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">
                <span>ANNOTATE</span>
                <strong>Spatial notes</strong>
              </div>
              <label>
                Note
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Example: Replace this door with a 36-inch accessible opening."
                />
              </label>
              <label>
                Note type
                <select
                  value={noteCategory}
                  onChange={(event) => setNoteCategory(event.target.value as SpatialNoteCategory)}
                >
                  {NOTE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <small className="tap-hint">Type the note, then tap the room view where it belongs.</small>
              <div className="note-list">
                {notes.map((note, index) => (
                  <div className="note-row" key={note.id}>
                    <span>{index + 1}</span>
                    <div>
                      <b>{note.category}</b>
                      <p>{note.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="handoff-panel">
          <div>
            <span className="kicker">TURN THE SCAN INTO WORK</span>
            <h2>Use this room everywhere else.</h2>
            <p>Save once, then carry the same room context into the next tool.</p>
          </div>
          <div className="handoff-actions">
            <button type="button" disabled={isSaving} onClick={() => void handoffTask()}><span>✓</span> Create task</button>
            <button type="button" disabled={isSaving} onClick={() => void handoffQuote()}><span>▤</span> Start quote</button>
            <button type="button" disabled={isSaving} onClick={() => void handoffMaterials()}><span>◇</span> Estimate materials</button>
          </div>
        </section>

        <section className="history-panel">
          <div className="history-heading">
            <div>
              <span className="kicker">SAVED SPACES</span>
              <h2>Resume a room without starting over.</h2>
            </div>
            <span className="status-text" role="status" aria-live="polite">{status}</span>
          </div>
          <div className="history-grid">
            {savedSpaces.length === 0 ? (
              <div className="history-empty">Your first saved spatial workspace will appear here.</div>
            ) : savedSpaces.slice(0, 8).map((space) => (
              <button key={space.id} className="history-card" onClick={() => loadSpace(space)}>
                <span>{space.data.roomType.toUpperCase()}</span>
                <strong>{space.data.title}</strong>
                <small>
                  {space.data.measurements.length} measurements · {space.data.items.length} items · {space.data.notes.length} notes
                </small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        .spatial-page {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          background:
            radial-gradient(circle at 78% 2%, rgba(58, 132, 255, .10), transparent 25%),
            radial-gradient(circle at 12% 32%, rgba(79, 214, 172, .05), transparent 24%),
            #202020;
          color: #ececec;
        }
        .spatial-inner {
          width: min(1320px, calc(100% - 40px));
          margin: 0 auto;
          padding: 34px 0 80px;
        }
        .spatial-header {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 28px;
          margin-bottom: 18px;
        }
        .kicker {
          color: #9bb4d0;
          font-size: .68rem;
          font-weight: 800;
          letter-spacing: .16em;
        }
        h1 {
          margin: 8px 0 10px;
          font-size: clamp(2.2rem, 5vw, 4.4rem);
          line-height: .95;
          letter-spacing: -.055em;
          font-weight: 650;
        }
        .spatial-header p, .handoff-panel p {
          max-width: 720px;
          margin: 0;
          color: #aaa;
          line-height: 1.6;
          font-size: .9rem;
        }
        .header-actions, .viewer-toolbar, .handoff-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        button, .upload { font: inherit; }
        button:focus-visible, .upload:focus-within, .scan-stage:focus-visible {
          outline: 2px solid #9cc8ff;
          outline-offset: 3px;
        }
        button:disabled { opacity: .55; cursor: wait; }
        .primary, .ghost, .tool-button, .handoff-actions button {
          min-height: 42px;
          border-radius: 11px;
          padding: 0 14px;
          cursor: pointer;
        }
        .primary {
          border: 0;
          background: #f0f0f0;
          color: #111;
          font-weight: 750;
        }
        .ghost, .tool-button, .handoff-actions button {
          border: 1px solid #3b3b3b;
          background: #292929;
          color: #e8e8e8;
        }
        .capability-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .cap {
          min-height: 54px;
          border: 1px solid #343434;
          background: #252525;
          border-radius: 13px;
          padding: 10px 12px;
          color: #aaa;
          font-size: .68rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
        }
        .cap b { color: #b9b9b9; font-size: .72rem; }
        .cap.ok { border-color: rgba(96, 214, 161, .24); }
        .cap.ok b { color: #7dd8aa; }
        .workspace-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, .8fr);
          gap: 12px;
          align-items: start;
        }
        .viewer-panel, .inspector { min-width: 0; }
        .viewer-panel, .panel, .handoff-panel, .history-panel {
          border: 1px solid #343434;
          background: #242424;
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(0,0,0,.14);
        }
        .viewer-panel { padding: 10px; }
        .viewer-toolbar { padding: 2px 2px 10px; }
        .tool-button {
          min-height: 38px;
          font-size: .72rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .upload input { display: none; }
        .upload.disabled { opacity: .5; cursor: not-allowed; }
        .scan-stage {
          position: relative;
          width: 100%;
          min-width: 0;
          height: clamp(360px, 42vw, 560px);
          min-height: 0;
          aspect-ratio: auto;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid #3a3a3a;
          background:
            radial-gradient(circle at center, rgba(68, 125, 167, .14), transparent 42%),
            #111;
          cursor: crosshair;
          outline: none;
        }
        .camera, .photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera { display: none; }
        .camera.visible { display: block; }
        .ar-canvas { visibility: hidden; position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .ar-canvas.visible { visibility: visible; }
        .xr-dom-overlay { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
        .ar-controls { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: max-content; max-width: calc(100% - 20px); padding: 8px; border: 1px solid rgba(255,255,255,.22); border-radius: 14px; color: #fff; background: rgba(15,15,15,.82); backdrop-filter: blur(12px); pointer-events: auto; }
        .ar-controls p { flex-basis: 100%; margin: 0 4px; text-align: center; font-size: .72rem; }
        .ar-controls select { flex-basis: 100%; width: 100%; min-height: 38px; border: 1px solid #505b57; border-radius: 9px; padding: 0 10px; color: #fff; background: #252a28; font: inherit; font-size: .7rem; }
        .ar-controls button { min-height: 38px; padding: 0 11px; border: 1px solid #5b6d62; border-radius: 9px; color: #eafff1; background: #254033; font: inherit; font-size: .7rem; font-weight: 750; white-space: nowrap; cursor: pointer; }
        .ar-controls button:disabled { opacity: .48; cursor: wait; }
        .ar-controls .end-ar-overlay { border-color: #555; color: #eee; background: #333; }
        .scan-grid {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: .24;
          background-image:
            linear-gradient(rgba(116, 172, 218, .18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(116, 172, 218, .18) 1px, transparent 1px);
          background-size: 8.333% 12.5%;
        }
        .reticle {
          pointer-events: none;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 70px;
          height: 70px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255,255,255,.42);
          border-radius: 50%;
        }
        .reticle::before, .reticle::after {
          content: '';
          position: absolute;
          background: rgba(255,255,255,.42);
        }
        .reticle::before { width: 100px; height: 1px; left: -16px; top: 34px; }
        .reticle::after { width: 1px; height: 100px; left: 34px; top: -16px; }
        .reticle span {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fff;
          left: 31px;
          top: 31px;
          box-shadow: 0 0 0 5px rgba(255,255,255,.12);
        }
        .empty-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          justify-items: center;
          text-align: center;
          gap: 8px;
          padding: 24px;
          color: #cfcfcf;
        }
        .empty-stage small { color: #747474; }
        .scan-cube {
          width: 84px;
          height: 84px;
          position: relative;
          margin-bottom: 10px;
          transform: rotateX(58deg) rotateZ(45deg);
          border: 1px solid rgba(127, 186, 233, .7);
          box-shadow: 0 0 40px rgba(71, 150, 213, .12);
        }
        .scan-cube span {
          position: absolute;
          background: rgba(113, 178, 229, .5);
        }
        .scan-cube span:nth-child(1) { width: 1px; height: 100%; left: 50%; }
        .scan-cube span:nth-child(2) { height: 1px; width: 100%; top: 50%; }
        .scan-cube span:nth-child(3) { inset: 15px; border: 1px solid rgba(113, 178, 229, .38); background: transparent; }
        .pin {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 8px;
          border: 2px solid rgba(255,255,255,.8);
          color: #111;
          font-weight: 850;
          cursor: pointer;
          rotate: -45deg;
          box-shadow: 0 6px 20px rgba(0,0,0,.34);
        }
        .pin::first-letter { rotate: 45deg; }
        .pin-work { background: #9cc8ff; }
        .pin-damage { background: #ff9b9b; }
        .pin-material { background: #9fe0ba; }
        .pin-idea { background: #e7ca83; }
        .stage-status {
          position: absolute;
          left: 12px;
          bottom: 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 9px;
          background: rgba(15,15,15,.72);
          border: 1px solid rgba(255,255,255,.12);
          backdrop-filter: blur(10px);
          font-size: .58rem;
          font-weight: 800;
          letter-spacing: .1em;
        }
        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #777;
        }
        .live-dot.active {
          background: #6dd49d;
          box-shadow: 0 0 0 4px rgba(109,212,157,.12);
        }
        .accuracy-note {
          padding: 11px 5px 2px;
          color: #999;
          font-size: .68rem;
          line-height: 1.55;
        }
        .accuracy-note b { color: #a5a5a5; }
        .inspector {
          display: grid;
          gap: 10px;
        }
        .panel { padding: 15px; }
        .panel-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 12px;
        }
        .panel-title span {
          color: #6e8296;
          font-size: .58rem;
          letter-spacing: .14em;
          font-weight: 800;
        }
        .panel-title strong { font-size: .86rem; }
        label {
          display: grid;
          gap: 5px;
          color: #aaa;
          font-size: .66rem;
          margin-top: 9px;
        }
        input, select, textarea {
          width: 100%;
          border: 1px solid #3a3a3a;
          background: #1e1e1e;
          color: #eaeaea;
          border-radius: 10px;
          padding: 10px 11px;
          outline: 0;
        }
        textarea {
          min-height: 80px;
          resize: vertical;
        }
        input:focus, select:focus, textarea:focus {
          border-color: #617c96;
          box-shadow: 0 0 0 3px rgba(97,124,150,.12);
        }
        .field-grid, .dimension-row {
          display: grid;
          gap: 8px;
        }
        .field-grid { grid-template-columns: 1fr 1fr; }
        .dimension-row {
          grid-template-columns: 1fr 1fr auto;
          align-items: end;
        }
        .add-button {
          min-height: 38px;
          border: 0;
          border-radius: 10px;
          background: #e9e9e9;
          color: #111;
          font-weight: 800;
          padding: 0 13px;
          cursor: pointer;
        }
        .ar-step-hint { display: block; margin-top: 8px; color: #c9b77e; font-size: .61rem; line-height: 1.4; }
        .measurement-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .measurement-chip {
          border: 1px solid #3a3a3a;
          background: #2b2b2b;
          color: #aaa;
          border-radius: 9px;
          padding: 7px 9px;
          cursor: pointer;
          text-align: left;
        }
        .measurement-chip span, .measurement-chip b { display: block; }
        .measurement-chip span { font-size: .58rem; }
        .measurement-chip b { margin-top: 2px; color: #e6e6e6; font-size: .69rem; }
        .empty-copy, .tap-hint {
          display: block;
          color: #999;
          font-size: .62rem;
          margin-top: 9px;
        }
        .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-top: 12px;
        }
        .metrics div {
          border: 1px solid #343434;
          background: #202020;
          border-radius: 10px;
          padding: 9px;
        }
        .metrics span, .metrics b { display: block; }
        .metrics span { color: #999; font-size: .58rem; }
        .metrics b { color: #d9d9d9; margin-top: 3px; font-size: .76rem; }
        .ar-warning { margin: 9px 0 0; color: #e5c681; font-size: .64rem; line-height: 1.45; }
        .layout-copy { margin: -3px 0 10px; color: #929292; font-size: .64rem; line-height: 1.5; }
        .layout-empty { border: 1px dashed #414141; border-radius: 11px; padding: 14px; color: #9d9d9d; font-size: .68rem; line-height: 1.5; }
        .plan-measurements { display: flex; justify-content: space-between; gap: 10px; margin: 8px 0 7px; color: #909090; font-size: .58rem; }
        .plan-measurements span { display: grid; gap: 2px; }
        .plan-measurements span:last-child { text-align: right; }
        .plan-measurements b { color: #d8e3eb; font-size: .67rem; }
        .plan-wrap { display: flex; justify-content: center; overflow: hidden; padding: 4px 0; }
        .room-plan {
          position: relative;
          flex: 0 0 auto;
          overflow: hidden;
          border: 2px solid #a9bdcc;
          border-radius: 4px;
          background: #1c2327;
          box-shadow: 0 0 0 5px rgba(148, 179, 202, .06), inset 0 0 20px rgba(97, 137, 160, .08);
          cursor: default;
          outline: none;
          touch-action: manipulation;
        }
        .room-plan:focus-visible { outline: 2px solid #9cc8ff; outline-offset: 4px; }
        .room-plan.placing { border-color: #80ddb1; cursor: crosshair; box-shadow: 0 0 0 5px rgba(96, 214, 161, .13); }
        .room-plan-grid { position: absolute; inset: 0; pointer-events: none; opacity: .5; background-image: linear-gradient(rgba(132, 167, 186, .14) 1px, transparent 1px), linear-gradient(90deg, rgba(132, 167, 186, .14) 1px, transparent 1px); background-size: 12.5% 12.5%; }
        .room-item {
          position: absolute;
          z-index: 1;
          min-width: min(34px, 100%);
          min-height: 24px;
          display: grid;
          place-items: center;
          padding: 2px 4px;
          overflow: hidden;
          border: 1px solid rgba(238, 246, 250, .66);
          border-radius: 5px;
          color: #eff7f9;
          background: rgba(74, 137, 149, .78);
          box-shadow: 0 3px 8px rgba(0,0,0,.22);
          font-size: .54rem;
          line-height: 1.15;
          text-align: center;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        .room-item:hover { filter: brightness(1.22); }
        .room-item-cabinet { background: rgba(111, 128, 172, .86); }
        .room-item-appliance { background: rgba(112, 139, 154, .9); }
        .room-item-fixture { background: rgba(56, 143, 127, .88); }
        .room-item-furniture { background: rgba(160, 124, 84, .88); }
        .room-item-opening { background: rgba(157, 100, 110, .9); }
        .placement-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
        .placement-actions .add-button { flex: 1; }
        .cancel-place { min-height: 38px; padding: 0 12px; border: 1px solid #414141; border-radius: 10px; color: #ddd; background: #2d2d2d; cursor: pointer; }
        .item-size-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
        .plan-hint { margin: 7px 0 0; color: #9ac8b2; font-size: .61rem; line-height: 1.45; }
        .room-item-list { display: grid; gap: 5px; margin: 10px 0 0; padding: 0; list-style: none; }
        .room-item-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #303030; padding-top: 7px; }
        .room-item-list li > span { min-width: 0; display: grid; gap: 2px; }
        .room-item-list b { overflow: hidden; color: #d7d7d7; font-size: .65rem; text-overflow: ellipsis; white-space: nowrap; }
        .room-item-list small { color: #8f8f8f; font-size: .58rem; }
        .room-item-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; }
        .room-item-list button { border: 0; color: #f0a9a9; background: transparent; font-size: .61rem; cursor: pointer; }
        .room-item-list .room-item-actions button:first-child { color: #9cc8ff; }
        .note-list {
          display: grid;
          gap: 6px;
          margin-top: 10px;
        }
        .note-row {
          display: grid;
          grid-template-columns: 25px 1fr;
          gap: 8px;
          border-top: 1px solid #303030;
          padding-top: 8px;
        }
        .note-row > span {
          width: 23px;
          height: 23px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: #333;
          color: #bcbcbc;
          font-size: .64rem;
        }
        .note-row b {
          text-transform: uppercase;
          color: #999;
          font-size: .54rem;
          letter-spacing: .08em;
        }
        .note-row p {
          margin: 2px 0 0;
          color: #b7b7b7;
          font-size: .65rem;
          line-height: 1.4;
        }
        .handoff-panel {
          margin-top: 12px;
          padding: 18px;
          display: flex;
          justify-content: space-between;
          gap: 22px;
          align-items: center;
        }
        .handoff-panel h2, .history-panel h2 {
          margin: 4px 0 5px;
          font-size: 1.05rem;
        }
        .handoff-actions button {
          min-width: 136px;
          font-size: .72rem;
          font-weight: 700;
        }
        .handoff-actions button span { margin-right: 6px; }
        .history-panel {
          margin-top: 12px;
          padding: 18px;
        }
        .history-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 20px;
          margin-bottom: 12px;
        }
        .status-text { color: #aaa; font-size: .68rem; }
        .history-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
        }
        .history-card, .history-empty {
          min-height: 100px;
          border: 1px solid #353535;
          background: #292929;
          border-radius: 12px;
          padding: 12px;
          color: #ddd;
          text-align: left;
        }
        .history-card { cursor: pointer; }
        .history-card:hover { border-color: #4a4a4a; background: #2d2d2d; }
        .history-card span, .history-card strong, .history-card small { display: block; }
        .history-card span { color: #687b8f; font-size: .54rem; letter-spacing: .12em; }
        .history-card strong { margin-top: 8px; font-size: .78rem; }
        .history-card small { margin-top: 8px; color: #999; font-size: .6rem; }
        .history-empty {
          grid-column: 1 / -1;
          color: #686868;
          display: grid;
          place-items: center;
        }
        @media (max-width: 1050px) {
          .workspace-grid { grid-template-columns: 1fr; }
          .scan-stage { height: clamp(440px, 58vw, 720px); }
          .capability-row { grid-template-columns: repeat(2, 1fr); }
          .history-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 680px) {
          .spatial-inner {
            width: min(100% - 24px, 1320px);
            padding-top: 22px;
            padding-bottom: calc(110px + env(safe-area-inset-bottom));
          }
          .spatial-header, .handoff-panel, .history-heading {
            align-items: stretch;
            flex-direction: column;
          }
          .header-actions, .handoff-actions { width: 100%; }
          .header-actions > *, .handoff-actions > * { flex: 1; }
          .capability-row, .history-grid, .field-grid { grid-template-columns: 1fr; }
          .scan-stage { height: clamp(360px, 58vh, 620px); }
          .dimension-row { grid-template-columns: 1fr 1fr; }
          .add-button { grid-column: 1 / -1; }
          h1 { font-size: 2.5rem; }
        }
      `}</style>
    </div>
  );
}
