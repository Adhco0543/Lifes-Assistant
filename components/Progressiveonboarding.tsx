'use client';

import React, { useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

interface ProgressiveOnboardingProps {
  userId?: string;
  onComplete?: (data: Record<string, any>) => void;
  onStepChange?: (step: number) => void;
}

type StepId = 'workspace' | 'help' | 'style' | 'memory' | 'approval';

const HELP_OPTIONS = [
  'Everyday planning',
  'Work & business',
  'Writing & email',
  'Tasks & reminders',
  'Money & estimates',
  'Learning & research',
  'Relationships & communication',
  'Projects & ideas',
];

const steps: Array<{ id: StepId; title: string; kicker: string; description: string }> = [
  {
    id: 'workspace',
    title: 'Make it yours.',
    kicker: 'WELCOME',
    description: 'Give this workspace a name. It can represent your whole life, your work, or both.',
  },
  {
    id: 'help',
    title: 'What should it help carry?',
    kicker: 'YOUR WORLD',
    description: 'Choose the areas where you want Life’s Assistant to be useful most often.',
  },
  {
    id: 'style',
    title: 'How should it talk to you?',
    kicker: 'COMMUNICATION',
    description: 'You can change this later, but the first conversation should already feel right.',
  },
  {
    id: 'memory',
    title: 'Give it one thing worth remembering.',
    kicker: 'MEMORY',
    description: 'Optional. Save a person, preference, rule, routine, or fact that should survive future chats.',
  },
  {
    id: 'approval',
    title: 'You stay in control.',
    kicker: 'ACTIONS',
    description: 'External actions should be clear, intentional, and verifiable.',
  },
];

export const ProgressiveOnboarding: React.FC<ProgressiveOnboardingProps> = ({
  userId = 'guest',
  onComplete,
  onStepChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [workspaceName, setWorkspaceName] = useState('My Life');
  const [helpAreas, setHelpAreas] = useState<string[]>([]);
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [memory, setMemory] = useState('');
  const [approvalFirst, setApprovalFirst] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const step = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const canContinue = useMemo(() => {
    if (step.id === 'workspace') return Boolean(workspaceName.trim());
    if (step.id === 'help') return helpAreas.length > 0;
    return true;
  }, [helpAreas.length, step.id, workspaceName]);

  const toggleHelpArea = (item: string) => {
    setHelpAreas((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : current.concat(item)
    );
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
      const preferences = {
        assistantName: "Life's Assistant",
        tone: responseStyle,
        memoryEnabled: true,
        approvalFirst,
        helpAreas,
        updatedAt: Date.now(),
      };

      try {
        await firebaseBackend.saveDraft('assistant-preferences', preferences);
      } catch {
        localStorage.setItem(
          'lifes-assistant-preferences:' + userId,
          JSON.stringify({
            assistantName: "Life's Assistant",
            tone: responseStyle,
            memoryEnabled: true,
            compactMode: false,
            timezone: 'America/New_York',
          })
        );
      }

      if (memory.trim()) {
        try {
          const id = await firebaseBackend.saveBusinessRecord('memory', {
            text: memory.trim(),
            category: 'General',
          });
          await firebaseBackend.trackEvent('memory.saved', {
            recordId: id,
            category: 'General',
            preview: memory.trim().slice(0, 120),
          });
        } catch {
          // Onboarding still completes if optional cloud memory is unavailable.
        }
      }

      onComplete?.({
        timestamp: Date.now(),
        workspaceName: workspaceName.trim(),
        businessName: workspaceName.trim(),
        businessType: helpAreas.includes('Work & business') ? 'life-and-work' : 'personal',
        helpAreas,
        responseStyle,
        approvalFirst,
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

          {step.id === 'workspace' && (
            <div className="field-block">
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="My Life"
                autoFocus
                maxLength={60}
              />
              <small>Examples: My Life, TJ&apos;s Workspace, Work + Home.</small>
            </div>
          )}

          {step.id === 'help' && (
            <div className="option-grid">
              {HELP_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={helpAreas.includes(item) ? 'option selected' : 'option'}
                  onClick={() => toggleHelpArea(item)}
                >
                  <span className="option-mark">{helpAreas.includes(item) ? '✓' : '+'}</span>
                  <span>{item}</span>
                </button>
              ))}
            </div>
          )}

          {step.id === 'style' && (
            <div className="style-grid">
              {[
                ['concise', 'Concise', 'Short, direct, action-focused.'],
                ['balanced', 'Balanced', 'Enough detail without burying the answer.'],
                ['detailed', 'Detailed', 'More explanation, structure, and context.'],
              ].map(([value, title, detail]) => (
                <button
                  key={value}
                  type="button"
                  className={responseStyle === value ? 'style-option selected' : 'style-option'}
                  onClick={() => setResponseStyle(value as typeof responseStyle)}
                >
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </button>
              ))}
            </div>
          )}

          {step.id === 'memory' && (
            <div className="field-block">
              <label htmlFor="memory">Always remember…</label>
              <textarea
                id="memory"
                value={memory}
                onChange={(event) => setMemory(event.target.value)}
                placeholder="Example: Allen likes short estimates with labor and materials broken out separately."
                maxLength={700}
              />
              <small>This is optional and can be edited later in Memory.</small>
            </div>
          )}

          {step.id === 'approval' && (
            <div className="approval-card">
              <div className="shield">◇</div>
              <div>
                <strong>Approval-first external actions</strong>
                <p>
                  Email, purchases, scheduling, account changes, and other external actions should require a clear confirmation before execution.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={approvalFirst}
                  onChange={(event) => setApprovalFirst(event.target.checked)}
                />
                <span />
              </label>
            </div>
          )}

          {status && <div className="status">{status}</div>}

          <footer>
            <button className="back" type="button" onClick={back} disabled={stepIndex === 0 || saving}>Back</button>
            <button className="next" type="button" onClick={next} disabled={!canContinue || saving}>
              {saving ? 'Saving…' : stepIndex === steps.length - 1 ? 'Enter Life’s Assistant' : 'Continue'}
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
        .option.selected { border-color: #666; background: #303030; color: #f0f0f0; }
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
        footer {
          margin-top: auto;
          padding-top: 36px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
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
