'use client';

import React, { useState, useCallback } from 'react';
import { usePersonalization } from '../lib/hooks';
import { RichMedia } from './Richmedia';

interface UserPreferencesProps {
  userId: string;
  onSave?: () => void;
  compact?: boolean;
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  userId,
  onSave,
  compact = false,
}) => {
  const { profile, updatePreferences, metrics } = usePersonalization(userId);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPrefs, setTempPrefs] = useState<any>(null);

  const startEditing = useCallback(() => {
    if (profile) {
      setTempPrefs({ ...profile.preferences });
      setIsEditing(true);
    }
  }, [profile]);

  const handleSave = useCallback(() => {
    if (tempPrefs) {
      updatePreferences(tempPrefs);
      setIsEditing(false);
      onSave?.();
    }
  }, [tempPrefs, updatePreferences, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setTempPrefs(null);
  }, []);

  const handlePreferenceChange = useCallback((key: string, value: any) => {
    setTempPrefs((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  if (!profile) {
    return <div className="preferences-loading">Loading preferences...</div>;
  }

  const currentPrefs = isEditing ? tempPrefs : profile.preferences;

  return (
    <div className={`user-preferences ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="preferences-header">
          <div className="header-content">
            <RichMedia icon="settings" size="md" />
            <div>
              <h2>Preferences</h2>
              <p>Personalize your experience</p>
            </div>
          </div>
        </div>
      )}

      {!isEditing ? (
        <div className="preferences-view">
          {/* Theme Preference */}
          <div className="preference-item">
            <label className="preference-label">Theme</label>
            <div className="preference-value">{profile.preferences.theme}</div>
          </div>

          {/* Content Pace */}
          <div className="preference-item">
            <label className="preference-label">Content Pace</label>
            <div className="preference-value">
              {profile.preferences.contentPace}
            </div>
          </div>

          {/* Interaction Style */}
          <div className="preference-item">
            <label className="preference-label">Interaction Style</label>
            <div className="preference-value">
              {profile.preferences.interactionStyle}
            </div>
          </div>

          {/* Notifications */}
          <div className="preference-item">
            <label className="preference-label">Notification Frequency</label>
            <div className="preference-value">
              {profile.preferences.notificationFrequency}
            </div>
          </div>

          {/* Skip Optional */}
          <div className="preference-item">
            <label className="preference-label">Skip Optional Fields</label>
            <div className="preference-value">
              {profile.preferences.skipOptional ? 'Yes' : 'No'}
            </div>
          </div>

          {!compact && (
            <>
              {/* Metrics Section */}
              {metrics && (
                <div className="metrics-section">
                  <h3>Your Activity</h3>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Engagement</span>
                      <span className="metric-value">
                        {(metrics.engagementLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Completion Rate</span>
                      <span className="metric-value">
                        {(metrics.completionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Interactions</span>
                      <span className="metric-value">
                        {metrics.totalInteractions}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="preferences-actions">
                <button
                  className="btn-secondary"
                  onClick={startEditing}
                >
                  Edit Settings
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="preferences-edit">
          {/* Theme Selection */}
          <div className="edit-field">
            <label className="field-label">Theme</label>
            <div className="radio-group">
              {['light', 'dark'].map((theme) => (
                <label key={theme} className="radio-item">
                  <input
                    type="radio"
                    value={theme}
                    checked={currentPrefs.theme === theme}
                    onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  />
                  <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Content Pace */}
          <div className="edit-field">
            <label className="field-label">Content Pace</label>
            <select
              className="form-select"
              value={currentPrefs.contentPace}
              onChange={(e) =>
                handlePreferenceChange('contentPace', e.target.value)
              }
            >
              <option value="slow">Slow</option>
              <option value="medium">Medium</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          {/* Interaction Style */}
          <div className="edit-field">
            <label className="field-label">Interaction Style</label>
            <select
              className="form-select"
              value={currentPrefs.interactionStyle}
              onChange={(e) =>
                handlePreferenceChange('interactionStyle', e.target.value)
              }
            >
              <option value="text">Text</option>
              <option value="visual">Visual</option>
              <option value="conversational">Conversational</option>
            </select>
          </div>

          {/* Notification Frequency */}
          <div className="edit-field">
            <label className="field-label">Notification Frequency</label>
            <select
              className="form-select"
              value={currentPrefs.notificationFrequency}
              onChange={(e) =>
                handlePreferenceChange('notificationFrequency', e.target.value)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Skip Optional */}
          <div className="edit-field checkbox-field">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={currentPrefs.skipOptional}
                onChange={(e) =>
                  handlePreferenceChange('skipOptional', e.target.checked)
                }
              />
              <span>Skip optional fields automatically</span>
            </label>
          </div>

          <div className="edit-actions">
            <button className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Preferences
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-preferences {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .user-preferences.compact {
          background: transparent;
          box-shadow: none;
        }

        .preferences-header {
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
          padding: 1.5rem;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .preferences-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .preferences-header p {
          margin: 0.25rem 0 0;
          opacity: 0.9;
          font-size: 0.9rem;
        }

        .preferences-view,
        .preferences-edit {
          padding: 1.5rem;
        }

        .preference-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .preference-item:last-of-type {
          border-bottom: none;
        }

        .preference-label {
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
        }

        .preference-value {
          color: #666;
          font-size: 0.95rem;
          background: #f5f5f5;
          padding: 0.5rem 1rem;
          border-radius: 0.35rem;
        }

        .metrics-section {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #f0f0f0;
        }

        .metrics-section h3 {
          margin: 0 0 1rem;
          font-size: 1.1rem;
          color: #333;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
        }

        .metric-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #eef2ff 100%);
          border-radius: 0.75rem;
          border: 1px solid #e0e8ff;
        }

        .metric-label {
          font-size: 0.8rem;
          color: #666;
          margin-bottom: 0.5rem;
          font-weight: 500;
          text-align: center;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #4171ff;
        }

        .edit-field {
          margin-bottom: 1.5rem;
        }

        .edit-field:last-of-type {
          margin-bottom: 2rem;
        }

        .field-label {
          display: block;
          font-weight: 600;
          color: #333;
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
        }

        .form-select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-family: inherit;
          background-color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .form-select:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .radio-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .radio-item:hover {
          border-color: #4171ff;
          background-color: #f5f7fa;
        }

        .radio-item input {
          cursor: pointer;
          accent-color: #4171ff;
        }

        .checkbox-field {
          margin-bottom: 1rem;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .checkbox-item:hover {
          border-color: #4171ff;
          background-color: #f5f7fa;
        }

        .checkbox-item input {
          cursor: pointer;
          accent-color: #4171ff;
        }

        .preferences-actions,
        .edit-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #f0f0f0;
        }

        button {
          flex: 1;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.4);
        }

        .btn-secondary {
          background-color: #f0f0f0;
          color: #333;
          border: 2px solid #e0e0e0;
        }

        .btn-secondary:hover {
          background-color: #e8e8e8;
          border-color: #ccc;
        }

        .preferences-loading {
          padding: 2rem;
          text-align: center;
          color: #999;
        }

        @media (max-width: 768px) {
          .preferences-header {
            padding: 1rem;
          }

          .header-content {
            flex-direction: column;
            text-align: center;
          }

          .preferences-header h2 {
            font-size: 1.25rem;
          }

          .preferences-view,
          .preferences-edit {
            padding: 1rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .preference-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          button {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default UserPreferences;
