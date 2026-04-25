'use client';

import React, { useState } from 'react';
import { MinimizablePanel } from './MinimizablePanel';

type SettingCategory = 'general' | 'notifications' | 'privacy' | 'appearance' | 'business' | 'ai-settings' | 'integrations';

interface SettingsHubProps {
  userId: string;
}

const SETTING_CATEGORIES: Array<{ id: SettingCategory; name: string; icon: string; description: string }> = [
  { id: 'general', name: 'General', icon: '⚙️', description: 'Basic app settings' },
  { id: 'notifications', name: 'Notifications', icon: '🔔', description: 'Manage notifications' },
  { id: 'privacy', name: 'Privacy & Security', icon: '🔒', description: 'Control your data' },
  { id: 'appearance', name: 'Appearance', icon: '🎨', description: 'Customize look & feel' },
  { id: 'business', name: 'Business', icon: '💼', description: 'Business settings' },
  { id: 'ai-settings', name: 'AI Settings', icon: '🤖', description: 'AI personality & memory' },
  { id: 'integrations', name: 'Integrations', icon: '🔗', description: 'Connected services' },
];

export const SettingsHub: React.FC<SettingsHubProps> = ({ userId }) => {
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('general');
  const [settings, setSettings] = useState({
    autoSave: true,
    tutorial: true,
    betaFeatures: false,
    emailNotifications: true,
    pushNotifications: true,
    chatNotifications: true,
    taskReminders: true,
    twoFactor: true,
    encryption: true,
    activityLogging: true,
    darkMode: false,
    compactView: false,
    timezone: 'UTC',
    language: 'English',
    businessName: '',
    businessType: 'Retail',
    aiPersonality: 'professional',
    aiMemory: '',
  });

  const handleCategoryClick = (categoryId: SettingCategory) => {
    setActiveCategory(categoryId);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const renderSettings = () => {
    switch (activeCategory) {
      case 'general':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>General Settings</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.autoSave} onChange={(e) => handleSettingChange('autoSave', e.target.checked)} />
                <span>Auto-save preferences</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.tutorial} onChange={(e) => handleSettingChange('tutorial', e.target.checked)} />
                <span>Display tutorial on startup</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.betaFeatures} onChange={(e) => handleSettingChange('betaFeatures', e.target.checked)} />
                <span>Enable beta features</span>
              </label>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>Notification Settings</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)} />
                <span>Email notifications</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.pushNotifications} onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)} />
                <span>Push notifications</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.chatNotifications} onChange={(e) => handleSettingChange('chatNotifications', e.target.checked)} />
                <span>Chat notifications</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.taskReminders} onChange={(e) => handleSettingChange('taskReminders', e.target.checked)} />
                <span>Task reminders</span>
              </label>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>Privacy & Security</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.twoFactor} onChange={(e) => handleSettingChange('twoFactor', e.target.checked)} />
                <span>Two-factor authentication</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.encryption} onChange={(e) => handleSettingChange('encryption', e.target.checked)} />
                <span>End-to-end encryption</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.activityLogging} onChange={(e) => handleSettingChange('activityLogging', e.target.checked)} />
                <span>Activity logging</span>
              </label>
              <button style={{ padding: '0.75rem', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                📥 Download my data
              </button>
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>Appearance</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Theme</label>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }} value={settings.darkMode ? 'Dark' : 'Light'} onChange={(e) => handleSettingChange('darkMode', e.target.value === 'Dark')}>
                  <option>Light</option>
                  <option>Dark</option>
                  <option>Auto</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Font Size</label>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}>
                  <option>Small</option>
                  <option>Medium</option>
                  <option>Large</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.compactView} onChange={(e) => handleSettingChange('compactView', e.target.checked)} />
                <span>Compact mode</span>
              </label>
            </div>
          </div>
        );
      case 'business':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>Business Settings</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Business Name</label>
                <input type="text" placeholder="Your business name" value={settings.businessName} onChange={(e) => handleSettingChange('businessName', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Business Type</label>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }} value={settings.businessType} onChange={(e) => handleSettingChange('businessType', e.target.value)}>
                  <option>Retail</option>
                  <option>Service</option>
                  <option>Food & Beverage</option>
                  <option>Professional Services</option>
                  <option>E-commerce</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked onChange={(e) => handleSettingChange('publicProfile', e.target.checked)} />
                <span>Public business profile</span>
              </label>
            </div>
          </div>
        );
      case 'ai-settings':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>🤖 AI Assistant Settings</h3>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>AI Personality</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#64748b' }}>Customize how the AI assistant interacts with you</p>
                <select style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }} value={settings.aiPersonality} onChange={(e) => handleSettingChange('aiPersonality', e.target.value)}>
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Direct</option>
                  <option>Detailed</option>
                  <option>Concise</option>
                </select>
              </div>
              
              <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#15803d' }}>Memory & Learning</h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked onChange={(e) => handleSettingChange('rememberPreferences', e.target.checked)} />
                    <span>Remember my preferences & history</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked onChange={(e) => handleSettingChange('trackRoutines', e.target.checked)} />
                    <span>Track my daily routines</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked onChange={(e) => handleSettingChange('improveRecommendations', e.target.checked)} />
                    <span>Improve recommendations over time</span>
                  </label>
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: '0.5rem', border: '1px solid #fed7aa' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#92400e' }}>Tell AI About Yourself</h4>
                <textarea 
                  placeholder="E.g., 'I usually work 9-5, handle email every morning, create quotes for clients on Fridays...'"
                  value={settings.aiMemory}
                  onChange={(e) => handleSettingChange('aiMemory', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: '0.5rem', 
                    border: '1px solid #d1d5db',
                    minHeight: '120px',
                    fontFamily: 'inherit',
                    fontSize: '0.95rem'
                  }} 
                />
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>The AI will use this to understand your workflow and routines</p>
              </div>
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div>
            <h3 style={{ marginTop: 0 }}>Connected Services</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Gmail</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Email management</p>
                </div>
                <button style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>✓ Connected</button>
              </div>
              <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Slack</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Team communication</p>
                </div>
                <button style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Connect</button>
              </div>
              <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Stripe</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Payment processing</p>
                </div>
                <button style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Connect</button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '2rem' }}>Settings</h1>

      {/* Settings Categories Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {SETTING_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={(e) => {
              console.log('[SettingsHub] Button clicked:', category.id);
              e.preventDefault();
              handleCategoryClick(category.id);
            }}
            style={{
              padding: '1.5rem',
              background: activeCategory === category.id ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'white',
              color: activeCategory === category.id ? 'white' : '#1f2937',
              border: activeCategory === category.id ? 'none' : '2px solid #e5e7eb',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '600',
            }}
            onMouseEnter={(e) => {
              if (activeCategory !== category.id) {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeCategory !== category.id) {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span style={{ fontSize: '1.75rem' }}>{category.icon}</span>
            <span>{category.name}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{category.description}</span>
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <MinimizablePanel
        title={`${SETTING_CATEGORIES.find(c => c.id === activeCategory)?.name || 'Settings'}`}
        icon={SETTING_CATEGORIES.find(c => c.id === activeCategory)?.icon}
        defaultMinimized={false}
      >
        {console.log('[SettingsHub] Rendering content for category:', activeCategory)}
        {renderSettings()}
      </MinimizablePanel>

      {/* Save Button */}
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          style={{
            padding: '0.75rem 2rem',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => alert('✅ Settings saved successfully!')}
          style={{
            padding: '0.75rem 2rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};
