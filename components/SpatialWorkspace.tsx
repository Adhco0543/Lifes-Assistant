'use client';

import React from 'react';
import SpatialHistoryPanel from './SpatialHistoryPanel';
import SpatialInspectorPanel from './SpatialInspectorPanel';
import SpatialViewerPanel from './SpatialViewerPanel';
import { SPATIAL_WORKSPACE_CSS } from './spatialWorkspaceStyles';
import { useSpatialWorkspaceState } from './useSpatialWorkspaceState';

type SpatialWorkspaceProps = {
  userId: string;
  onNavigate: (view: string) => void;
};

export default function SpatialWorkspace({ userId, onNavigate }: SpatialWorkspaceProps) {
  const state = useSpatialWorkspaceState({ userId, onNavigate });
  const { ar, capabilities, isSaving, newSpace, safePersist, handoffTask, handoffQuote, handoffMaterials } = state;

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
          <SpatialViewerPanel state={state} />
          <SpatialInspectorPanel state={state} />
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

        <SpatialHistoryPanel state={state} />
      </div>

      <style>{SPATIAL_WORKSPACE_CSS}</style>
    </div>
  );
}
