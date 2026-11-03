'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AutonomySettingsManager, DEFAULT_AUTONOMY_SETTINGS, type AutonomySettings } from '../lib/autonomySettings';
import { CATEGORY_LABELS, describeAutonomyDraft, toAutonomyDraft, toAutonomySettings, type AutonomyDraft, type CategoryMode, type EmailMode } from '../lib/autonomyDraft';

export default function AutonomySettingsPanel({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<AutonomySettings>(DEFAULT_AUTONOMY_SETTINGS);
  const [draft, setDraft] = useState<AutonomyDraft>(() => toAutonomyDraft(DEFAULT_AUTONOMY_SETTINGS));
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    AutonomySettingsManager.getSettings(userId)
      .then((settings) => {
        if (!active) return;
        setCurrent(settings);
        setDraft(toAutonomyDraft(settings));
        setState('ready');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load autonomy settings.');
        setState('error');
      });
    return () => { active = false; };
  }, [userId]);

  const summary = useMemo(() => describeAutonomyDraft(draft), [draft]);
  const update = <K extends keyof AutonomyDraft>(key: K, value: AutonomyDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setState((prev) => (prev === 'saved' ? 'ready' : prev));
  };

  const save = async () => {
    setState('saving');
    setError('');
    try {
      const patch = toAutonomySettings(draft, current);
      await AutonomySettingsManager.updateSettings(userId, patch);
      const next = await AutonomySettingsManager.getSettings(userId);
      setCurrent(next);
      setDraft(toAutonomyDraft(next));
      setState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setState('error');
    }
  };

  return (
    <div className="autonomy">
      <div className="section-title"><span className="eyebrow">AUTONOMY</span><h2>What Bella may do on her own</h2></div>
      <p className="lede">
        Everything inside your workspace (tasks, notes, people, drafts) is always allowed and always logged.
        These settings only govern actions that leave the workspace, starting with email.
      </p>

      <div className="summary">
        <strong>Right now</strong>
        <ul>{summary.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>

      <div className="field">
        <span>Email sending</span>
        <div className="choices">
          {([
            ['ask', 'Always ask me', 'Bella prepares the email and shows an approve button.'],
            ['draft_only', 'Draft only', 'Bella writes it into your Email drafts; you send it.'],
            ['auto_send', 'Allow auto-send by category', 'Pick which kinds of email can go out without you.'],
          ] as Array<[EmailMode, string, string]>).map(([value, label, hint]) => (
            <button key={value} type="button" className={draft.emailMode === value ? 'choice active' : 'choice'} onClick={() => update('emailMode', value)}>
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      </div>

      {draft.emailMode === 'auto_send' && (
        <div className="field">
          <span>By category</span>
          <div className="categories">
            {CATEGORY_LABELS.map((category) => (
              <label key={category.id} className="category">
                <span><strong>{category.label}</strong><small>{category.hint}</small></span>
                <select
                  value={draft.categories[category.id]}
                  onChange={(event) => update('categories', { ...draft.categories, [category.id]: event.target.value as CategoryMode })}
                >
                  <option value="ask">Ask me</option>
                  <option value="auto_draft">Draft only</option>
                  <option value="auto_send">Send automatically</option>
                </select>
              </label>
            ))}
          </div>
          <small>Even with auto-send on, quiet hours and the dollar threshold below still pull an email back to asking.</small>
        </div>
      )}

      <div className="two">
        <label className="field">
          <span>Always ask above</span>
          <div className="money"><em>$</em><input type="number" inputMode="numeric" min="0" step="100" value={draft.confirmOver} onChange={(event) => update('confirmOver', event.target.value)} /></div>
          <small>Quotes or invoices over this amount always wait for you. 0 turns this off.</small>
        </label>
        <label className="field">
          <span>Daily action limit</span>
          <input type="number" inputMode="numeric" min="0" step="5" value={draft.dailyLimit} onChange={(event) => update('dailyLimit', event.target.value)} />
          <small>Counts only what Bella does, not what you do. 0 means no limit.</small>
        </label>
      </div>

      <div className="field">
        <label className="switch-row">
          <span><strong>Quiet hours</strong><small>Nothing leaves the workspace in this window without your OK. Drafts still get written.</small></span>
          <input type="checkbox" checked={draft.quietEnabled} onChange={(event) => update('quietEnabled', event.target.checked)} />
        </label>
        {draft.quietEnabled && (
          <div className="times">
            <label><span>From</span><input type="time" value={draft.quietStart} onChange={(event) => update('quietStart', event.target.value)} /></label>
            <label><span>Until</span><input type="time" value={draft.quietEnd} onChange={(event) => update('quietEnd', event.target.value)} /></label>
          </div>
        )}
      </div>

      <div className="truth-card">
        <strong>If the assistant did it, there is a record</strong>
        <p>Every assistant action, including ones that were blocked or are waiting for you, shows up in the Action Ledger with the rule that applied.</p>
      </div>

      <div className="save-row">
        {state === 'error' && <span className="status error">{error || 'Something went wrong.'}</span>}
        {state === 'saved' && <span className="status ok">Saved</span>}
        {state === 'loading' && <span className="status">Loading…</span>}
        <button type="button" onClick={() => void save()} disabled={state === 'loading' || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save autonomy settings'}
        </button>
      </div>

      <style jsx>{`
        .autonomy { display: grid; gap: 12px; }
        .section-title { margin-bottom: 4px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h2 { margin: 6px 0 0; font-size: 1.15rem; font-weight: 650; letter-spacing: -.02em; }
        .lede { margin: 0; color: #8f8f8f; font-size: .78rem; line-height: 1.55; max-width: 640px; }
        .summary { padding: 14px 16px; border-radius: 13px; border: 1px solid #3f5a4c; background: linear-gradient(135deg, #263129, #262626 80%); }
        .summary strong { font-size: .7rem; letter-spacing: .1em; color: #9fd9b8; }
        .summary ul { margin: 8px 0 0; padding-left: 18px; color: #dcdcdc; font-size: .8rem; line-height: 1.6; }
        .field { display: grid; gap: 8px; padding: 14px; background: #2b2b2b; border: 1px solid #353535; border-radius: 13px; }
        .field > span { font-size: .75rem; font-weight: 650; }
        .field small, .switch-row small { color: #7a7a7a; font-size: .64rem; line-height: 1.45; }
        .field input, .field select { min-height: 40px; border: 1px solid #414141; border-radius: 9px; background: #222; color: #e8e8e8; padding: 0 10px; outline: none; width: 100%; box-sizing: border-box; }
        .field input:focus, .field select:focus { border-color: #6b8a7a; }
        .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
        .choice { text-align: left; display: grid; gap: 4px; padding: 12px; border-radius: 11px; border: 1px solid #3c3c3c; background: #242424; color: #d8d8d8; cursor: pointer; }
        .choice strong { font-size: .78rem; }
        .choice:hover { border-color: #555; }
        .choice.active { border-color: #9fd9b8; background: #27302b; color: #f0f0f0; }
        .categories { display: grid; gap: 8px; }
        .category { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 10px; background: #242424; border: 1px solid #353535; }
        .category strong { display: block; font-size: .76rem; }
        .category small { display: block; }
        .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .money { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; }
        .money em { font-style: normal; color: #9a9a9a; }
        .switch-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; cursor: pointer; }
        .switch-row strong { display: block; font-size: .75rem; }
        .switch-row input { width: 20px; height: 20px; min-height: 0; accent-color: #9fd9b8; }
        .times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .times label { display: grid; gap: 5px; font-size: .68rem; color: #9a9a9a; }
        .truth-card { padding: 13px 14px; border-radius: 12px; border: 1px solid #353535; background: #242424; }
        .truth-card strong { display: block; font-size: .75rem; margin-bottom: 4px; }
        .truth-card p { margin: 0; color: #8a8a8a; font-size: .72rem; line-height: 1.5; }
        .save-row { padding-top: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
        .save-row button { min-height: 40px; border: 0; border-radius: 10px; padding: 0 14px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .save-row button:disabled { opacity: .55; cursor: default; }
        .status { font-size: .7rem; color: #8a8a8a; }
        .status.ok { color: #9fd9b8; }
        .status.error { color: #f0a0a0; }
        @media (max-width: 640px) {
          .category { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
