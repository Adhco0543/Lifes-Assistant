'use client';

import React from 'react';
import type { SpatialWorkspaceState } from './useSpatialWorkspaceState';

export default function SpatialHistoryPanel({ state }: { state: SpatialWorkspaceState }) {
  const { status, savedSpaces, loadSpace } = state;
  return (
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
  );
}
