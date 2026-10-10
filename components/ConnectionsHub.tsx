'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type GoogleService = 'drive' | 'gmail' | 'calendar' | 'photos';

type GoogleConnection = {
  connected?: boolean;
  provider?: 'google';
  email?: string;
  name?: string;
  services?: GoogleService[];
  scope?: string;
  sealedBundle?: string;
  connectedAt?: number;
  lastVerifiedAt?: number;
  checks?: Record<string, boolean>;
};

type IntegrationStatus = {
  google?: {
    configured?: boolean;
    callbackUrl?: string;
  };
};

const GOOGLE_SERVICES: Array<{
  id: GoogleService;
  name: string;
  note: string;
}> = [
  { id: 'drive', name: 'Google Drive', note: 'Read and search files you authorize.' },
  { id: 'gmail', name: 'Gmail', note: 'Read mail for context and future Life Radar follow-up.' },
  { id: 'calendar', name: 'Google Calendar', note: 'Read calendars and upcoming events.' },
  { id: 'photos', name: 'Google Photos', note: 'Use Google Photos Picker for photos you choose.' },
];

export default function ConnectionsHub({ userId }: { userId: string }) {
  const [status, setStatus] = useState<IntegrationStatus>({});
  const [google, setGoogle] = useState<GoogleConnection>({});
  const [selected, setSelected] = useState<Record<GoogleService, boolean>>({
    drive: true,
    gmail: false,
    calendar: true,
    photos: false,
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Loading connection status…');

  const verify = async (connection: GoogleConnection) => {
    if (!connection.sealedBundle) return;

    setBusy('google-test');
    try {
      const token = await firebaseBackend.getIdToken();
      const response = await fetch('/api/integrations/google/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ sealedBundle: connection.sealedBundle }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setMessage(data.error || 'Google connection needs attention.');
        return;
      }

      const next: GoogleConnection = {
        ...connection,
        sealedBundle: data.sealedBundle || connection.sealedBundle,
        lastVerifiedAt: Number(data.checkedAt || Date.now()),
        checks: data.checks || {},
      };
      await firebaseBackend.saveDraft('integration-google', next);
      setGoogle(next);
      setMessage('Google connection verified.');
    } catch {
      setMessage('Google connection test failed.');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [configResponse, saved] = await Promise.all([
          fetch('/api/integrations/status', { cache: 'no-store' }),
          firebaseBackend.getLatestDraft('integration-google'),
        ]);

        if (!active) return;

        if (configResponse.ok) {
          setStatus(await configResponse.json());
        }

        if (saved?.connected) {
          const next = saved as GoogleConnection;
          setGoogle(next);
          const services = Array.isArray(next.services) ? next.services : [];
          setSelected({
            drive: services.includes('drive'),
            gmail: services.includes('gmail'),
            calendar: services.includes('calendar'),
            photos: services.includes('photos'),
          });
          setMessage('Google is connected to this signed-in workspace.');
        } else {
          setMessage('Choose what Google services Life\'s Assistant may access.');
        }
      } catch {
        if (active) setMessage('Could not load connection status.');
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type !== 'life-assistant-google-oauth') return;

      setBusy('');

      if (!data.ok) {
        setMessage(data.error || 'Google connection was not completed.');
        return;
      }

      const next: GoogleConnection = {
        connected: true,
        provider: 'google',
        email: String(data.email || ''),
        name: String(data.name || ''),
        services: Array.isArray(data.services) ? data.services : [],
        scope: String(data.scope || ''),
        sealedBundle: String(data.sealedBundle || ''),
        connectedAt: Number(data.connectedAt || Date.now()),
      };

      await firebaseBackend.saveDraft('integration-google', next);
      setGoogle(next);
      setMessage('Google connected. Running a live permission check…');
      await verify(next);
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  });

  const chosenServices = useMemo(
    () => GOOGLE_SERVICES.filter((item) => selected[item.id]).map((item) => item.id),
    [selected]
  );

  const connect = async () => {
    if (!status.google?.configured) {
      setMessage(
        'The Connections screen is installed, but Google OAuth still needs its client ID and secret.'
      );
      return;
    }

    if (!chosenServices.length) {
      setMessage('Select at least one Google service.');
      return;
    }

    const popup = window.open(
      'about:blank',
      'life-assistant-google-oauth',
      'width=620,height=760'
    );

    if (!popup) {
      setMessage('Your browser blocked the Google sign-in popup.');
      return;
    }

    setBusy('google-connect');
    setMessage('Opening Google permission screen…');

    try {
      const token = await firebaseBackend.getIdToken();
      const response = await fetch('/api/integrations/google/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ services: chosenServices }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        popup.close();
        setBusy('');
        setMessage(data.error || 'Could not start Google connection.');
        return;
      }

      popup.location.href = data.url;
    } catch {
      popup.close();
      setBusy('');
      setMessage('Could not start Google connection.');
    }
  };

  const disconnect = async () => {
    setBusy('google-disconnect');
    try {
      if (google.sealedBundle) {
        const token = await firebaseBackend.getIdToken();
        await fetch('/api/integrations/google/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ sealedBundle: google.sealedBundle }),
        });
      }

      const cleared: GoogleConnection = {
        connected: false,
        provider: 'google',
        services: [],
        sealedBundle: '',
      };
      await firebaseBackend.saveDraft('integration-google', cleared);
      setGoogle(cleared);
      setMessage('Google disconnected.');
    } finally {
      setBusy('');
    }
  };

  const providerCards = [
    { name: 'Microsoft 365', note: 'Outlook, Calendar, OneDrive', state: 'Next' },
    { name: 'Dropbox', note: 'Files and shared folders', state: 'Next' },
    { name: 'Apple / iCloud', note: 'Native Apple access requires the iPhone/Mac app path.', state: 'Native' },
    { name: 'GitHub', note: 'Repositories, issues and development work', state: 'Planned' },
  ];

  return (
    <div className="connections-page">
      <div className="inner">
        <header>
          <span className="eyebrow">CONNECTIONS</span>
          <h1>Give the assistant more reach.</h1>
          <p>
            Connect outside services deliberately. Each provider keeps its own permissions,
            connection status, and disconnect control.
          </p>
        </header>

        <section className="provider google">
          <div className="provider-head">
            <div className="provider-mark">G</div>
            <div>
              <h2>Google</h2>
              <p>One connection foundation for Drive, Gmail, Calendar, and Photos.</p>
            </div>
            <span className={google.connected ? 'state connected' : 'state'}>
              {google.connected
                ? 'Connected'
                : status.google?.configured
                  ? 'Ready'
                  : 'Setup required'}
            </span>
          </div>

          {google.connected && (
            <div className="account-line">
              <strong>{google.email || google.name || 'Google account'}</strong>
              <span>
                {google.lastVerifiedAt
                  ? 'Verified ' + new Date(google.lastVerifiedAt).toLocaleString()
                  : 'Connected, not yet verified'}
              </span>
            </div>
          )}

          <div className="service-grid">
            {GOOGLE_SERVICES.map((service) => {
              const connected = google.connected && google.services?.includes(service.id);
              const checked = connected ? true : selected[service.id];

              return (
                <label className={'service ' + (connected ? 'live' : '')} key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <small>{service.note}</small>
                  </div>
                  {google.connected ? (
                    <span>{connected ? 'ON' : 'OFF'}</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [service.id]: event.target.checked,
                        }))
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>

          {!status.google?.configured && (
            <div className="setup-box">
              <strong>Google Cloud setup still needed</strong>
              <p>
                Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then register this callback:
              </p>
              <code>{status.google?.callbackUrl || 'https://lifes-assistant.vercel.app/api/integrations/google/callback'}</code>
            </div>
          )}

          <div className="provider-actions">
            {google.connected ? (
              <>
                <button
                  className="primary"
                  disabled={Boolean(busy)}
                  onClick={() => verify(google)}
                >
                  {busy === 'google-test' ? 'Checking…' : 'Test connection'}
                </button>
                <button disabled={Boolean(busy)} onClick={connect}>
                  Change permissions
                </button>
                <button
                  className="danger"
                  disabled={Boolean(busy)}
                  onClick={disconnect}
                >
                  {busy === 'google-disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                className="primary"
                disabled={Boolean(busy)}
                onClick={connect}
              >
                {busy === 'google-connect' ? 'Opening Google…' : 'Connect Google'}
              </button>
            )}
          </div>
        </section>

        <section className="message">{message}</section>

        <div className="coming-grid">
          {providerCards.map((provider) => (
            <article key={provider.name}>
              <div>
                <strong>{provider.name}</strong>
                <p>{provider.note}</p>
              </div>
              <span>{provider.state}</span>
            </article>
          ))}
        </div>

        <section className="security-note">
          <strong>Connection security</strong>
          <p>
            OAuth access and refresh tokens are sealed on the server before the encrypted bundle is
            saved with your Firebase workspace. Plain Google tokens are not written to localStorage.
          </p>
        </section>
      </div>

      <style jsx>{`
        .connections-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .inner { width: min(1050px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0 70px; }
        header { margin-bottom: 20px; }
        .eyebrow { color: #7d7d7d; font-size: .62rem; letter-spacing: .15em; font-weight: 800; }
        h1 { margin: 7px 0; font-size: clamp(1.8rem, 4vw, 2.8rem); letter-spacing: -.045em; }
        header p { margin: 0; max-width: 700px; color: #828282; font-size: .78rem; line-height: 1.5; }
        .provider { border: 1px solid #383838; background: #252525; border-radius: 18px; padding: 17px; }
        .provider-head { display: grid; grid-template-columns: 42px minmax(0,1fr) auto; gap: 11px; align-items: center; }
        .provider-mark { width: 42px; height: 42px; border-radius: 12px; background: #eee; color: #171717; display: grid; place-items: center; font-weight: 850; }
        h2 { margin: 0; font-size: 1rem; }
        .provider-head p { margin: 3px 0 0; color: #747474; font-size: .67rem; }
        .state { padding: 5px 8px; border-radius: 999px; background: #343434; color: #8d8d8d; font-size: .6rem; }
        .state.connected { background: #25362d; color: #8dd0a6; }
        .account-line { margin-top: 13px; padding: 10px 12px; border-radius: 11px; background: #202020; border: 1px solid #333; display: flex; justify-content: space-between; gap: 12px; }
        .account-line strong { font-size: .7rem; }
        .account-line span { color: #737373; font-size: .62rem; }
        .service-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
        .service { min-height: 66px; padding: 11px 12px; border: 1px solid #373737; background: #292929; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .service.live { border-color: rgba(99,210,151,.24); }
        .service strong, .service small { display: block; }
        .service strong { font-size: .72rem; }
        .service small { color: #727272; font-size: .61rem; line-height: 1.4; margin-top: 3px; }
        .service input { width: 18px; height: 18px; accent-color: #eee; }
        .service > span { font-size: .58rem; color: #8fc7a2; }
        .setup-box { margin-top: 12px; padding: 12px; border: 1px solid rgba(218,179,91,.26); border-radius: 12px; background: rgba(68,55,29,.2); }
        .setup-box strong { font-size: .7rem; }
        .setup-box p { margin: 4px 0 7px; color: #887d67; font-size: .63rem; }
        code { display: block; overflow-x: auto; padding: 8px; background: #1c1c1c; border-radius: 8px; color: #c7b78c; font-size: .61rem; }
        .provider-actions { margin-top: 13px; display: flex; flex-wrap: wrap; gap: 7px; }
        button { border: 1px solid #3b3b3b; background: #2d2d2d; color: #ccc; border-radius: 9px; min-height: 37px; padding: 0 11px; cursor: pointer; font-size: .66rem; }
        button.primary { background: #ededed; color: #111; border-color: #ededed; font-weight: 750; }
        button.danger { border-color: #4b3434; color: #c88989; background: #302626; }
        button:disabled { opacity: .55; cursor: default; }
        .message { margin-top: 9px; padding: 10px 12px; border: 1px solid #343434; background: #1d1d1d; border-radius: 10px; color: #868686; font-size: .64rem; }
        .coming-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
        .coming-grid article { min-height: 78px; padding: 13px; border: 1px solid #343434; border-radius: 13px; background: #252525; display: flex; justify-content: space-between; gap: 12px; }
        .coming-grid strong { font-size: .73rem; }
        .coming-grid p { margin: 4px 0 0; color: #707070; font-size: .62rem; line-height: 1.4; }
        .coming-grid span { align-self: flex-start; padding: 4px 7px; border-radius: 999px; background: #333; color: #888; font-size: .56rem; }
        .security-note { margin-top: 14px; padding: 14px; border: 1px solid #343434; border-radius: 13px; background: #252525; }
        .security-note strong { font-size: .72rem; }
        .security-note p { margin: 5px 0 0; color: #737373; font-size: .64rem; line-height: 1.5; }
        @media (max-width: 700px) {
          .inner { width: calc(100% - 24px); padding-top: 22px; }
          .service-grid, .coming-grid { grid-template-columns: 1fr; }
          .provider-head { grid-template-columns: 38px minmax(0,1fr); }
          .provider-head .state { grid-column: 1 / -1; justify-self: start; }
          .account-line { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
