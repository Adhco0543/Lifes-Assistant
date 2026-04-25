'use client';

import React, { useState, useEffect } from 'react';

interface AppSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  emailDigest: boolean;
  defaultView: string;
  sidebarCollapsed: boolean;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  language: string;
}

interface AppCustomizationProps {
  userId: string;
  onSettingsChange?: (settings: AppSettings) => void;
}

export const AppCustomization: React.FC<AppCustomizationProps> = ({ userId, onSettingsChange }) => {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    notifications: true,
    emailDigest: false,
    defaultView: 'dashboard',
    sidebarCollapsed: false,
    compactMode: false,
    fontSize: 'medium',
    language: 'en',
  });

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem(`app_settings_${userId}`);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, [userId]);

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem(`app_settings_${userId}`, JSON.stringify(updated));
    onSettingsChange?.(updated);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '2rem' }}>App Customization</h1>

      {/* Display Settings */}
      <div style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>🎨 Display Settings</h2>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Theme */}
          <div>
            <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>Theme</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => handleSettingChange('theme', 'light')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: settings.theme === 'light' ? '#dbeafe' : '#f3f4f6',
                  border: `2px solid ${settings.theme === 'light' ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: settings.theme === 'light' ? '#3b82f6' : '#6b7280',
                  transition: 'all 0.2s ease',
                }}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => handleSettingChange('theme', 'dark')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: settings.theme === 'dark' ? '#1e293b' : '#f3f4f6',
                  border: `2px solid ${settings.theme === 'dark' ? '#64748b' : '#d1d5db'}`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: settings.theme === 'dark' ? '#64748b' : '#6b7280',
                  transition: 'all 0.2s ease',
                }}
              >
                🌙 Dark
              </button>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>Font Size</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => handleSettingChange('fontSize', size)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: settings.fontSize === size ? '#dbeafe' : '#f3f4f6',
                    border: `2px solid ${settings.fontSize === size ? '#3b82f6' : '#d1d5db'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: size === 'small' ? '0.875rem' : size === 'large' ? '1.1rem' : '1rem',
                    fontWeight: '600',
                    color: settings.fontSize === size ? '#3b82f6' : '#6b7280',
                    textTransform: 'capitalize',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>Compact Mode</span>
            <button
              onClick={() => handleSettingChange('compactMode', !settings.compactMode)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: settings.compactMode ? '#10b981' : '#d1d5db',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'white',
                  top: '2px',
                  left: settings.compactMode ? '24px' : '2px',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>🔔 Notifications</h2>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>Enable Notifications</span>
            <button
              onClick={() => handleSettingChange('notifications', !settings.notifications)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: settings.notifications ? '#10b981' : '#d1d5db',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'white',
                  top: '2px',
                  left: settings.notifications ? '24px' : '2px',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>Email Digest</label>
            <button
              onClick={() => handleSettingChange('emailDigest', !settings.emailDigest)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: settings.emailDigest ? '#10b981' : '#d1d5db',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'white',
                  top: '2px',
                  left: settings.emailDigest ? '24px' : '2px',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Default Settings */}
      <div style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>⚙️ Default Settings</h2>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label htmlFor="default-view" style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>Default View</label>
            <select
              id="default-view"
              name="default-view"
              value={settings.defaultView}
              onChange={(e) => handleSettingChange('defaultView', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              <option value="dashboard">Dashboard</option>
              <option value="chat">AI Chat</option>
              <option value="team">Team Workspace</option>
              <option value="tasks">Tasks</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>Language</label>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
