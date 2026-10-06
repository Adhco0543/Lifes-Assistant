'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type StatusData = {
  app?: { ready?: boolean };
  ai?: { configured?: boolean; model?: string };
  firebase?: { configured?: boolean };
  email?: { configured?: boolean; domainVerified?: boolean; domainStatus?: string; sender?: string | null };
};

const card: React.CSSProperties = {
  background: '#262626',
  border: '1px solid #343434',
  borderRadius: 16,
  padding: 18,
};

export default function SystemCheck() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [cloudAccess, setCloudAccess] = useState<boolean | null>(null);
  const [aiLive, setAiLive] = useState<boolean | null>(null);
  const [authSession, setAuthSession] = useState<boolean | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const user = firebaseBackend.getCurrentUser();
      setAuthSession(Boolean(user));

      if (!user) {
        setData(null);
        setAiLive(false);
        setCloudAccess(false);
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/system-status', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });

      if (!response.ok) {
        throw new Error('System status request failed');
      }

      const next = await response.json();
      setData(next);

      try {
        await firebaseBackend.testCloudSync();
        setCloudAccess(true);
      } catch {
        setCloudAccess(false);
      }

      if (next?.ai?.configured && user) {
        try {
          const aiResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({
              message: 'Reply with exactly: system check passed',
              businessContext: 'production system check',
              chatbotName: "Life's Assistant",
              memoryEnabled: false,
              history: [],
            }),
          });

          const aiBody = await aiResponse.json().catch(() => ({}));
          setAiLive(Boolean(aiResponse.ok && typeof aiBody?.message === 'string' && aiBody.message.trim()));
        } catch {
          setAiLive(false);
        }
      } else {
        setAiLive(false);
      }

      setCheckedAt(new Date());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const rows = [
    {
      name: 'Application',
      detail: 'Production deployment and app runtime',
      ok: Boolean(data?.app?.ready),
      value: data?.app?.ready ? 'Ready' : 'Unavailable',
    },
    {
      name: 'AI',
      detail: data?.ai?.model ? 'Model: ' + data.ai.model : 'OpenAI configuration',
      ok: Boolean(data?.ai?.configured && aiLive === true),
      value: !data?.ai?.configured
        ? 'Not configured'
        : aiLive === null
          ? 'Checking live request'
          : aiLive
            ? 'Live request passed'
            : 'Live request failed',
    },
    {
      name: 'Authentication',
      detail: 'Firebase sign-in configuration',
      ok: Boolean(data?.firebase?.configured && authSession === true),
      value: !data?.firebase?.configured
        ? 'Not configured'
        : authSession === null
          ? 'Checking session'
          : authSession
            ? 'Signed-in session confirmed'
            : 'No signed-in session',
    },
    {
      name: 'Cloud workspace',
      detail: 'Signed-in Firestore read/write/delete verification',
      ok: cloudAccess === true,
      value: cloudAccess === null ? 'Checking' : cloudAccess ? 'Cloud sync verified' : 'Cloud sync failed',
    },
    {
      name: 'Email delivery',
      detail: data?.email?.sender || 'Transactional sender',
      ok: Boolean(data?.email?.configured && data?.email?.domainVerified),
      value: data?.email?.domainVerified
        ? 'Ready to send'
        : data?.email?.configured
          ? 'DNS verification: ' + String(data?.email?.domainStatus || 'pending')
          : 'Not configured',
    },
  ];

  const readyCount = rows.filter((row) => row.ok).length;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#212121', color: '#ececec' }}>
      <div style={{ width: 'min(1040px, calc(100% - 44px))', margin: '0 auto', padding: '42px 0 70px' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#747474', fontSize: '.64rem', letterSpacing: '.14em', fontWeight: 750 }}>SYSTEM CHECK</div>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-.045em', fontWeight: 650 }}>
            Know what is real before you depend on it.
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: '#858585', lineHeight: 1.55, fontSize: '.8rem' }}>
            This page exercises the same production paths used by the app. Green means the live path answered successfully, not merely that a setting exists.
          </p>
        </header>

        <section style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ color: '#747474', fontSize: '.64rem', letterSpacing: '.14em', fontWeight: 750 }}>READINESS</div>
            <strong style={{ display: 'block', marginTop: 5, fontSize: '1rem' }}>
              {loading ? 'Checking…' : readyCount + ' of ' + rows.length + ' core systems ready'}
            </strong>
            <small style={{ color: '#6d6d6d', display: 'block', marginTop: 4 }}>
              {checkedAt ? 'Last checked ' + checkedAt.toLocaleTimeString() : 'Live production check'}
            </small>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            style={{ minHeight: 40, padding: '0 14px', border: 0, borderRadius: 10, background: '#ededed', color: '#111', fontWeight: 650, cursor: 'pointer' }}
          >
            {loading ? 'Checking…' : 'Run check again'}
          </button>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 12 }}>
          {rows.map((row) => (
            <article key={row.name} style={{ ...card, minHeight: 138, display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', gap: 12 }}>
              <div style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 11, background: '#303030', color: row.ok ? '#78d7a4' : '#e5c276' }}>
                {row.ok ? '✓' : '…'}
              </div>
              <div>
                <strong style={{ fontSize: '.82rem' }}>{row.name}</strong>
                <p style={{ margin: '5px 0 10px', color: '#777', fontSize: '.68rem', lineHeight: 1.45 }}>{row.detail}</p>
                <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, fontSize: '.62rem', color: row.ok ? '#78d7a4' : '#e5c276', background: '#303030' }}>
                  {row.value}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section style={{ ...card, marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(220px,.8fr) minmax(0,1.2fr)', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ color: '#747474', fontSize: '.64rem', letterSpacing: '.14em', fontWeight: 750 }}>RELEASE-CANDIDATE RULE</div>
            <h2 style={{ margin: '5px 0 0', fontSize: '1rem' }}>No separate test-only behavior.</h2>
          </div>
          <p style={{ color: '#7f7f7f', fontSize: '.72rem', lineHeight: 1.55, margin: 0 }}>
            Every action we test here should be the same action path that ships. Missing provider setup is shown as unavailable instead of replaced with a pretend success.
          </p>
        </section>
      </div>
    </div>
  );
}
