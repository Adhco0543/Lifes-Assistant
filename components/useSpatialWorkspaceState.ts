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
import {
  buildScanMeasurement,
  createScanState,
  recordScanMeasurement,
  redoScan,
  skipScanStep,
  undoScan,
  type ScanState,
} from '../lib/spatialScan';
import { distanceInMeters, metersToInches, type WebXRPoint } from '../lib/webxrSpatial';
import {
  MEASUREMENT_TYPES,
  encodeSpatialImage,
  makeId,
  prepareSpatialImage,
  renderRoomSnapshot,
  type CapabilityState,
  type SavedSpace,
} from './spatialWorkspaceShared';

export type SpatialWorkspaceState = ReturnType<typeof useSpatialWorkspaceState>;

export function useSpatialWorkspaceState({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const savingRef = useRef(false);
  const firstArPointRef = useRef<WebXRPoint | null>(null);
  const wasArActiveRef = useRef(false);
  const arActionRef = useRef<'measure' | 'place-item'>('measure');
  const scanRef = useRef<ScanState | null>(null);
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
  const [scan, setScan] = useState<ScanState | null>(null);
  const [captureNotice, setCaptureNotice] = useState('');

  const updateScan = useCallback((next: ScanState | null) => {
    scanRef.current = next;
    setScan(next);
  }, []);

  const chooseArAction = useCallback((next: 'measure' | 'place-item') => {
    arActionRef.current = next;
    setArAction(next);
    firstArPointRef.current = null;
    setArPointStep(0);
  }, []);

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

    const activeScan = scanRef.current;
    const scanMeasurement = activeScan ? buildScanMeasurement(activeScan, makeId('ar-measurement'), inches) : null;
    if (activeScan && scanMeasurement) {
      setMeasurements((current) => [...current, scanMeasurement]);
      const nextScan = recordScanMeasurement(activeScan, scanMeasurement);
      updateScan(nextScan);
      firstArPointRef.current = null;
      setArPointStep(0);
      setStatus(nextScan.step >= 3
        ? `${scanMeasurement.label} recorded: ${formatMeasurement(inches)}. Room scan complete. Verify with a tape before quoting or ordering.`
        : `${scanMeasurement.label} recorded: ${formatMeasurement(inches)}. Continue with step ${nextScan.step + 1} of 3.`);
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
  }, [measurementKind, measurementLabel, updateScan]);
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
    setCaptureNotice('');
    setStatus('Starting WebXR AR…');
    try {
      await ar.start();
      setStatus(scanRef.current
        ? 'AR is live. Room scan: set two points for each step.'
        : arActionRef.current === 'place-item'
          ? 'AR is live. Select an item, aim at a surface, and place its 3D box preview.'
          : 'AR is live. Center the reticle on a surface, then set two points to measure.');
    } catch (error) {
      updateScan(null);
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      setStatus(name === 'NotAllowedError'
        ? 'AR needs camera and motion permission. Allow access in the browser and try again.'
        : name === 'NotSupportedError'
          ? 'This browser or device does not provide the AR hit-testing feature. Continue with the camera or manual dimensions.'
          : 'Could not start WebXR AR. Use a compatible browser on a supported device, or continue with the camera/photo tools.');
    }
  };

  const stopAR = async () => {
    try {
      await ar.stop();
    } finally {
      firstArPointRef.current = null;
      setArPointStep(0);
      updateScan(null);
      setCaptureNotice('');
      setStatus('AR session ended. Saved item footprints remain; place their AR previews again in a new session.');
    }
  };

  const startArMeasure = () => {
    updateScan(null);
    chooseArAction('measure');
    void startAR();
  };

  const startScanRoom = () => {
    chooseArAction('measure');
    updateScan(createScanState());
    setStatus('Room scan started. Step 1 of 3: set a point at each end of the room length.');
    if (!ar.active) void startAR();
  };

  const startPlaceItems = () => {
    if (items.length === 0) {
      setStatus('Add an item to the room plan first (needs a measured length and width), then place it in AR.');
      return;
    }
    updateScan(null);
    chooseArAction('place-item');
    if (!ar.active) void startAR();
  };

  const toggleArAction = () => {
    updateScan(null);
    chooseArAction(arActionRef.current === 'measure' ? 'place-item' : 'measure');
  };

  const placeItemInAr = (itemId: string) => {
    setSelectedItemId(itemId);
    updateScan(null);
    chooseArAction('place-item');
    if (!ar.active) void startAR();
  };

  const skipScanStepAction = () => {
    const current = scanRef.current;
    if (!current) return;
    firstArPointRef.current = null;
    setArPointStep(0);
    const next = skipScanStep(current);
    updateScan(next);
    setStatus(next.step >= 3 ? 'Room scan complete.' : `Step skipped. Continue with step ${next.step + 1} of 3.`);
  };

  const undoScanStepAction = () => {
    const current = scanRef.current;
    if (!current) return;
    if (firstArPointRef.current) {
      firstArPointRef.current = null;
      setArPointStep(0);
      setStatus('First point cleared. Set it again.');
      return;
    }
    const result = undoScan(current);
    if (!result) {
      setStatus('Nothing to undo yet.');
      return;
    }
    updateScan(result.state);
    const removed = result.removed;
    if (removed) setMeasurements((list) => list.filter((measurement) => measurement.id !== removed.id));
    setStatus(`Undid step ${result.state.step + 1} of 3.`);
  };

  const redoScanStepAction = () => {
    const current = scanRef.current;
    if (!current) return;
    const result = redoScan(current);
    if (!result) {
      setStatus('Nothing to redo.');
      return;
    }
    updateScan(result.state);
    const restored = result.restored;
    if (restored) setMeasurements((list) => [...list, restored]);
    setStatus('Step restored.');
  };

  const endScan = () => {
    updateScan(null);
    firstArPointRef.current = null;
    setArPointStep(0);
    setStatus('Room scan finished. You can keep measuring, or exit AR.');
  };

  useEffect(() => {
    const wasActive = wasArActiveRef.current;
    wasArActiveRef.current = ar.active;
    if (!ar.active) {
      firstArPointRef.current = null;
      setArPointStep(0);
      if (wasActive) {
        updateScan(null);
        setCaptureNotice('');
        setItems((current) => current.map((item) => {
          if (!item.arTransform) return item;
          const next = { ...item };
          delete next.arTransform;
          return next;
        }));
        setStatus((current) => current.startsWith('AR is live') || current.startsWith('First AR point set') || current.startsWith('Room scan')
          ? 'AR session ended.'
          : current);
      }
    }
    ar.setAnchor(ar.active && arPointStep === 1 ? firstArPointRef.current : null);
  }, [ar.active, arPointStep, ar.setAnchor, updateScan]);

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
      setCaptureNotice('');
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

  const captureSnapshot = () => {
    try {
      const dataUrl = renderRoomSnapshot({
        title: title.trim() || 'Untitled space',
        roomType,
        measurements,
        items,
        roomLengthInches,
        roomWidthInches,
      });
      setImageDataUrl(dataUrl);
      setPhotoUrl(dataUrl);
      if (ar.active) {
        setCaptureNotice('A live photo is not possible during AR because the page cannot read the AR camera feed. A snapshot of the measured room plan was saved instead.');
        setStatus('Snapshot of the measured room captured (plan and measurements). It is not a camera photo.');
      } else {
        setStatus('Snapshot of the measured room captured. Open the camera if you also want a photo.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not capture this room snapshot.');
    }
  };

  const capture = () => {
    if (cameraActive && !ar.active) {
      captureCameraFrame();
      return;
    }
    if (measurements.length === 0 && items.length === 0) {
      setStatus(ar.active
        ? 'Nothing to capture yet. Measure the room first, or choose Exit AR and take a photo.'
        : 'Nothing to capture yet. Open the rear camera for a photo, or scan the room first.');
      if (ar.active) setCaptureNotice('A live photo is not possible during AR because the page cannot read the AR camera feed.');
      return;
    }
    captureSnapshot();
  };

  const exitArAndTakePhoto = async () => {
    await stopAR();
    await startCamera();
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
  const removeMeasurement = (id: string) => {
    setMeasurements((current) => current.filter((item) => item.id !== id));
  };

  const addNoteAtCenter = () => {
    const text = noteText.trim();
    if (!text) return;
    setNotes((current) => [
      ...current,
      { id: makeId('note'), text, category: noteCategory, x: 50, y: 50 },
    ]);
    setNoteText('');
    setStatus('Spatial note pinned to center.');
  };

  const removeNote = (id: string) => {
    setNotes((current) => current.filter((item) => item.id !== id));
    setStatus('Spatial note removed.');
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
    chooseArAction('measure');
    updateScan(null);
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
    chooseArAction('measure');
    updateScan(null);
    setImageDataUrl('');
    setPhotoUrl('');
    setCreatedAt(Date.now());
    setFeet('');
    setInches('');
    setNoteText('');
    setIsPlacingItem(false);
    setStatus('New spatial workspace ready.');
  };
  const selectedItem = items.find((item) => item.id === selectedItemId) || items[0];

  return {
    ar, userId, videoRef,
    title, setTitle, roomType, setRoomType,
    measurements, notes, items, savedSpaces, status, setStatus,
    cameraActive, photoUrl, isSaving, capabilities,
    measurementKind, setMeasurementKind, measurementLabel, setMeasurementLabel,
    feet, setFeet, inches, setInches,
    noteText, setNoteText, noteCategory, setNoteCategory,
    arPointStep, itemCategory, setItemCategory, itemLabel, setItemLabel,
    itemWidthInches, setItemWidthInches, itemDepthInches, setItemDepthInches,
    itemHeightInches, setItemHeightInches, isPlacingItem, setIsPlacingItem,
    selectedItemId, setSelectedItemId, selectedItem, arAction, scan, captureNotice,
    metrics, roomLengthInches, roomWidthInches, planIsTransposed,
    planLengthInches, planWidthInches, planAspect,
    startAR, stopAR, startArMeasure, startScanRoom, startPlaceItems, toggleArAction, placeItemInAr,
    skipScanStepAction, undoScanStepAction, redoScanStepAction, endScan,
    startCamera, stopCamera, handlePhoto, captureCameraFrame, capture, exitArAndTakePhoto,
    addMeasurement, removeMeasurement, beginPlacingItem, finishItemPlacement, placeItemOnPlan,
    removeSpatialItem, pinNote, addNoteAtCenter, removeNote,
    safePersist, handoffTask, handoffQuote, handoffMaterials, loadSpace, newSpace,
  };
}
