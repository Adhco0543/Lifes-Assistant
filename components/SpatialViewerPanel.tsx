'use client';

import React from 'react';
import { currentScanStep, isScanComplete, scanProgressLabel } from '../lib/spatialScan';
import type { SpatialWorkspaceState } from './useSpatialWorkspaceState';

const stopOverlayEvent = (event: React.SyntheticEvent) => event.stopPropagation();
const overlayGuardProps = {
  onPointerDown: stopOverlayEvent,
  onPointerUp: stopOverlayEvent,
  onTouchStart: stopOverlayEvent,
  onTouchEnd: stopOverlayEvent,
  onClick: stopOverlayEvent,
};

function ScanFlowControls({ state, inOverlay }: { state: SpatialWorkspaceState; inOverlay?: boolean }) {
  const { scan } = state;
  if (!scan) return null;
  const complete = isScanComplete(scan);
  const step = currentScanStep(scan);
  return (
    <div className={inOverlay ? 'scan-flow in-overlay' : 'scan-flow'} role="group" aria-label="Guided room scan">
      <p className="scan-flow-text" role="status" aria-live="polite">
        <b>{complete ? 'Room scan complete' : `Scan room · ${scanProgressLabel(scan)}: ${step?.label}`}</b>
        {complete ? 'Length, width and height are recorded. Verify with a tape.' : step?.instruction}
      </p>
      <button type="button" aria-label="Skip this scan step" disabled={complete} onClick={(event) => { event.stopPropagation(); state.skipScanStepAction(); }}>Skip</button>
      <button type="button" aria-label="Undo last scan step" disabled={scan.done.length === 0 && state.arPointStep === 0} onClick={(event) => { event.stopPropagation(); state.undoScanStepAction(); }}>Undo</button>
      <button type="button" aria-label="Redo scan step" disabled={scan.undone.length === 0} onClick={(event) => { event.stopPropagation(); state.redoScanStepAction(); }}>Redo</button>
      <button type="button" aria-label="Finish room scan" onClick={(event) => { event.stopPropagation(); state.endScan(); }}>{complete ? 'Done' : 'Stop scan'}</button>
    </div>
  );
}

export default function SpatialViewerPanel({ state }: { state: SpatialWorkspaceState }) {
  const {
    ar, items, notes, noteText, noteCategory, cameraActive, photoUrl, isSaving, capabilities,
    selectedItemId, selectedItem, arAction, arPointStep, scan, captureNotice, videoRef,
  } = state;
  const arUnavailable = !ar.supported || !capabilities.secureContext;

  return (
    <div className="viewer-panel">
      <p className="ar-hint-banner">
        Tip: if a Vercel preview toolbar or comment bubble floats over the AR view, tap it only after exiting AR.
        If AR ever feels stuck, use End AR below or press Esc.
      </p>
      <div className="viewer-toolbar" role="toolbar" aria-label="Spatial camera controls">
        {!ar.active && (
          <button type="button" className="tool-button primary-tool" aria-label="Scan room: guided length, width and ceiling height in AR" title={arUnavailable ? 'Needs a WebXR AR browser on a secure (HTTPS) connection.' : 'Guided AR scan: room length, width, then ceiling height.'} disabled={isSaving || ar.starting || arUnavailable} onClick={state.startScanRoom}>
            {ar.starting ? 'Starting AR…' : 'Scan room'}
          </button>
        )}
        {!ar.active && (
          <button type="button" className="tool-button primary-tool" aria-label="Place items in AR" title={items.length === 0 ? 'Add an item to the room plan first.' : 'Preview a room item as a 3D box in AR.'} disabled={isSaving || ar.starting || arUnavailable} onClick={state.startPlaceItems}>
            Place items
          </button>
        )}
        {!ar.active && (
          <button type="button" className="tool-button" aria-label="Start AR measure" title="Measure any distance with two tracked surface points." disabled={isSaving || ar.starting || arUnavailable} onClick={state.startArMeasure}>
            Start AR measure
          </button>
        )}
        {ar.active && (
          <button type="button" className="tool-button" aria-label="End AR" onClick={() => void state.stopAR()}>
            End AR
          </button>
        )}
        <button type="button" className="tool-button primary-tool" aria-label="Capture snapshot" title="Camera mode saves a photo. In AR it saves a snapshot of the measured room." disabled={isSaving} onClick={state.capture}>
          Capture
        </button>
        <button type="button" className="tool-button" aria-label={cameraActive ? 'Restart rear camera' : 'Open rear camera'} disabled={isSaving || ar.active} onClick={() => void state.startCamera()}>
          {cameraActive ? 'Restart camera' : 'Open rear camera'}
        </button>
        {cameraActive && (
          <button type="button" className="tool-button" aria-label="Stop camera" disabled={isSaving} onClick={state.stopCamera}>Stop camera</button>
        )}
        <label className={`tool-button upload ${ar.active ? 'disabled' : ''}`}>
          Use photo
          <input type="file" accept="image/*" capture="environment" aria-label="Use a room photo" disabled={ar.active} onChange={state.handlePhoto} />
        </label>
      </div>
      {!ar.supported && ar.supported !== null && (
        <small className="ar-step-hint">AR scanning needs a WebXR-capable browser (for example Chrome on Android). You can still use the camera, a photo, or manual dimensions.</small>
      )}
      <ScanFlowControls state={state} />
      {captureNotice && !ar.active && (
        <div className="capture-notice" role="status">
          <p>{captureNotice}</p>
          <button type="button" aria-label="Open the camera to take a photo" onClick={() => void state.startCamera()}>Take a photo</button>
        </div>
      )}

      <div
        className="scan-stage"
        onClick={ar.active ? undefined : state.pinNote}
        role="group"
        tabIndex={0}
        aria-label="Room view. Type a spatial note, then tap this view to place it. Press Enter or Space to place it at the center."
        onKeyDown={(event) => {
          if (ar.active) return;
          if ((event.key === 'Enter' || event.key === ' ') && noteText.trim()) {
            event.preventDefault();
            state.addNoteAtCenter();
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
                    state.removeNote(note.id);
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
            <>
              <button
                type="button"
                className="ar-exit-button"
                aria-label="Exit AR"
                {...overlayGuardProps}
                onClick={(event) => { event.stopPropagation(); void state.stopAR(); }}
              >
                Exit AR
              </button>
              <p className="ar-exit-hint">Stuck? Tap Exit AR (top right) or press Esc.</p>
              <div className="ar-controls" {...overlayGuardProps}>
                <p>{scan
                  ? isScanComplete(scan) ? 'Room scan complete' : `Scan room · ${scanProgressLabel(scan)}: ${currentScanStep(scan)?.label}. ${arPointStep === 1 ? 'First point set. Move to the other end.' : ar.surfaceAvailable ? 'Surface detected' : 'Move slowly to find a surface'}`
                  : arAction === 'place-item'
                    ? `Place ${selectedItem?.label || 'an item'} at the reticle. AR placements are temporary to this session.`
                    : arPointStep === 1
                      ? 'First point set. Move to the other end.'
                      : ar.surfaceAvailable ? 'Surface detected' : 'Move slowly to find a surface'}</p>
                {items.length > 0 && !scan && (
                  <select
                    aria-label="AR item to place"
                    value={selectedItemId || items[0].id}
                    onChange={(event) => state.setSelectedItemId(event.target.value)}
                  >
                    {items.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.widthInches} × {item.depthInches} in</option>)}
                  </select>
                )}
                {scan && <ScanFlowControls state={state} inOverlay />}
                <button
                  type="button"
                  aria-label={arAction === 'place-item' ? 'Place item at reticle' : arPointStep === 0 ? 'Set first point' : 'Set second point'}
                  disabled={!ar.surfaceAvailable || (arAction === 'place-item' && items.length === 0) || Boolean(scan && isScanComplete(scan))}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!ar.placeCurrentPoint()) state.setStatus('No surface detected at the reticle.');
                  }}
                >
                  {arAction === 'place-item'
                    ? selectedItem?.arTransform ? 'Move item to reticle' : 'Place item at reticle'
                    : arPointStep === 0 ? 'Set first point' : 'Set second point'}
                </button>
                {!scan && (
                  <button type="button" className="end-ar-overlay" aria-label="Start guided room scan" onClick={(event) => { event.stopPropagation(); state.startScanRoom(); }}>
                    Scan room
                  </button>
                )}
                {arAction === 'place-item' && selectedItem && (
                  <button type="button" className="end-ar-overlay" aria-label="Remove selected item" onClick={(event) => { event.stopPropagation(); state.removeSpatialItem(selectedItem.id); }}>
                    Remove selected item
                  </button>
                )}
                {items.length > 0 && !scan && (
                  <button type="button" className="end-ar-overlay" aria-label={arAction === 'measure' ? 'Switch to placing room items' : 'Switch to measuring distance'} onClick={(event) => { event.stopPropagation(); state.toggleArAction(); }}>
                    {arAction === 'measure' ? 'Place room item' : 'Measure distance'}
                  </button>
                )}
                <button type="button" className="end-ar-overlay" aria-label="Capture snapshot of the measured room" onClick={(event) => { event.stopPropagation(); state.capture(); }}>
                  Capture
                </button>
                {captureNotice && (
                  <>
                    <p className="ar-note" role="status">{captureNotice}</p>
                    <button type="button" className="end-ar-overlay" aria-label="Exit AR and take a photo" onClick={(event) => { event.stopPropagation(); void state.exitArAndTakePhoto(); }}>
                      Exit AR and take a photo
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

            <div className="accuracy-note">
              <b>AR preview:</b> WebXR measurements are estimates and can drift; verify with a tape before quoting or ordering. Room items appear as dimensioned 3D box previews. Their live AR positions last for the current session; saved workspaces keep their measured 2D footprints and dimensions. Capture in AR saves a snapshot of the measured room, not a camera photo. This web flow does not collect a LiDAR/depth map.
            </div>
    </div>
  );
}
