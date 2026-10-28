'use client';

import React from 'react';
import {
  formatMeasurement,
  type SpatialItemCategory,
  type SpatialMeasurementKind,
  type SpatialNoteCategory,
} from '../lib/spatialWorkspace';
import { MEASUREMENT_TYPES, NOTE_TYPES, ROOM_TYPES, SPATIAL_ITEM_TYPES } from './spatialWorkspaceShared';
import type { SpatialWorkspaceState } from './useSpatialWorkspaceState';

export default function SpatialInspectorPanel({ state }: { state: SpatialWorkspaceState }) {
  const {
    ar, capabilities, title, setTitle, roomType, setRoomType, measurements, items, notes, metrics, isSaving,
    measurementKind, setMeasurementKind, measurementLabel, setMeasurementLabel, feet, setFeet, inches, setInches,
    noteText, setNoteText, noteCategory, setNoteCategory, itemCategory, setItemCategory, itemLabel, setItemLabel,
    itemWidthInches, setItemWidthInches, itemDepthInches, setItemDepthInches, itemHeightInches, setItemHeightInches,
    isPlacingItem, setIsPlacingItem, setStatus, roomLengthInches, roomWidthInches, planIsTransposed,
    planLengthInches, planWidthInches, planAspect, addMeasurement, removeMeasurement, beginPlacingItem,
    finishItemPlacement, placeItemOnPlan, removeSpatialItem, placeItemInAr,
  } = state;

  return (
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
                    onClick={() => removeMeasurement(measurement.id)}
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
                            {ar.supported && <button type="button" aria-label={`${item.arTransform ? 'Move' : 'Place'} ${item.label} in AR`} disabled={ar.starting || !capabilities.secureContext} onClick={() => placeItemInAr(item.id)}>{item.arTransform ? 'AR' : 'Place in AR'}</button>}
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
  );
}
