'use client';

import React, { useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import { normalizeLifePreferences, PRIMARY_SLIPS, type CapturePreference, type LifeMode } from '../lib/lifePreferences';

interface ProgressiveOnboardingProps {
  userId?: string;
  onComplete?: (data: Record<string, any>) => void;
  onStepChange?: (step: number) => void;
}

type StepId = 'mode' | 'slips' | 'capture' | 'confirm';

const steps: Array<{ id: StepId; title: string; kicker: string; description: string }> = [
  {
    id: 'mode', title: 'How do you mostly want to use Life’s Assistant?', kicker: 'YOUR MODE',
    description: 'You can change this later.',
  },
  {
    id: 'slips', title: 'What do you most often forget or let sit too long?', kicker: 'YOUR PRIORITIES',
    description: 'We’ll prioritize this in Life Radar. Choose the one you most want to stay on top of.',
  },
  {
    id: 'capture', title: 'How do you usually capture things?', kicker: 'CAPTURE',
    description: 'Optional. Choose a preference or skip to finish setup.',
  },
  {
    id: 'confirm', title: 'You’re set.', kicker: 'READY',
    description: 'Here’s what Life’s Assistant will prioritize for you.',
  },
];

export const ProgressiveOnboarding: React.FC<ProgressiveOnboardingProps> = ({
  userId = 'guest',
  onComplete,
  onStepChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<LifeMode | null>(null);
  const [primarySlips, setPrimarySlips] = useState<string[]>([]);
  const [capturePref, setCapturePref] = useState<CapturePreference>('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const step = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const canContinue = step.id === 'mode' ? mode !== null : step.id !== 'slips' || (primarySlips.length > 0 && primarySlips.length <= 3);

  const toggleSlip = (item: string) => {
    setPrimarySlips((current) => item === 'unsure'
      ? current.includes(item) ? [] : ['unsure']
      : current.includes(item) ? current.filter((value) => value !== item && value !== 'unsure') : current.includes('unsure') ? [item] : current.length >= 3 ? current : [...current, item]);
  };

  const next = async () => {
    if (!canContinue || saving) return;

    if (stepIndex < steps.length - 1) {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      onStepChange?.(nextIndex + 1);
      return;
    }

    setSaving(true);
    setStatus('Saving your workspace…');

    try {
      if (!mode) throw new Error('Choose a mode to continue.');
      const completedAt = new Date().toISOString();
      const choices = normalizeLifePreferences({ mode, primary_slips: primarySlips, capture_pref: capturePref });
      const profile = {
        mode: choices.mode,
        primary_slips: choices.primary_slips,
        capture_pref: capturePref || null,
        onboarding_completed_at: completedAt,
        tool_overrides: { pinned: [], hidden: [] },
      };

      await firebaseBackend.updateUserProfile(userId, profile);
      try {
        await firebaseBackend.saveDraft('assistant-preferences', profile);
      } catch (error) {
        console.warn('Life preferences were saved, but the compatibility copy could not be updated:', error);
      }
      try {
        localStorage.setItem(`lifes-assistant-preferences:${userId}`, JSON.stringify(profile));
      } catch (error) {
        console.warn('Life preferences were saved to the account, but not to local storage:', error);
      }

      onComplete?.({
        timestamp: Date.now(),
        workspaceName: 'My Life',
        businessName: 'My Life',
        businessType: mode === 'business' ? 'business' : mode === 'everyday' ? 'personal' : 'mix',
        mode,
        primary_slips: choices.primary_slips,
        capture_pref: capturePref || null,
      });
    } catch {
      setStatus('I could not save the setup. Try again.');
      setSaving(false);
    }
  };

  const back = () => {
    if (stepIndex === 0 || saving) return;
    const nextIndex = stepIndex - 1;
    setStepIndex(nextIndex);
    onStepChange?.(nextIndex + 1);
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-shell">
        <aside className="story-panel">
          <div className="brand-mark">✦</div>
          <span className="brand">Life&apos;s Assistant</span>
          <h1>One assistant for the parts of life that usually live in separate apps.</h1>
          <p>
            Conversations become tasks, notes, quotes, briefs, memories, and verified actions without making you rebuild the context every time.
          </p>

          <div className="principles">
            <div><span>01</span><strong>Remember on purpose</strong><small>You decide what survives.</small></div>
            <div><span>02</span><strong>Act with approval</strong><small>No pretending an action happened.</small></div>
            <div><span>03</span><strong>Leave receipts</strong><small>Important actions create proof.</small></div>
          </div>
        </aside>

        <main className="setup-panel">
          <div className="progress-row">
            <span>{step.kicker}</span>
            <strong>{stepIndex + 1} / {steps.length}</strong>
          </div>
          <div className="progress-track"><div style={{ width: progress + '%' }} /></div>

          <div className="step-copy">
            <h2>{step.title}</h2>
            <p>{step.description}</p>
          </div>

          {step.id === 'mode' && (
            <>
              <div className="option-grid">
                {([
                  ['everyday', 'Everyday / Personal', 'Follow-ups, appointments, home & admin'], ['business', 'Business / Freelance / Contractor', 'Quotes, clients, projects, materials'], ['mix', 'Mix of both', 'A bit of personal and business work'],
                ] as Array<[LifeMode, string, string]>).map(([value, label, description]) => (
                  <button type="button" key={value} className={mode === value ? 'option selected' : 'option'} onClick={() => {
                      setMode(value);
                      setStatus('');
                      const nextIndex = 1;
                      setStepIndex(nextIndex);
                      onStepChange?.(nextIndex + 1);
                    }} aria-pressed={mode === value}>
                    <span className="option-mark">{mode === value ? '✓' : '+'}</span><span><b>{label}</b><small className="option-description">{description}</small></span>
                  </button>
                ))}
              </div>
              <p className="selection-feedback" aria-live="polite">
                {mode ? `${mode === 'everyday' ? 'Everyday / Personal' : mode === 'business' ? 'Business / Freelance / Contractor' : 'Mix of both'} selected.` : 'Choose one option to continue.'}
              </p>
            </>
          )}

          {step.id === 'slips' && (
            <>
            <p className="slip-selection-count" aria-live="polite">
              {primarySlips.length === 0 ? 'Choose one priority to continue.' : `Priority selected.`}
            </p>
            <div className="option-grid">
              {PRIMARY_SLIPS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={primarySlips.includes(item.id) ? 'option selected' : 'option'}
                  onClick={() => { setPrimarySlips([item.id]); setStepIndex(2); onStepChange?.(3); }}
                  aria-pressed={primarySlips.includes(item.id)}
                >
                  <span className="option-mark">{primarySlips.includes(item.id) ? '✓' : '+'}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            </>
          )}

          {step.id === 'capture' && (
            <div className="option-grid">
              {([
                ['chat', 'Chat / type'], ['voice', 'Voice'], ['forward', 'Forward emails or notes later'],
              ] as Array<[Exclude<CapturePreference, ''>, string]>).map(([value, label]) => (
                <button type="button" key={value} className={capturePref === value ? 'option selected' : 'option'} onClick={() => { setCapturePref(value); setStepIndex(3); onStepChange?.(4); }} aria-pressed={capturePref === value}>
                  <span className="option-mark">{capturePref === value ? '✓' : '+'}</span><span>{label}</span>
                </button>
              ))}
              <button type="button" className={!capturePref ? 'skip-option selected' : 'skip-option'} onClick={() => { setCapturePref(''); setStepIndex(3); onStepChange?.(4); }}>No preference</button>
            </div>
          )}

          {step.id === 'confirm' && (
            <div className="confirmation-card">
              <span className="confirm-check">✓</span>
              <p>Got it. I’ll prioritize <strong>{mode === 'everyday' ? 'Everyday / Personal' : mode === 'business' ? 'Business / Freelance / Contractor' : 'Mix of both'}</strong> and surface things related to <strong>{primarySlips.includes('unsure') ? 'a bit of everything' : primarySlips.map((id) => PRIMARY_SLIPS.find((item) => item.id === id)?.label).filter(Boolean).join(', ')}</strong>.</p>
              <small>{capturePref ? `Capture preference: ${capturePref === 'forward' ? 'forward emails or notes later' : capturePref}.` : 'Capture preference skipped.'} You can change this anytime in Settings.</small>
            </div>
          )}

          {status && <div className="status">{status}</div>}

          <footer>
            <button className="back" type="button" onClick={back} disabled={stepIndex === 0 || saving}>Back</button>
            {step.id === 'capture' && <button className="back" type="button" onClick={() => { setCapturePref(''); void next(); }} disabled={saving}>Skip</button>}
            <button className="next" type="button" onClick={next} disabled={!canContinue || saving}>
              {saving ? 'Saving…' : stepIndex === steps.length - 1 ? 'Go to Life’s Assistant' : 'Continue'}
            </button>
          </footer>
        </main>
      </div>

      <style jsx>{`
        .onboarding-page {
          min-height: 100vh;
          background: #151515;
          color: #ededed;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .onboarding-shell {
          width: min(1080px, 100%);
          min-height: 650px;
          display: grid;
          grid-template-columns: .82fr 1.18fr;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid #303030;
          background: #1d1d1d;
          box-shadow: 0 30px 90px rgba(0,0,0,.35);
        }
        .story-panel {
          padding: 42px;
          background:
            radial-gradient(circle at 20% 10%, rgba(105,155,255,.12), transparent 30%),
            #181818;
          border-right: 1px solid #303030;
          display: flex;
          flex-direction: column;
        }
        .brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: #efefef;
          color: #111;
          margin-bottom: 14px;
        }
        .brand { color: #969696; font-size: .72rem; letter-spacing: .08em; }
        .story-panel h1 {
          margin: 32px 0 14px;
          max-width: 430px;
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1.02;
          letter-spacing: -.05em;
          font-weight: 650;
        }
        .story-panel > p {
          margin: 0;
          max-width: 430px;
          color: #858585;
          line-height: 1.65;
          font-size: .82rem;
        }
        .principles {
          margin-top: auto;
          display: grid;
          gap: 8px;
          padding-top: 36px;
        }
        .principles > div {
          display: grid;
          grid-template-columns: 28px 1fr;
          column-gap: 10px;
          padding: 10px 0;
          border-top: 1px solid #2a2a2a;
        }
        .principles span { color: #5f5f5f; font-size: .6rem; padding-top: 2px; }
        .principles strong { font-size: .74rem; }
        .principles small { grid-column: 2; color: #666; font-size: .63rem; margin-top: 2px; }
        .setup-panel {
          padding: 42px 48px;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .progress-row {
          display: flex;
          justify-content: space-between;
          color: #666;
          font-size: .62rem;
          letter-spacing: .12em;
        }
        .progress-row strong { font-weight: 650; }
        .progress-track {
          height: 3px;
          border-radius: 999px;
          background: #2a2a2a;
          overflow: hidden;
          margin-top: 10px;
        }
        .progress-track > div {
          height: 100%;
          background: #d9d9d9;
          transition: width .2s ease;
        }
        .step-copy { margin-top: 54px; }
        .step-copy h2 {
          margin: 0;
          font-size: clamp(1.7rem, 3vw, 2.5rem);
          letter-spacing: -.04em;
          font-weight: 650;
        }
        .step-copy p {
          margin: 8px 0 0;
          max-width: 580px;
          color: #7f7f7f;
          font-size: .78rem;
          line-height: 1.55;
        }
        .field-block {
          margin-top: 30px;
          display: grid;
          gap: 8px;
        }
        .field-block label { font-size: .73rem; color: #c4c4c4; font-weight: 650; }
        .field-block input, .field-block textarea {
          width: 100%;
          border: 1px solid #3b3b3b;
          border-radius: 12px;
          background: #232323;
          color: #ededed;
          outline: none;
          padding: 13px;
          font: inherit;
        }
        .field-block textarea { min-height: 130px; resize: vertical; line-height: 1.5; }
        .field-block input:focus, .field-block textarea:focus { border-color: #606060; }
        .field-block small { color: #636363; font-size: .62rem; }
        .option-grid {
          margin-top: 28px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .option {
          min-height: 58px;
          border: 1px solid #363636;
          border-radius: 12px;
          background: #252525;
          color: #bcbcbc;
          padding: 0 12px;
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          text-align: left;
        }
        .option.selected { border-color: #7dc994; background: #27342b; color: #f7fff8; box-shadow: inset 0 0 0 1px rgba(125,201,148,.24); }
        .option.selected .option-mark { background: #35513e; color: #a9e4b9; }
        .selection-feedback { margin: 12px 0 0; color: #8eae97; font-size: .7rem; line-height: 1.4; }
        .option-description { display: block; margin-top: 3px; color: #828282; font-size: .62rem; }
        .skip-option { min-height: 42px; border: 1px solid #343434; border-radius: 11px; padding: 0 13px; background: transparent; color: #999; cursor: pointer; }
        .skip-option.selected { border-color: #6d8276; color: #dce9df; }
        .confirmation-card { margin-top: 28px; border: 1px solid #34443a; border-radius: 16px; padding: 20px; background: #202a24; }
        .confirm-check { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #314b3b; color: #a7e1b8; font-weight: 800; }
        .confirmation-card p { color: #d1d8d2; font-size: .9rem; line-height: 1.6; }
        .confirmation-card small { color: #8e9b91; font-size: .68rem; line-height: 1.5; }
        .option-mark {
          width: 25px;
          height: 25px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #303030;
          font-size: .72rem;
        }
        .style-grid {
          margin-top: 28px;
          display: grid;
          gap: 8px;
        }
        .style-option {
          min-height: 70px;
          border: 1px solid #363636;
          border-radius: 12px;
          background: #252525;
          color: #c8c8c8;
          padding: 13px 14px;
          text-align: left;
          cursor: pointer;
        }
        .style-option.selected { border-color: #666; background: #303030; }
        .style-option strong, .style-option small { display: block; }
        .style-option strong { font-size: .78rem; }
        .style-option small { color: #707070; font-size: .64rem; margin-top: 4px; }
        .approval-card {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 40px minmax(0,1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 16px;
          border: 1px solid #3a3a3a;
          border-radius: 14px;
          background: #252525;
        }
        .shield {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #303030;
          color: #8fc4ff;
        }
        .approval-card strong { font-size: .78rem; }
        .approval-card p { margin: 4px 0 0; color: #747474; font-size: .65rem; line-height: 1.45; }
        .switch input { width: 18px; height: 18px; accent-color: #ededed; }
        .status {
          margin-top: 16px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #242424;
          border: 1px solid #343434;
          color: #888;
          font-size: .68rem;
        }
        .slip-selection-count {
          margin: 20px 0 -12px;
          color: #a9c8b0;
          font-size: .72rem;
          line-height: 1.45;
        }
        footer {
          position: sticky;
          bottom: 0;
          z-index: 2;
          margin-top: auto;
          padding: 18px 0 max(12px, env(safe-area-inset-bottom));
          display: flex;
          justify-content: space-between;
          gap: 10px;
          background: linear-gradient(180deg, rgba(29,29,29,0), #1d1d1d 22%);
        }
        footer button {
          min-height: 42px;
          padding: 0 15px;
          border-radius: 10px;
          font-weight: 650;
          cursor: pointer;
        }
        .back { border: 1px solid #3d3d3d; background: transparent; color: #aaa; }
        .next { border: 0; background: #ededed; color: #111; }
        footer button:disabled { opacity: .35; cursor: default; }
        @media (max-width: 800px) {
          .onboarding-page { padding: 0; }
          .onboarding-shell {
            min-height: 100vh;
            grid-template-columns: 1fr;
            border: 0;
            border-radius: 0;
          }
          .story-panel { display: none; }
          .setup-panel { padding: 28px 20px; }
          .step-copy { margin-top: 42px; }
        }
        @media (max-width: 520px) {
          .option-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default ProgressiveOnboarding;
