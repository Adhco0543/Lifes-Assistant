'use client';

import React, { useState } from 'react';
import type { ChatAction } from '../lib/chatApiContracts';
import { firebaseBackend } from '../lib/firebaseBackend';

interface Props {
  actions: ChatAction[];
  onUpdate: (callId: string, patch: Partial<ChatAction>) => void;
}

const VIEW_EVENTS: Record<string, string> = {
  tasks: 'open-tasks',
  email: 'open-email',
  quotes: 'open-quote-builder',
  radar: 'open-life-radar',
  people: 'open-people',
  projects: 'open-projects',
  notes: 'open-notes',
  memory: 'open-memory',
};

const STATUS_ICON: Record<ChatAction['status'], string> = {
  done: '✓',
  approval_required: '⏸',
  blocked: '⛔',
  failed: '!',
};

const STATUS_TEXT: Record<ChatAction['status'], string> = {
  done: 'Done',
  approval_required: 'Needs your OK',
  blocked: 'Not done',
  failed: 'Failed',
};

/**
 * Receipts for what Bella did while answering, shown under her message.
 * Approval-required emails get an Approve button that goes through the same
 * /api/email/send route as the Email composer, so the user is always the sender.
 */
export default function ChatActionReceipts({ actions, onUpdate }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!actions.length) return null;

  const openView = (view: string | null | undefined) => {
    const eventName = view ? VIEW_EVENTS[view] : undefined;
    if (eventName) window.dispatchEvent(new CustomEvent(eventName));
  };

  const approveSend = async (action: ChatAction) => {
    const args = action.pendingAction?.args || {};
    const to = String(args.to || '');
    const subject = String(args.subject || '');
    const body = String(args.body || '');
    setBusyId(action.callId);
    setErrors((current) => ({ ...current, [action.callId]: '' }));
    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ to, subject, text: body }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; id?: string | null };
      if (!response.ok) throw new Error(result.error || 'Email could not be sent.');
      await firebaseBackend.trackEvent('email.sent', {
        to,
        subject,
        providerId: result.id || null,
        actor: 'assistant',
        approvedBy: 'user',
        tool: 'send_email',
        status: 'done',
        summary: subject + ' → ' + to,
      }).catch(() => undefined);
      onUpdate(action.callId, { status: 'done', reason: 'Approved by you and sent.', pendingAction: null });
      window.dispatchEvent(new CustomEvent('life-workspace-changed', { detail: { type: 'assistant-action', tool: 'send_email' } }));
    } catch (error) {
      setErrors((current) => ({ ...current, [action.callId]: error instanceof Error ? error.message : 'Email could not be sent.' }));
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = (action: ChatAction) => {
    onUpdate(action.callId, { status: 'blocked', reason: 'You chose not to send this. The draft is still in Email drafts.', pendingAction: null });
  };

  return (
    <div className="receipts" aria-label="Actions taken by the assistant">
      {actions.map((action) => {
        const args = action.pendingAction?.args || {};
        const isPendingEmail = action.status === 'approval_required' && action.pendingAction?.tool === 'send_email';
        return (
          <div key={action.callId || action.tool + action.at} className={'receipt receipt-' + action.status}>
            <span className="receipt-icon" aria-hidden="true">{STATUS_ICON[action.status]}</span>
            <div className="receipt-body">
              <div className="receipt-head">
                <strong>{action.label}</strong>
                <span className="receipt-status">{STATUS_TEXT[action.status]}</span>
              </div>
              <div className="receipt-summary">{action.summary}</div>
              {action.reason ? <div className="receipt-reason">{action.reason}</div> : null}

              {isPendingEmail ? (
                <div className="receipt-preview">
                  <div><span>To</span>{String(args.to || '')}</div>
                  <div><span>Subject</span>{String(args.subject || '')}</div>
                  <pre>{String(args.body || '')}</pre>
                </div>
              ) : null}

              {errors[action.callId] ? <div className="receipt-error">{errors[action.callId]}</div> : null}

              <div className="receipt-actions">
                {isPendingEmail ? (
                  <>
                    <button type="button" className="receipt-primary" disabled={busyId === action.callId} onClick={() => approveSend(action)}>
                      {busyId === action.callId ? 'Sending…' : 'Approve and send'}
                    </button>
                    <button type="button" className="receipt-ghost" disabled={busyId === action.callId} onClick={() => dismiss(action)}>
                      Don't send
                    </button>
                  </>
                ) : null}
                {action.linkedView && VIEW_EVENTS[action.linkedView] ? (
                  <button type="button" className="receipt-link" onClick={() => openView(action.linkedView)}>
                    Open {action.linkedView === 'radar' ? 'Life Radar' : action.linkedView}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <style jsx>{`
        .receipts { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 4px; max-width: 760px; }
        .receipt { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #262626; border: 1px solid #353535; font-size: 0.85rem; color: #e0e0e0; }
        .receipt-done { border-color: #2f5a3f; }
        .receipt-approval_required { border-color: #6b5a2a; background: #2a2718; }
        .receipt-blocked, .receipt-failed { border-color: #5c3232; }
        .receipt-icon { flex: 0 0 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 0.8rem; background: #333; }
        .receipt-done .receipt-icon { color: #8fd4a8; }
        .receipt-approval_required .receipt-icon { color: #e6c36a; }
        .receipt-blocked .receipt-icon, .receipt-failed .receipt-icon { color: #f2b8b5; }
        .receipt-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .receipt-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
        .receipt-status { font-size: 0.72rem; letter-spacing: 0.04em; text-transform: uppercase; color: #9a9a9a; white-space: nowrap; }
        .receipt-summary { word-break: break-word; }
        .receipt-reason { color: #a6a6a6; font-size: 0.8rem; }
        .receipt-preview { margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: #1e1e1e; border: 1px solid #333; display: flex; flex-direction: column; gap: 4px; }
        .receipt-preview span { display: inline-block; width: 60px; color: #8c8c8c; font-size: 0.75rem; }
        .receipt-preview pre { margin: 4px 0 0; white-space: pre-wrap; font-family: inherit; font-size: 0.83rem; color: #d6d6d6; max-height: 200px; overflow: auto; }
        .receipt-error { color: #f2b8b5; font-size: 0.8rem; }
        .receipt-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .receipt-actions:empty { display: none; }
        .receipt-primary, .receipt-ghost, .receipt-link { min-height: 32px; padding: 0 12px; border-radius: 8px; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .receipt-primary { background: #f4f4f4; color: #111; border: none; }
        .receipt-ghost { background: transparent; color: #d6d6d6; border: 1px solid #474747; }
        .receipt-link { background: transparent; color: #a6a6a6; border: none; padding: 0 4px; text-decoration: underline; font-weight: 500; }
        .receipt-primary:disabled, .receipt-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
