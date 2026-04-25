'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { businessProfileManager, BusinessProfile } from '../lib/businessProfile';
import { RichMedia } from './Richmedia';

interface MaterialEstimatorProps {
  userId: string;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category: string;
}

interface Estimate {
  id: string;
  projectName: string;
  materials: Material[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: number;
}

interface MeasurementData {
  length: number;
  width: number;
  height: number;
  area: number;
  volume: number;
}

export const MaterialEstimator: React.FC<MaterialEstimatorProps> = ({ userId }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [view, setView] = useState<'input' | 'estimate' | 'history'>('input');
  const [projectName, setProjectName] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementData>({
    length: 0,
    width: 0,
    height: 0,
    area: 0,
    volume: 0,
  });

  const [materials, setMaterials] = useState<Material[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [materialCategory, setMaterialCategory] = useState('lumber');
  const [materialQuantity, setMaterialQuantity] = useState<number | ''>('');
  const [materialUnit, setMaterialUnit] = useState('');
  const [materialUnitPrice, setMaterialUnitPrice] = useState<number | ''>('');

  // Material categories and presets
  const materialCategories: Record<string, { units: string[]; presets: Record<string, number> }> = {
    lumber: {
      units: ['Board Feet (BF)', 'Linearly Feet (LF)', 'Pieces'],
      presets: {
        '2x4': 2.50,
        '2x6': 3.75,
        '2x8': 5.00,
        'Plywood 3/4"': 45.00,
      },
    },
    hardware: {
      units: ['Box', 'Piece', 'Set'],
      presets: {
        'Nails (1 lb)': 8.00,
        'Screws (1 lb)': 12.00,
        'Hinges': 5.00,
        'Bolts/Nuts': 15.00,
      },
    },
    paint: {
      units: ['Gallon', 'Quart', 'Can'],
      presets: {
        'Paint (Gallon)': 35.00,
        'Primer': 28.00,
        'Stain': 32.00,
      },
    },
    electrical: {
      units: ['Box', 'Roll', 'Piece', 'Feet'],
      presets: {
        'Wire (100 ft)': 25.00,
        'Outlet Box': 1.50,
        'Switch': 2.00,
        'Breaker': 35.00,
      },
    },
    plumbing: {
      units: ['Piece', 'Feet', 'Box', 'Set'],
      presets: {
        'PVC Pipe (10 ft)': 15.00,
        'Faucet': 45.00,
        'Valve': 20.00,
        'Fitting': 3.00,
      },
    },
    general: {
      units: ['Piece', 'Quantity', 'Box', 'Set'],
      presets: {
        'Generic Material': 10.00,
      },
    },
  };

  // Initialize
  useEffect(() => {
    const profile = businessProfileManager.loadProfile(userId);
    if (profile) {
      setBusinessProfile(profile);

      // Load saved estimates
      const saved = localStorage.getItem(`estimates_${userId}`);
      if (saved) {
        try {
          setEstimates(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading estimates:', e);
        }
      }
    }
  }, [userId]);

  /**
   * Calculate measurements based on length/width
   */
  const handleUpdateMeasurements = useCallback(
    (field: keyof MeasurementData, value: number) => {
      const updated = { ...measurements, [field]: value };

      // Calculate area and volume automatically
      if (field === 'length' || field === 'width') {
        updated.area = updated.length * updated.width;
      }
      if (field === 'length' || field === 'width' || field === 'height') {
        updated.volume = updated.length * updated.width * updated.height;
      }

      setMeasurements(updated);

      integration.trackUserAction('measurement_updated', 'material_estimator', {
        field,
        value,
      });
    },
    [measurements, integration]
  );

  /**
   * Add material to estimate
   */
  const handleAddMaterial = useCallback(() => {
    if (!materialName.trim() || !materialQuantity || !materialUnitPrice) {
      alert('Please fill in all material fields');
      return;
    }

    const material: Material = {
      id: `mat-${Date.now()}`,
      name: materialName,
      quantity: Number(materialQuantity),
      unit: materialUnit,
      unitPrice: Number(materialUnitPrice),
      total: Number(materialQuantity) * Number(materialUnitPrice),
      category: materialCategory,
    };

    setMaterials((prev) => [...prev, material]);
    setMaterialName('');
    setMaterialQuantity('');
    setMaterialUnit('');
    setMaterialUnitPrice('');

    integration.trackUserAction('material_added', 'material_estimator', {
      name: materialName,
      quantity: materialQuantity,
    });
  }, [materialName, materialQuantity, materialUnit, materialUnitPrice, materialCategory, integration]);

  /**
   * Remove material
   */
  const handleRemoveMaterial = (materialId: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== materialId));
  };

  /**
   * Generate estimate
   */
  const handleGenerateEstimate = useCallback(() => {
    if (!projectName.trim() || materials.length === 0) {
      alert('Please enter a project name and add at least one material');
      return;
    }

    const subtotal = materials.reduce((sum, m) => sum + m.total, 0);
    const tax = subtotal * 0.1; // 10% tax

    const estimate: Estimate = {
      id: `est-${Date.now()}`,
      projectName,
      materials,
      subtotal,
      tax,
      total: subtotal + tax,
      createdAt: Date.now(),
    };

    const updated = [estimate, ...estimates];
    setEstimates(updated);
    localStorage.setItem(`estimates_${userId}`, JSON.stringify(updated));

    setSelectedEstimate(estimate);
    setView('estimate');

    integration.trackUserAction('estimate_generated', 'material_estimator', {
      projectName,
      materialCount: materials.length,
      total: estimate.total,
    });
  }, [projectName, materials, estimates, userId, integration]);

  /**
   * Delete estimate
   */
  const handleDeleteEstimate = useCallback(
    (estimateId: string) => {
      const updated = estimates.filter((e) => e.id !== estimateId);
      setEstimates(updated);
      localStorage.setItem(`estimates_${userId}`, JSON.stringify(updated));
      if (selectedEstimate?.id === estimateId) {
        setSelectedEstimate(null);
        setView('history');
      }

      integration.trackUserAction('estimate_deleted', 'material_estimator', {
        estimateId,
      });
    },
    [estimates, selectedEstimate, userId, integration]
  );

  /**
   * Export estimate
   */
  const handleExportEstimate = useCallback(
    (estimate: Estimate) => {
      let csv = 'Material Estimate\n';
      csv += `Project: ${estimate.projectName}\n`;
      csv += `Date: ${new Date(estimate.createdAt).toLocaleDateString()}\n\n`;
      csv += 'Material,Quantity,Unit,Unit Price,Total\n';

      estimate.materials.forEach((m) => {
        csv += `${m.name},${m.quantity},${m.unit},$${m.unitPrice.toFixed(2)},$${m.total.toFixed(2)}\n`;
      });

      csv += `\nSubtotal,$${estimate.subtotal.toFixed(2)}\n`;
      csv += `Tax (10%),$${estimate.tax.toFixed(2)}\n`;
      csv += `Total,$${estimate.total.toFixed(2)}\n`;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estimate_${estimate.id}.csv`;
      link.click();

      integration.trackUserAction('estimate_exported', 'material_estimator', {
        estimateId: estimate.id,
      });
    },
    [integration]
  );

  return (
    <div className={`material-estimator ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <div className="estimator-header">
        <h2>
          <RichMedia icon="settings" size="lg" /> Material Estimator
        </h2>
        <p>Calculate materials needed for your projects</p>
      </div>

      {/* Tabs */}
      <div className="tab-navigation">
        <button
          className={`tab ${view === 'input' ? 'active' : ''}`}
          onClick={() => setView('input')}
        >
          New Estimate
        </button>
        <button
          className={`tab ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          History ({estimates.length})
        </button>
      </div>

      {/* Content */}
      <div className="estimator-content">
        {view === 'input' && (
          <div className="input-view">
            <div className="form-section">
              <h3>Project Information</h3>
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Deck Project, Bathroom Renovation"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Project Dimensions</h3>
              <div className="measurements-grid">
                <div className="form-group">
                  <label>Length (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.length || ''}
                    onChange={(e) =>
                      handleUpdateMeasurements('length', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Width (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.width || ''}
                    onChange={(e) =>
                      handleUpdateMeasurements('width', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Height (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements.height || ''}
                    onChange={(e) =>
                      handleUpdateMeasurements('height', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              {measurements.area > 0 && (
                <div className="calc-results">
                  <p>Area: {measurements.area.toFixed(2)} sq ft</p>
                  {measurements.volume > 0 && (
                    <p>Volume: {measurements.volume.toFixed(2)} cu ft</p>
                  )}
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>Add Materials</h3>

              <div className="material-form">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={materialCategory}
                    onChange={(e) => {
                      setMaterialCategory(e.target.value);
                      setMaterialUnit('');
                    }}
                  >
                    {Object.keys(materialCategories).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Material Name *</label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    placeholder="e.g., 2x4 Lumber"
                  />
                  {materialCategory in materialCategories && (
                    <div className="presets">
                      {Object.entries(
                        materialCategories[materialCategory].presets
                      ).map(([name, price]) => (
                        <button
                          key={name}
                          className="preset-btn"
                          onClick={() => {
                            setMaterialName(name);
                            setMaterialUnitPrice(price);
                          }}
                        >
                          {name} (${price})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={materialUnit}
                    onChange={(e) => setMaterialUnit(e.target.value)}
                  >
                    <option value="">Select unit...</option>
                    {materialCategory in materialCategories &&
                      materialCategories[materialCategory].units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={materialQuantity}
                    onChange={(e) =>
                      setMaterialQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="form-group">
                  <label>Unit Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialUnitPrice}
                    onChange={(e) =>
                      setMaterialUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                  />
                </div>

                <button className="btn-add-material" onClick={handleAddMaterial}>
                  + Add Material
                </button>
              </div>
            </div>

            {materials.length > 0 && (
              <div className="form-section">
                <h3>Materials List</h3>
                <table className="materials-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr key={m.id}>
                        <td>{m.name}</td>
                        <td>{m.quantity}</td>
                        <td>{m.unit}</td>
                        <td>${m.unitPrice.toFixed(2)}</td>
                        <td>${m.total.toFixed(2)}</td>
                        <td>
                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveMaterial(m.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="materials-total">
                  <p>Subtotal: ${materials.reduce((sum, m) => sum + m.total, 0).toFixed(2)}</p>
                </div>

                <button className="btn-generate" onClick={handleGenerateEstimate}>
                  Generate Estimate
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'estimate' && selectedEstimate && (
          <div className="estimate-view">
            <div className="estimate-header">
              <h3>{selectedEstimate.projectName}</h3>
              <p className="estimate-date">
                {new Date(selectedEstimate.createdAt).toLocaleDateString()}
              </p>
            </div>

            <table className="estimate-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedEstimate.materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.quantity}</td>
                    <td>{m.unit}</td>
                    <td>${m.unitPrice.toFixed(2)}</td>
                    <td>${m.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="estimate-totals">
              <div className="total-row">
                <span>Subtotal:</span>
                <span>${selectedEstimate.subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax (10%):</span>
                <span>${selectedEstimate.tax.toFixed(2)}</span>
              </div>
              <div className="total-row grand-total">
                <span>TOTAL:</span>
                <span>${selectedEstimate.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="estimate-actions">
              <button className="btn-export" onClick={() => handleExportEstimate(selectedEstimate)}>
                Export CSV
              </button>
              <button className="btn-back" onClick={() => setView('input')}>
                New Estimate
              </button>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="history-view">
            {estimates.length === 0 ? (
              <div className="empty-state">
                <RichMedia type="visual" size="lg" />
                <h3>No estimates yet</h3>
                <p>Create your first material estimate</p>
              </div>
            ) : (
              <div className="estimates-grid">
                {estimates.map((est) => (
                  <div key={est.id} className="estimate-card">
                    <div className="card-header">
                      <h4>{est.projectName}</h4>
                      <span className="card-total">${est.total.toFixed(2)}</span>
                    </div>
                    <p className="card-date">
                      {new Date(est.createdAt).toLocaleDateString()}
                    </p>
                    <p className="card-count">{est.materials.length} materials</p>
                    <div className="card-actions">
                      <button
                        className="btn-view"
                        onClick={() => {
                          setSelectedEstimate(est);
                          setView('estimate');
                        }}
                      >
                        View
                      </button>
                      <button
                        className="btn-export-small"
                        onClick={() => handleExportEstimate(est)}
                      >
                        Export
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteEstimate(est.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .material-estimator {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .estimator-header {
          background: linear-gradient(135deg, #ff6f00 0%, #f57c00 100%);
          color: white;
          padding: 2rem;
        }

        .estimator-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .estimator-header p {
          margin: 0.5rem 0 0;
          opacity: 0.9;
        }

        .tab-navigation {
          display: flex;
          border-bottom: 2px solid #f0f0f0;
          background: #fafafa;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          border: none;
          background: none;
          font-size: 1rem;
          font-weight: 600;
          color: #999;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s ease;
        }

        .tab.active {
          color: #ff6f00;
          border-bottom-color: #ff6f00;
        }

        .estimator-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
        }

        .input-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-section h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #333;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
        }

        .form-group input,
        .form-group select {
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #ff6f00;
          box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.1);
        }

        .measurements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
        }

        .calc-results {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 0.5rem;
          margin-top: 1rem;
        }

        .calc-results p {
          margin: 0.5rem 0;
          color: #333;
          font-weight: 600;
        }

        .material-form {
          background: #f9f9f9;
          padding: 1.5rem;
          border-radius: 0.75rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
        }

        .presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-top: 0.5rem;
        }

        .preset-btn {
          padding: 0.375rem 0.75rem;
          background: #e0e0e0;
          border: none;
          border-radius: 0.4rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .preset-btn:hover {
          background: #ff6f00;
          color: white;
        }

        .btn-add-material {
          grid-column: span 1;
          padding: 0.75rem 1.5rem;
          background: #ff6f00;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-add-material:hover {
          background: #e65100;
          transform: translateY(-2px);
        }

        .materials-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }

        .materials-table th,
        .materials-table td {
          padding: 0.75rem;
          text-align: right;
          border-bottom: 1px solid #f0f0f0;
        }

        .materials-table th:first-child,
        .materials-table td:first-child {
          text-align: left;
        }

        .materials-table th {
          background: #fafafa;
          font-weight: 700;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #f44336;
          cursor: pointer;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .materials-total {
          text-align: right;
          font-weight: 700;
          font-size: 1.1rem;
          color: #333;
          padding: 1rem 0;
          border-top: 2px solid #f0f0f0;
        }

        .btn-generate {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          align-self: flex-start;
        }

        .btn-generate:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(255, 111, 0, 0.4);
        }

        .estimate-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .estimate-header h3 {
          margin: 0;
          font-size: 1.5rem;
          color: #333;
        }

        .estimate-date {
          margin: 0.5rem 0 0;
          color: #999;
          font-size: 0.9rem;
        }

        .estimate-table {
          width: 100%;
          border-collapse: collapse;
        }

        .estimate-table th,
        .estimate-table td {
          padding: 1rem;
          text-align: right;
          border-bottom: 1px solid #f0f0f0;
        }

        .estimate-table th:first-child,
        .estimate-table td:first-child {
          text-align: left;
        }

        .estimate-table th {
          background: #fafafa;
          font-weight: 700;
        }

        .estimate-totals {
          background: #f5f5f5;
          padding: 1.5rem;
          border-radius: 0.75rem;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          font-size: 1rem;
        }

        .total-row.grand-total {
          font-size: 1.3rem;
          font-weight: 700;
          color: #333;
          border-top: 2px solid #e0e0e0;
          padding-top: 0.75rem;
        }

        .estimate-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-export,
        .btn-back {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-export {
          background: #ff6f00;
          color: white;
          border-color: #ff6f00;
        }

        .btn-export:hover {
          background: #e65100;
          transform: translateY(-2px);
        }

        .btn-back:hover {
          border-color: #ff6f00;
          color: #ff6f00;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 300px;
          color: #999;
        }

        .empty-state h3 {
          margin: 1rem 0 0.5rem;
          color: #333;
        }

        .estimates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .estimate-card {
          border: 2px solid #f0f0f0;
          border-radius: 0.75rem;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }

        .estimate-card:hover {
          border-color: #ff6f00;
          box-shadow: 0 4px 12px rgba(255, 111, 0, 0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .card-header h4 {
          margin: 0;
          color: #333;
        }

        .card-total {
          font-size: 1.3rem;
          font-weight: 700;
          color: #ff6f00;
        }

        .card-date {
          margin: 0 0 0.25rem;
          font-size: 0.85rem;
          color: #999;
        }

        .card-count {
          margin: 0 0 1rem;
          font-size: 0.9rem;
          color: #666;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-view,
        .btn-export-small,
        .btn-delete {
          flex: 1;
          padding: 0.5rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-view {
          background: #ff6f00;
          color: white;
          border-color: #ff6f00;
        }

        .btn-view:hover {
          background: #e65100;
        }

        .btn-export-small:hover {
          border-color: #2196f3;
          color: #2196f3;
        }

        .btn-delete:hover {
          border-color: #f44336;
          color: #f44336;
        }

        @media (max-width: 768px) {
          .estimator-content {
            padding: 1.5rem;
          }

          .material-form {
            grid-template-columns: 1fr;
          }

          .measurements-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .estimates-grid {
            grid-template-columns: 1fr;
          }

          .material-estimator.mobile .estimator-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MaterialEstimator;
