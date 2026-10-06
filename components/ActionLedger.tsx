'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type Receipt = {
  id: string;
  eventName: string;
  createdAt: number;
  data?: Record<string, unknown>;
};

const LABELS: Record<string, { title: string; detail: string; icon: string }> = {
  'email.sent': { title: 'Email sent', detail: 'The mail provider accepted the message for delivery.', icon: '↗' },
  'task.created': { title: 'Task created', detail: 'A new task was saved to the workspace.', icon: '✓' },
  'task.completed': { title: 'Task completed', detail: 'A task was marked complete.', icon: '✓' },
  'note.saved': { title: 'Note saved', detail: 'A note was saved to the workspace.', icon: '✎' },
  'quote.saved': { title: 'Quote saved', detail: 'A quote draft was saved to the workspace.', icon: '▤' },
  'material.estimate': { title: 'Estimate calculated', detail: 'A material estimate was calculated.', icon: '◇' },
  'memory.saved': { title: 'Memory saved', detail: 'Persistent context was added to the assistant.', icon: '◉' },
  'brief.generated': { title: 'Focus brief generated', detail: 'A brief was generated from saved workspace context.', icon: '◈' },
  'person.saved': { title: 'Person saved', detail: 'Personal context was added to the workspace.', icon: '◎' },
  'project.saved': { title: 'Project saved', detail: 'A project was added to the workspace.', icon: '▦' },
  'project.status': { title: 'Project status changed', detail: 'A project status was updated.', icon: '▦' },
};

const receiptProof = (receipt: Receipt): string => {
  const data = receipt.data || {};

  if (receipt.eventName === 'email.sent') {
    const recipient = String(data.to || 'recipient');
    const providerId = data.providerId ? ' · provider receipt ' + String(data.providerId).slice(0, 12) : '';
    return 'To ' + recipient + providerId;
  }

  if (receipt.eventName === 'task.created' || receipt.eventName === 'task.completed') {
    return String(data.title || 'Task update');
  }

  if (receipt.eventName === 'note.saved') {
    return String(data.preview || 'Saved note');
  }

  if (receipt.eventName === 'quote.saved') {
    const client = String(data.clientName || 'Client');
    const total = typeof data.total === 'number' ? ' · $' + Number(data.total).toFixed(2) : '';
    return client + total;
  }

  if (receipt.eventName === 'material.estimate') {
    const project = String(data.projectName || 'Material estimate');
    const total = typeof data.total === 'number' ? ' · $' + Number(data.total).toFixed(2) : '';
    return project + total;
  }

  if (receipt.eventName === 'memory.saved') {
    return String(data.preview || data.category || 'Persistent memory saved.');
  }

  if (receipt.eventName === 'brief.generated') {
    const count = Number(data.sourceRecordCount || 0);
    return count ? 'Grounded in ' + count + ' saved workspace records.' : 'Workspace brief generated.';
  }

  if (receipt.eventName === 'person.saved') {
    const name = String(data.name || 'Person');
    const relationship = String(data.relationship || '').trim();
    return relationship ? name + ' · ' + relationship : name;
  }

  if (receipt.eventName === 'project.saved' || receipt.eventName === 'project.status') {
    const name = String(data.name || 'Project');
    const status = String(data.status || '').trim();
    return status ? name + ' · ' + status : name;
  }

  return 'Workspace event confirmed.';
};

export default function ActionLedger() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    setStatus('');
    try {
      const events = await firebaseBackend.getRecentEvents(75);
      const mapped = events.map((event) => ({
        id: String(event.id || ''),
        eventName: String(event.eventName || 'activity'),
        createdAt: Number(event.createdAt || Date.now()),
        data: (event.data || {}) as Record<string, unknown>,
      }));
      setReceipts(mapped);
      setStatus('Cloud receipt history loaded.');
    } catch (error) {
      console.warn('Receipt history unavailable:', error);
      setReceipts([]);
      setStatus('Receipt history is unavailable because cloud storage could not be reached.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#212121', color: '#ececec' }}>
      <div style={{ width: 'min(980px, calc(100% - 44px))', margin: '0 auto', padding: '42px 0 70px' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#747474', fontSize: '.64rem', letterSpacing: '.14em', fontWeight: 750 }}>RECEIPTS</div>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-.045em', fontWeight: 650 }}>
            If the assistant did it, there should be a record.
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#858585', fontSize: '.8rem', lineHeight: 1.55 }}>
            Receipts are proof for meaningful actions. They show what happened, when it happened, and the details needed to verify it instead of trusting a chat message.
          </p>
        </header>

        <section style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', padding: 16, border: '1px solid #343434', borderRadius: 14, background: '#272727', marginBottom: 12 }}>
          <div>
            <strong style={{ display: 'block', fontSize: '.8rem' }}>{loading ? 'Loading receipts…' : receipts.length + ' recent receipts'}</strong>
            <small style={{ color: '#6f6f6f', fontSize: '.64rem' }}>{status}</small>
          </div>
          <button onClick={load} disabled={loading} style={{ minHeight: 38, border: 0, borderRadius: 10, padding: '0 13px', background: '#ededed', color: '#111', fontWeight: 650, cursor: 'pointer' }}>
            Refresh
          </button>
        </section>

        {receipts.length === 0 && !loading ? (
          <section style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: '1px solid #343434', borderRadius: 16, background: '#262626', color: '#777' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', margin: '0 auto 10px', background: '#303030' }}>◎</div>
              <strong style={{ color: '#bdbdbd', fontSize: '.78rem' }}>No receipts yet.</strong>
              <p style={{ margin: '5px 0 0', fontSize: '.68rem' }}>Actions such as sending email and saving work will appear here.</p>
            </div>
          </section>
        ) : (
          <section style={{ display: 'grid', gap: 8 }}>
            {receipts.map((receipt) => {
              const meta = LABELS[receipt.eventName] || { title: receipt.eventName, detail: 'Workspace activity recorded.', icon: '◎' };
              return (
                <article key={receipt.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'center', minHeight: 78, padding: '12px 14px', border: '1px solid #343434', borderRadius: 13, background: '#262626' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: '#303030', color: '#d6d6d6' }}>{meta.icon}</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '.78rem' }}>{meta.title}</strong>
                    <small style={{ color: '#747474', fontSize: '.65rem', lineHeight: 1.4 }}>{meta.detail}</small>
                    <span style={{ display: 'block', marginTop: 5, color: '#a2a2a2', fontSize: '.64rem', lineHeight: 1.4 }}>
                      {receiptProof(receipt)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 7px', borderRadius: 999, background: '#303a34', color: '#78d7a4', fontSize: '.56rem', marginBottom: 5 }}>
                      PROOF
                    </span>
                    <time style={{ display: 'block', color: '#686868', fontSize: '.62rem', whiteSpace: 'nowrap' }}>
                      {new Date(receipt.createdAt).toLocaleString()}
                    </time>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
