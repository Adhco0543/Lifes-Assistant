'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import { reportIntegrationFailure } from '../lib/integrationDiagnostics';
import {
  buildMaterialHandoff,
  calculateRoomMetrics,
  clampPin,
  formatMeasurement,
  measurementToInches,
  MAX_SPATIAL_IMAGE_DATA_URL_LENGTH,
  parseSpatialWorkspaceRecord,
  summarizeSpatialWorkspace,
  type SpatialMeasurement,
  type SpatialMeasurementKind,
  type SpatialNote,
  type SpatialNoteCategory,
  type SpatialWorkspaceRecord,
} from '../lib/spatialWorkspace';

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
  webAr: boolean | null;
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

  const [title, setTitle] = useState('New room scan');
  const [roomType, setRoomType] = useState('Room');
  const [createdAt, setCreatedAt] = useState(Date.now());
  const [recordId, setRecordId] = useState('');
  const [measurements, setMeasurements] = useState<SpatialMeasurement[]>([]);
  const [notes, setNotes] = useState<SpatialNote[]>([]);
  const [savedSpaces, setSavedSpaces] = useState<SavedSpace[]>([]);
  const [status, setStatus] = useState('Ready to map a space.');
  const [cameraActive, setCameraActive] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [capabilities, setCapabilities] = useState<CapabilityState>({
    camera: false,
    secureContext: false,
    webAr: null,
  });

  const [measurementKind, setMeasurementKind] = useState<SpatialMeasurementKind>('length');
  const [measurementLabel, setMeasurementLabel] = useState('Room length');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<SpatialNoteCategory>('work');

  const metrics = useMemo(() => calculateRoomMetrics(measurements), [measurements]);

  const currentRecord = useCallback((): SpatialWorkspaceRecord => ({
    title: title.trim() || 'Untitled space',
    roomType,
    ...(imageDataUrl ? { imageDataUrl } : {}),
    measurements,
    notes,
    createdAt,
    updatedAt: Date.now(),
  }), [createdAt, imageDataUrl, measurements, notes, roomType, title]);

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
      let webAr: boolean | null = null;

      try {
        const xr = (navigator as Navigator & {
          xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
        }).xr;
        if (xr?.isSessionSupported) {
          webAr = await xr.isSessionSupported('immersive-ar');
        } else {
          webAr = false;
        }
      } catch {
        webAr = false;
      }

      if (active) {
        setCapabilities({ camera, secureContext, webAr });
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

  const startCamera = async () => {
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
      },
    ]);
    setFeet('');
    setInches('');
    setStatus('Measurement added.');
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

      setStatus('Workspace saved with its room photo, measurements, and notes.');
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
        notes: 'Measurements were entered as verified field dimensions in Spatial Workspace.',
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
    stopCamera();
    setRecordId(space.id);
    setTitle(space.data.title);
    setRoomType(space.data.roomType);
    setMeasurements(space.data.measurements);
    setNotes(space.data.notes);
    setImageDataUrl(space.data.imageDataUrl || '');
    setPhotoUrl(space.data.imageDataUrl || '');
    setCreatedAt(space.data.createdAt);
    setFeet('');
    setInches('');
    setNoteText('');
    setStatus('Saved space loaded.');
  };

  const newSpace = () => {
    stopCamera();
    setRecordId('');
    setTitle('New room scan');
    setRoomType('Room');
    setMeasurements([]);
    setNotes([]);
    setImageDataUrl('');
    setPhotoUrl('');
    setCreatedAt(Date.now());
    setFeet('');
    setInches('');
    setNoteText('');
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
              Capture a room, record trusted field dimensions, pin work notes to the view,
              and hand the result directly into the rest of Life&apos;s Assistant.
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
          <span className={capabilities.webAr ? 'cap ok' : 'cap'}>
            <b>WebAR</b>{capabilities.webAr ? 'Supported' : 'Browser fallback'}
          </span>
          <span className="cap">
            <b>Depth / LiDAR</b>Native bridge planned
          </span>
        </div>

        <section className="workspace-grid">
          <div className="viewer-panel">
            <div className="viewer-toolbar">
              <button type="button" className="tool-button" disabled={isSaving} onClick={() => void startCamera()}>
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
              <label className="tool-button upload">
                Use photo
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
              </label>
            </div>

            <div
              className="scan-stage"
              onClick={pinNote}
              role="group"
              tabIndex={0}
              aria-label="Room view. Type a spatial note, then tap this view to place it. Press Enter or Space to place it at the center."
              onKeyDown={(event) => {
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
                className={cameraActive ? 'camera visible' : 'camera'}
                playsInline
                muted
              />
              {photoUrl && <img className="photo" src={photoUrl} alt="Selected room reference" />}
              {!cameraActive && !photoUrl && (
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

              <div className="scan-grid" aria-hidden="true" />
              <div className="reticle" aria-hidden="true"><span /></div>

              {notes.map((note, index) => (
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
                <span className={cameraActive ? 'live-dot active' : 'live-dot'} />
                {cameraActive ? 'LIVE CAMERA' : photoUrl ? 'REFERENCE PHOTO' : 'SPATIAL PLAN'}
              </div>
            </div>

            <div className="accuracy-note">
              <b>Accuracy rule:</b> camera pixels are not converted into real-world dimensions unless
              a supported depth provider supplies that data. Enter a verified measurement below so
              quotes and material estimates never inherit a guessed dimension.
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
                    <span>{measurement.label}</span>
                    <b>{formatMeasurement(measurement.totalInches)}</b>
                  </button>
                ))}
              </div>

              <div className="metrics">
                <div><span>Area</span><b>{metrics.area ? `${metrics.area} ft²` : '—'}</b></div>
                <div><span>Volume</span><b>{metrics.volume ? `${metrics.volume} ft³` : '—'}</b></div>
              </div>
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
                  {space.data.measurements.length} measurements · {space.data.notes.length} notes
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
        .scan-stage {
          position: relative;
          min-height: 560px;
          aspect-ratio: 16 / 10;
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
          .scan-stage { min-height: 440px; }
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
          .scan-stage { min-height: 360px; aspect-ratio: 3 / 4; }
          .dimension-row { grid-template-columns: 1fr 1fr; }
          .add-button { grid-column: 1 / -1; }
          h1 { font-size: 2.5rem; }
        }
      `}</style>
    </div>
  );
}
