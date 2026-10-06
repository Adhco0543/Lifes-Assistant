'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type SettingCategory = 'general' | 'assistant' | 'appearance' | 'privacy' | 'integrations';

interface SettingsHubProps {
  userId: string;
}

type Preferences = {
  assistantName: string;
  tone: 'concise' | 'balanced' | 'detailed';
  memoryEnabled: boolean;
  compactMode: boolean;
  timezone: string;
};

const CATEGORIES: Array<{ id: SettingCategory; label: string; icon: string; note: string }> = [
  { id: 'general', label: 'General', icon: '⚙', note: 'Workspace basics' },
  { id: 'assistant', label: 'Assistant', icon: '✦', note: 'Name, tone & memory' },
  { id: 'appearance', label: 'Appearance', icon: '◐', note: 'Interface preferences' },
  { id: 'privacy', label: 'Privacy', icon: '◇', note: 'What is stored where' },
  { id: 'integrations', label: 'Integrations', icon: '↗', note: 'External services' },
];

const DEFAULTS: Preferences = {
  assistantName: "Life's Assistant",
  tone: 'balanced',
  memoryEnabled: true,
  compactMode: false,
  timezone: 'America/New_York',
};

export const SettingsHub: React.FC<SettingsHubProps> = ({ userId }) => {
  const storageKey = `lifes-assistant-preferences:${userId}`;
  const [active, setActive] = useState<SettingCategory>('general');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      let localPrefs = DEFAULTS;

      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          localPrefs = { ...DEFAULTS, ...JSON.parse(stored) };
        }
      } catch {
        localPrefs = DEFAULTS;
      }

      try {
        const cloudPrefs = await firebaseBackend.getLatestDraft('assistant-preferences');
        if (!active) return;

        setPrefs({
          ...localPrefs,
          assistantName: String(cloudPrefs?.assistantName || localPrefs.assistantName),
          tone:
            cloudPrefs?.tone === 'concise' || cloudPrefs?.tone === 'detailed'
              ? cloudPrefs.tone
              : 'balanced',
          memoryEnabled:
            typeof cloudPrefs?.memoryEnabled === 'boolean'
              ? cloudPrefs.memoryEnabled
              : localPrefs.memoryEnabled,
        });
      } catch {
        if (active) setPrefs(localPrefs);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [storageKey]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
      localStorage.setItem('chatbot_name:' + userId, prefs.assistantName);

      await firebaseBackend.saveDraft('assistant-preferences', {
        assistantName: prefs.assistantName,
        tone: prefs.tone,
        memoryEnabled: prefs.memoryEnabled,
        updatedAt: Date.now(),
      });

      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setSaved(false);
    }
  };

  const clearLocal = () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem('chatbot_name:' + userId);
    setPrefs(DEFAULTS);
    setSaved(false);
  };

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <header>
          <span className="eyebrow">SETTINGS</span>
          <h1>Make the assistant yours.</h1>
          <p>Only settings that actually do something are shown here. Placeholder security badges and fake connected apps have been removed.</p>
        </header>

        <div className="settings-grid">
          <aside className="category-list">
            {CATEGORIES.map((category) => (
              <button key={category.id} className={active === category.id ? 'active' : ''} onClick={() => setActive(category.id)}>
                <span className="category-icon">{category.icon}</span>
                <span><strong>{category.label}</strong><small>{category.note}</small></span>
              </button>
            ))}
          </aside>

          <section className="settings-card">
            {active === 'general' && (
              <div className="section-content">
                <div className="section-title"><span className="eyebrow">GENERAL</span><h2>Workspace basics</h2></div>
                <label className="field">
                  <span>Timezone</span>
                  <select value={prefs.timezone} onChange={(event) => update('timezone', event.target.value)}>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                  <small>Used by future scheduling features.</small>
                </label>
                <div className="truth-card">
                  <strong>Account workspace</strong>
                  <p>Your sign-in is handled by Firebase Authentication. Allen can create a different account so his chat workspace is not your chat workspace.</p>
                </div>
              </div>
            )}

            {active === 'assistant' && (
              <div className="section-content">
                <div className="section-title"><span className="eyebrow">ASSISTANT</span><h2>How it should work with you</h2></div>
                <label className="field">
                  <span>Assistant name</span>
                  <input value={prefs.assistantName} maxLength={30} onChange={(event) => update('assistantName', event.target.value)} />
                  <small>This name follows your signed-in account.</small>
                </label>
                <label className="field">
                  <span>Response style</span>
                  <select value={prefs.tone} onChange={(event) => update('tone', event.target.value as Preferences['tone'])}>
                    <option value="concise">Concise</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                  <small>Stored with your assistant workspace and used by the production behavior layer.</small>
                </label>
                <label className="switch-row">
                  <div><strong>Remember useful context</strong><small>Keep conversation history available for signed-in chat.</small></div>
                  <input type="checkbox" checked={prefs.memoryEnabled} onChange={(event) => update('memoryEnabled', event.target.checked)} />
                </label>
              </div>
            )}

            {active === 'appearance' && (
              <div className="section-content">
                <div className="section-title"><span className="eyebrow">APPEARANCE</span><h2>Clean by default</h2></div>
                <div className="truth-card"><strong>Dark workspace</strong><p>The release candidate uses one carefully tuned dark theme so every screen stays consistent before more themes are added.</p></div>
                <label className="switch-row">
                  <div><strong>Compact mode</strong><small>Preference is saved now; component density support will roll out screen by screen.</small></div>
                  <input type="checkbox" checked={prefs.compactMode} onChange={(event) => update('compactMode', event.target.checked)} />
                </label>
              </div>
            )}

            {active === 'privacy' && (
              <div className="section-content">
                <div className="section-title"><span className="eyebrow">PRIVACY</span><h2>Clear claims, no security theater</h2></div>
                <div className="truth-card good"><strong>Account-scoped conversations</strong><p>Firestore chat records are stored under the signed-in Firebase user ID in the current backend structure.</p></div>
                <div className="truth-card"><strong>Local preferences</strong><p>Some interface preferences and local task-list data are stored in this browser using localStorage.</p></div>
                <div className="truth-card warning"><strong>Not claiming end-to-end encryption</strong><p>The old mock setting was removed because the app should never advertise protection that has not actually been implemented and verified.</p></div>
                <button className="danger-button" onClick={clearLocal}>Clear local interface preferences</button>
              </div>
            )}

            {active === 'integrations' && (
              <div className="section-content">
                <div className="section-title"><span className="eyebrow">INTEGRATIONS</span><h2>Connect real tools, not pretend buttons</h2></div>
                {['Email', 'Calendar', 'Google Drive'].map((name) => (
                  <div className="integration-row" key={name}>
                    <div><strong>{name}</strong><small>Not connected inside this beta yet.</small></div>
                    <span>Planned</span>
                  </div>
                ))}
                <div className="truth-card"><strong>Why this matters</strong><p>Life&apos;s Assistant should only say it sent, scheduled, uploaded, or changed something after a real connected service confirms the action.</p></div>
              </div>
            )}

            <div className="save-row"><span className={`saved ${saved ? 'show' : ''}`}>Saved</span><button onClick={save}>Save preferences</button></div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .settings-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .settings-inner { width: min(1080px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { margin-bottom: 24px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { color: #858585; max-width: 720px; line-height: 1.55; font-size: .8rem; margin: 0; }
        .settings-grid { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 12px; }
        .category-list, .settings-card { border: 1px solid #343434; background: #262626; border-radius: 17px; }
        .category-list { padding: 8px; height: fit-content; }
        .category-list button { width: 100%; border: 0; background: transparent; color: #aaa; border-radius: 10px; min-height: 54px; display: grid; grid-template-columns: 30px 1fr; gap: 8px; align-items: center; padding: 7px 9px; text-align: left; cursor: pointer; }
        .category-list button:hover, .category-list button.active { background: #303030; color: #eee; }
        .category-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: #343434; font-size: .72rem; }
        .category-list strong, .category-list small { display: block; }
        .category-list strong { font-size: .75rem; }
        .category-list small { color: #696969; font-size: .62rem; margin-top: 2px; }
        .settings-card { min-height: 520px; padding: 22px; display: flex; flex-direction: column; }
        .section-content { display: grid; gap: 14px; }
        .section-title { margin-bottom: 2px; }
        .section-title h2 { margin: 5px 0 0; font-size: 1.05rem; }
        .field { display: grid; gap: 7px; padding: 14px; background: #2b2b2b; border: 1px solid #353535; border-radius: 13px; }
        .field > span, .switch-row strong { font-size: .75rem; font-weight: 650; }
        .field input, .field select { min-height: 40px; border: 1px solid #414141; border-radius: 9px; background: #222; color: #e8e8e8; padding: 0 10px; outline: none; }
        .field small, .switch-row small { color: #6f6f6f; font-size: .64rem; line-height: 1.4; }
        .switch-row { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 14px; background: #2b2b2b; border: 1px solid #353535; border-radius: 13px; }
        .switch-row strong, .switch-row small { display: block; }
        .switch-row small { margin-top: 3px; }
        .switch-row input { width: 18px; height: 18px; accent-color: #efefef; }
        .truth-card { padding: 14px; border-radius: 13px; background: #2b2b2b; border: 1px solid #353535; }
        .truth-card.good { border-color: rgba(99,210,151,.28); }
        .truth-card.warning { border-color: rgba(225,191,115,.28); }
        .truth-card strong { font-size: .75rem; }
        .truth-card p { margin: 5px 0 0; color: #777; font-size: .68rem; line-height: 1.5; }
        .integration-row { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; border: 1px solid #353535; background: #2b2b2b; border-radius: 13px; }
        .integration-row strong, .integration-row small { display: block; }
        .integration-row strong { font-size: .75rem; }
        .integration-row small { color: #6f6f6f; font-size: .64rem; margin-top: 3px; }
        .integration-row > span { color: #8c8c8c; background: #343434; border-radius: 999px; padding: 4px 8px; font-size: .62rem; }
        .danger-button { justify-self: start; min-height: 39px; padding: 0 12px; border-radius: 10px; border: 1px solid #4a3535; color: #cc8b8b; background: #302626; cursor: pointer; }
        .save-row { margin-top: auto; padding-top: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
        .save-row button { min-height: 40px; border: 0; border-radius: 10px; padding: 0 14px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .saved { color: #72ce9c; font-size: .68rem; opacity: 0; transition: opacity .15s ease; }
        .saved.show { opacity: 1; }
        @media (max-width: 760px) {
          .settings-inner { width: calc(100% - 28px); padding-top: 24px; }
          .settings-grid { grid-template-columns: 1fr; }
          .category-list { display: flex; gap: 5px; overflow-x: auto; }
          .category-list button { min-width: 128px; grid-template-columns: 26px 1fr; }
          .settings-card { min-height: 470px; }
        }
      `}</style>
    </div>
  );
};

export default SettingsHub;
