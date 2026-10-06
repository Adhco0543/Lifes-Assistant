'use client';

import React, { useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type RecordLike = Record<string, unknown>;

export default function FocusBrief() {
  const [brief, setBrief] = useState('');
  const [status, setStatus] = useState('Build a brief from your saved workspace.');
  const [loading, setLoading] = useState(false);

  const buildBrief = async () => {
    setLoading(true);
    setStatus('Reading your workspace…');

    try {
      const user = firebaseBackend.getCurrentUser();
      if (!user) throw new Error('You need to be signed in.');

      const records = await firebaseBackend.getRecentBusinessRecords(80);
      const events = await firebaseBackend.getRecentEvents(30);

      const usefulRecords = records
        .filter((record) => ['task', 'note', 'quote', 'material-estimate'].includes(String(record.kind || '')))
        .slice(0, 30)
        .map((record) => ({
          kind: record.kind,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          data: record.data,
        }));

      const recentEvents = events.slice(0, 15).map((event) => ({
        eventName: event.eventName,
        createdAt: event.createdAt,
        data: event.data,
      }));

      if (usefulRecords.length === 0 && recentEvents.length === 0) {
        setBrief('');
        setStatus('There is not enough saved workspace activity to build a useful brief yet.');
        return;
      }

      setStatus('Building your focus brief…');
      const token = await user.getIdToken();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          message:
            'Create a concise focus brief using ONLY the workspace context below. ' +
            'Use these sections: What matters now, Follow-ups, Risks or loose ends, Next 3 actions. ' +
            'Do not invent deadlines, people, money, or events that are not in the context. ' +
            'Workspace context: ' +
            JSON.stringify({ records: usefulRecords, events: recentEvents }),
          businessContext: 'focus-brief',
          chatbotName: "Life's Assistant",
          memoryEnabled: false,
          history: [],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'The brief could not be generated.');
      }

      const text = String(data?.message || '').trim();
      if (!text) throw new Error('The AI returned an empty brief.');

      setBrief(text);
      setStatus('Brief generated from your current workspace.');

      try {
        const id = await firebaseBackend.saveBusinessRecord('brief', {
          text,
          sourceRecordCount: usefulRecords.length,
          sourceEventCount: recentEvents.length,
        });
        await firebaseBackend.trackEvent('brief.generated', {
          recordId: id,
          sourceRecordCount: usefulRecords.length,
        });
      } catch {
        // The brief remains visible even if the cloud receipt cannot be written.
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The brief could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setStatus('Brief copied.');
    } catch {
      setStatus('Clipboard access was blocked.');
    }
  };

  return (
    <div className="page">
      <div className="inner">
        <header>
          <div>
            <span className="eyebrow">FOCUS BRIEF</span>
            <h1>Turn the whole workspace into the next three moves.</h1>
            <p>
              Life&apos;s Assistant reads your saved work, finds the loose ends, and produces a short brief grounded only in what is actually in your workspace.
            </p>
          </div>
          <button className="build" onClick={buildBrief} disabled={loading}>
            {loading ? 'Building…' : 'Build my brief'}
          </button>
        </header>

        <section className="status-card">
          <span className={loading ? 'pulse' : 'dot'} />
          <div>
            <strong>{loading ? 'Working through your workspace' : 'Workspace-grounded'}</strong>
            <small>{status}</small>
          </div>
        </section>

        <section className="brief-card">
          {brief ? (
            <>
              <div className="brief-head">
                <span className="eyebrow">YOUR BRIEF</span>
                <button onClick={copy}>Copy</button>
              </div>
              <div className="brief-text">{brief}</div>
            </>
          ) : (
            <div className="empty">
              <div className="mark">✦</div>
              <strong>Your brief will appear here.</strong>
              <p>It is generated from saved tasks, notes, quotes, estimates, and recent workspace actions.</p>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .inner { width: min(980px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 16px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; max-width: 700px; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 700px; color: #858585; font-size: .8rem; line-height: 1.55; }
        .build { min-height: 42px; padding: 0 15px; border: 0; border-radius: 11px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; white-space: nowrap; }
        .build:disabled { opacity: .45; cursor: default; }
        .status-card { display: flex; align-items: center; gap: 10px; padding: 13px 14px; border: 1px solid #343434; border-radius: 13px; background: #272727; margin-bottom: 10px; }
        .dot, .pulse { width: 8px; height: 8px; border-radius: 50%; background: #72d19f; }
        .pulse { animation: pulse 1s ease-in-out infinite alternate; }
        .status-card strong, .status-card small { display: block; }
        .status-card strong { font-size: .74rem; }
        .status-card small { color: #6f6f6f; font-size: .64rem; margin-top: 2px; }
        .brief-card { min-height: 430px; padding: 20px; border: 1px solid #343434; border-radius: 17px; background: #262626; }
        .brief-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .brief-head button { min-height: 34px; padding: 0 11px; border: 1px solid #444; border-radius: 9px; background: #303030; color: #ddd; cursor: pointer; }
        .brief-text { color: #d5d5d5; white-space: pre-wrap; font-size: .82rem; line-height: 1.7; }
        .empty { min-height: 385px; display: grid; place-content: center; text-align: center; color: #6f6f6f; }
        .mark { width: 46px; height: 46px; margin: 0 auto 11px; border-radius: 14px; display: grid; place-items: center; background: #303030; color: #ddd; }
        .empty strong { color: #bdbdbd; font-size: .8rem; }
        .empty p { max-width: 420px; margin: 5px auto 0; font-size: .67rem; line-height: 1.45; }
        @keyframes pulse { from { opacity: .35; } to { opacity: 1; } }
        @media (max-width: 650px) {
          .inner { width: calc(100% - 28px); padding-top: 24px; }
          header { align-items: start; flex-direction: column; }
          .build { width: 100%; }
        }
      `}</style>
    </div>
  );
}
