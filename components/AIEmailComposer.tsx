'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

interface AIEmailComposerProps {
  userId: string;
}

type ChatResponse = {
  message?: string;
};

export const AIEmailComposer: React.FC<AIEmailComposerProps> = ({ userId }) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('');
  const [emailReady, setEmailReady] = useState(false);
  const [emailDomainStatus, setEmailDomainStatus] = useState('checking');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('email_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.to === 'string') setRecipient(draft.to);
      if (typeof draft.subject === 'string' && draft.subject !== 'Draft') setSubject(draft.subject);
      if (typeof draft.body === 'string') setBody(draft.body);
      if (typeof draft.request === 'string') setInstructions(draft.request);
      localStorage.removeItem('email_draft');
    } catch {
      localStorage.removeItem('email_draft');
    }
  }, []);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/system-status', { cache: 'no-store' });
        const data = await response.json();

        if (!active) return;
        const verified = Boolean(data?.email?.configured && data?.email?.domainVerified);
        setEmailReady(verified);
        setEmailDomainStatus(String(data?.email?.domainStatus || 'unknown'));
      } catch {
        if (!active) return;
        setEmailReady(false);
        setEmailDomainStatus('check-failed');
      }
    };

    checkStatus();
    return () => {
      active = false;
    };
  }, []);

  const sendEmail = async () => {
    if (!recipient.trim() || !subject.trim() || !body.trim()) {
      setStatus('Recipient, subject, and email body are required before sending.');
      return;
    }

    const user = firebaseBackend.getCurrentUser();
    if (!user) {
      setStatus('You need to be signed in before sending.');
      return;
    }

    setIsSending(true);
    setStatus('Sending…');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          to: recipient.trim(),
          subject: subject.trim(),
          text: body.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Email could not be sent.');
      }

      setStatus('Email sent successfully.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Email could not be sent.');
    } finally {
      setIsSending(false);
    }
  };

  const generateDraft = async () => {
    if (!recipient.trim() || !instructions.trim()) {
      setStatus('Enter a recipient and tell the assistant what the email should say.');
      return;
    }

    setIsGenerating(true);
    setStatus('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `Draft an email for me. Recipient: ${recipient}. Subject: ${subject || 'Create a suitable subject'}. Instructions: ${instructions}. Return only the email body, without To/From/Subject labels.`,
          businessContext: 'email-drafting',
          chatbotName: "Life's Assistant",
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      setBody(data.message?.trim() || '');
      setStatus(data.message ? 'Draft ready. Review it before copying or sending later.' : 'No draft was returned.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not generate the email draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyDraft = async () => {
    if (!body.trim()) {
      setStatus('There is no email body to copy yet.');
      return;
    }

    const formatted = `To: ${recipient}\nSubject: ${subject || '(no subject)'}\n\n${body}`;

    try {
      await navigator.clipboard.writeText(formatted);
      setStatus('Draft copied to your clipboard.');
    } catch {
      setStatus('Clipboard access was blocked by the browser.');
    }
  };

  return (
    <div className="email-page">
      <div className="email-inner">
        <header>
          <span className="eyebrow">EMAIL DRAFTS</span>
          <h1>Write it clearly. Send it only when sending is truly connected.</h1>
          <p>
            Drafting and delivery use the same production paths we intend to ship. Sending activates automatically when the dedicated mail domain is verified.
          </p>
        </header>

        <div className="grid">
          <section className="panel">
            <div className="panel-title">
              <span className="eyebrow">COMPOSE</span>
              <h2>Email details</h2>
            </div>

            <label className="field">
              <span>Recipient email</span>
              <input
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="person@example.com"
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label className="field">
              <span>What should the email say?</span>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Example: Tell her I love her and apologize for being on my phone too much. Keep it sincere and not too long."
              />
            </label>

            <button className="primary" onClick={generateDraft} disabled={isGenerating}>
              {isGenerating ? 'Writing draft…' : 'Generate draft with AI'}
            </button>

            <div className="connection-note">
              <strong>Sending status</strong>
              <p>
                {emailReady
                  ? 'Live email delivery is connected and ready.'
                  : 'Mail domain status: ' + emailDomainStatus + '. DNS verification must finish before real delivery is enabled.'}
              </p>
            </div>
          </section>

          <section className="panel preview-panel">
            <div className="panel-title">
              <span className="eyebrow">PREVIEW</span>
              <h2>Review before anything leaves the app</h2>
            </div>

            <div className="address-card">
              <div><span>To</span><strong>{recipient || 'No recipient yet'}</strong></div>
              <div><span>Subject</span><strong>{subject || 'No subject yet'}</strong></div>
            </div>

            <label className="field body-field">
              <span>Email body</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Your generated email will appear here and remain editable."
              />
            </label>

            <div className="actions">
              <button className="secondary" onClick={copyDraft} disabled={!body.trim()}>Copy draft</button>
              <button
                className={emailReady ? 'primary' : 'disabled-send'}
                type="button"
                onClick={sendEmail}
                disabled={!emailReady || isSending || !body.trim() || !recipient.trim() || !subject.trim()}
                title={emailReady ? 'Send this email now' : 'Email domain verification is still pending'}
              >
                {isSending ? 'Sending…' : emailReady ? 'Send email' : 'Send email · verification pending'}
              </button>
            </div>

            {status && <div className="status" role="status">{status}</div>}
          </section>
        </div>
      </div>

      <style jsx>{`
        .email-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .email-inner { width: min(1080px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { margin-bottom: 24px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; max-width: 780px; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 720px; color: #878787; line-height: 1.55; font-size: .8rem; }
        .grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 12px; }
        .panel { border: 1px solid #343434; background: #262626; border-radius: 17px; padding: 20px; display: grid; gap: 14px; align-content: start; }
        .panel-title h2 { margin: 5px 0 0; font-size: 1rem; }
        .field { display: grid; gap: 7px; }
        .field > span { font-size: .73rem; color: #bdbdbd; font-weight: 650; }
        input, textarea { width: 100%; border: 1px solid #414141; border-radius: 10px; background: #1f1f1f; color: #f2f2f2; padding: 11px 12px; outline: none; }
        input::placeholder, textarea::placeholder { color: #676767; }
        input:focus, textarea:focus { border-color: #666; box-shadow: 0 0 0 3px rgba(255,255,255,.04); }
        textarea { min-height: 142px; resize: vertical; line-height: 1.5; }
        .body-field textarea { min-height: 290px; }
        button { min-height: 42px; border-radius: 10px; padding: 0 14px; font-weight: 650; cursor: pointer; }
        .primary { border: 0; background: #ededed; color: #111; }
        .primary:disabled { opacity: .45; cursor: default; }
        .secondary { border: 1px solid #454545; background: #303030; color: #ededed; }
        .disabled-send { border: 1px solid #383838; background: #292929; color: #686868; cursor: not-allowed; }
        .connection-note { padding: 13px; border: 1px solid rgba(225,191,115,.24); background: rgba(225,191,115,.05); border-radius: 12px; }
        .connection-note strong { font-size: .73rem; }
        .connection-note p { margin: 4px 0 0; color: #8b8170; font-size: .67rem; line-height: 1.45; }
        .address-card { border: 1px solid #353535; border-radius: 12px; background: #2b2b2b; overflow: hidden; }
        .address-card > div { display: grid; grid-template-columns: 70px minmax(0,1fr); gap: 10px; padding: 10px 12px; border-top: 1px solid #333; }
        .address-card > div:first-child { border-top: 0; }
        .address-card span { color: #6f6f6f; font-size: .67rem; }
        .address-card strong { font-size: .72rem; color: #cfcfcf; overflow: hidden; text-overflow: ellipsis; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .status { color: #9b9b9b; background: #222; border: 1px solid #343434; border-radius: 10px; padding: 10px 12px; font-size: .7rem; line-height: 1.45; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) {
          .email-inner { width: calc(100% - 28px); padding-top: 24px; }
          .actions { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AIEmailComposer;
