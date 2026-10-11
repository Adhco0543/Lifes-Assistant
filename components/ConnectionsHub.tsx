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
  reconnectRequiredAfter?: number;
  mode?: 'server-oauth' | 'firebase';
  checks?: Record<string, boolean>;
};

type GitHubConnection = {
  connected?: boolean;
  provider?: 'github';
  login?: string;
  name?: string;
  avatarUrl?: string;
  repositoryAccess?: boolean;
  scope?: string;
  sealedBundle?: string;
  connectedAt?: number;
  lastVerifiedAt?: number;
  repositoryCount?: number;
  repositoryNames?: string[];
};

type IntegrationStatus = {
  google?: {
    configured?: boolean;
    mode?: 'server-oauth' | 'firebase' | 'none';
    callbackUrl?: string;
  };
  github?: {
    configured?: boolean;
    callbackUrl?: string;
    supportsPrivateRepositories?: boolean;
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
  const [github, setGitHub] = useState<GitHubConnection>({});
  const [githubRepositoryAccess, setGitHubRepositoryAccess] = useState(false);
  const [selected, setSelected] = useState<Record<GoogleService, boolean>>({
    drive: true,
    gmail: false,
    calendar: true,
    photos: false,
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Loading connection status…');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState('');

  const googleBusy = busy.startsWith('google-');
  const githubBusy = busy.startsWith('github-');

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
        const detail = data.error || 'Google connection needs attention.';
        setGoogleNotice(detail);
        setMessage(detail);
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
      setGoogleNotice('Google connection verified. Bella can use the services authorized above.');
      setMessage('Google connection verified.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Google connection test failed.';
      setGoogleNotice(detail);
      setMessage(detail);
    } finally {
      setBusy('');
    }
  };

  const verifyGitHub = async (connection: GitHubConnection) => {
    if (!connection.sealedBundle) return;

    setBusy('github-test');
    try {
      const token = await firebaseBackend.getIdToken();
      const response = await fetch('/api/integrations/github/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ sealedBundle: connection.sealedBundle }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setMessage(data.error || 'GitHub connection needs attention.');
        return;
      }

      let next: GitHubConnection = {
        ...connection,
        login: data.login || connection.login,
        name: data.name || connection.name,
        avatarUrl: data.avatarUrl || connection.avatarUrl,
        repositoryAccess: Boolean(data.repositoryAccess),
        sealedBundle: data.sealedBundle || connection.sealedBundle,
        lastVerifiedAt: Number(data.checkedAt || Date.now()),
      };

      const repoResponse = await fetch('/api/integrations/github/repos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ sealedBundle: next.sealedBundle }),
      });
      const repoData = await repoResponse.json();

      if (repoResponse.ok && repoData.ok) {
        const repositories = Array.isArray(repoData.repositories)
          ? repoData.repositories
          : [];
        next = {
          ...next,
          sealedBundle: repoData.sealedBundle || next.sealedBundle,
          repositoryCount: repositories.length,
          repositoryNames: repositories
            .slice(0, 6)
            .map((repo: any) => String(repo.fullName || ''))
            .filter(Boolean),
        };
      }

      await firebaseBackend.saveDraft('integration-github', next);
      setGitHub(next);
      setGitHubRepositoryAccess(Boolean(next.repositoryAccess));
      setMessage('GitHub connection verified.');
    } catch {
      setMessage('GitHub connection test failed.');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [configResponse, savedGoogle, savedGitHub] = await Promise.all([
          fetch('/api/integrations/status', { cache: 'no-store' }),
          firebaseBackend.getLatestDraft('integration-google'),
          firebaseBackend.getLatestDraft('integration-github'),
        ]);

        if (!active) return;

        if (configResponse.ok) {
          setStatus(await configResponse.json());
        }

        if (savedGoogle?.connected) {
          const next = savedGoogle as GoogleConnection;
          setGoogle(next);
          const services = Array.isArray(next.services) ? next.services : [];
          setSelected({
            drive: services.includes('drive'),
            gmail: services.includes('gmail'),
            calendar: services.includes('calendar'),
            photos: services.includes('photos'),
          });
        }

        if (savedGitHub?.connected) {
          const next = savedGitHub as GitHubConnection;
          setGitHub(next);
          setGitHubRepositoryAccess(Boolean(next.repositoryAccess));
        }

        if (savedGoogle?.connected || savedGitHub?.connected) {
          setMessage('Connected services are available to this signed-in workspace.');
        } else {
          setMessage('Choose the services Life\'s Assistant may access.');
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

      if (data.type === 'life-assistant-google-oauth') {
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
        return;
      }

      if (data.type === 'life-assistant-github-oauth') {
        setBusy('');

        if (!data.ok) {
          setMessage(data.error || 'GitHub connection was not completed.');
          return;
        }

        const next: GitHubConnection = {
          connected: true,
          provider: 'github',
          login: String(data.login || ''),
          name: String(data.name || ''),
          avatarUrl: String(data.avatarUrl || ''),
          repositoryAccess: Boolean(data.repositoryAccess),
          scope: String(data.scope || ''),
          sealedBundle: String(data.sealedBundle || ''),
          connectedAt: Number(data.connectedAt || Date.now()),
        };

        await firebaseBackend.saveDraft('integration-github', next);
        setGitHub(next);
        setGitHubRepositoryAccess(Boolean(next.repositoryAccess));
        setMessage('GitHub connected. Checking account and repositories…');
        await verifyGitHub(next);
      }
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  });

  const chosenServices = useMemo(
    () => GOOGLE_SERVICES.filter((item) => selected[item.id]).map((item) => item.id),
    [selected]
  );

  const connectGitHub = async () => {
    if (!status.github?.configured) {
      setMessage(
        'GitHub connection code is installed, but the GitHub OAuth client ID and secret still need to be added.'
      );
      return;
    }

    const popup = window.open(
      'about:blank',
      'life-assistant-github-oauth',
      'width=720,height=780'
    );

    if (!popup) {
      setMessage('Your browser blocked the GitHub sign-in popup.');
      return;
    }

    setBusy('github-connect');
    setMessage('Opening GitHub authorization…');

    try {
      const token = await firebaseBackend.getIdToken();
      const response = await fetch('/api/integrations/github/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ repositoryAccess: githubRepositoryAccess }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        popup.close();
        setBusy('');
        setMessage(data.error || 'Could not start GitHub connection.');
        return;
      }

      popup.location.href = data.url;

      const closeWatch = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(closeWatch);
          setBusy((current) => current === 'github-connect' ? '' : current);
        }
      }, 500);
    } catch {
      popup.close();
      setBusy('');
      setMessage('Could not start GitHub connection.');
    }
  };

  const disconnectGitHub = async () => {
    setBusy('github-disconnect');
    try {
      if (github.sealedBundle) {
        const token = await firebaseBackend.getIdToken();
        await fetch('/api/integrations/github/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ sealedBundle: github.sealedBundle }),
        });
      }

      const cleared: GitHubConnection = {
        connected: false,
        provider: 'github',
        repositoryAccess: false,
        sealedBundle: '',
      };
      await firebaseBackend.saveDraft('integration-github', cleared);
      setGitHub(cleared);
      setGitHubRepositoryAccess(false);
      setMessage('GitHub disconnected.');
    } finally {
      setBusy('');
    }
  };

  const connect = async () => {
    setGoogleNotice('');
    if (!status.google?.configured) {
      setGoogleNotice('Google connection is not available in this build.');
      setMessage('Google connection is not available in this build.');
      return;
    }

    if (!chosenServices.length) {
      setGoogleNotice('Select at least one Google service.');
      setMessage('Select at least one Google service.');
      return;
    }

    setBusy('google-connect');
    setGoogleNotice('Opening Google sign-in… If no window appears, check whether your browser blocked popups.');
    setMessage('Opening Google permission screen…');

    if (status.google.mode === 'firebase') {
      try {
        const googleAuth = await firebaseBackend.authorizeGoogleServices(chosenServices);
        const token = await firebaseBackend.getIdToken();

        if (!token) {
          throw new Error('Authentication required.');
        }

        const response = await fetch('/api/integrations/google/firebase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            accessToken: googleAuth.accessToken,
            services: googleAuth.services,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok || !data.sealedBundle) {
          throw new Error(data.error || 'Could not finish Google connection.');
        }

        const next: GoogleConnection = {
          connected: true,
          provider: 'google',
          email: String(data.email || googleAuth.email || ''),
          name: String(data.name || googleAuth.name || ''),
          services: Array.isArray(data.services) ? data.services : chosenServices,
          scope: String(data.scope || ''),
          sealedBundle: String(data.sealedBundle),
          connectedAt: Number(data.connectedAt || Date.now()),
          reconnectRequiredAfter: Number(data.reconnectRequiredAfter || 0) || undefined,
          mode: 'firebase',
        };

        await firebaseBackend.saveDraft('integration-google', next);
        setGoogle(next);
        setSelected({
          drive: next.services?.includes('drive') ?? false,
          gmail: next.services?.includes('gmail') ?? false,
          calendar: next.services?.includes('calendar') ?? false,
          photos: next.services?.includes('photos') ?? false,
        });
        setMessage('Google connected through Firebase. Checking the permissions now…');
        await verify(next);
      } catch (error: any) {
        const code = String(error?.code || '');
        let detail = '';
        if (code === 'auth/operation-not-allowed') {
          detail = 'Google sign-in is disabled in Firebase Authentication. Enable the Google sign-in provider, then retry.';
        } else if (code === 'auth/unauthorized-domain') {
          detail = 'This site is not an authorized Firebase sign-in domain. Add lifes-assistant.vercel.app to Firebase Authentication > Settings > Authorized domains.';
        } else if (code === 'auth/popup-blocked') {
          detail = 'Your browser blocked the Google popup. Allow popups for lifes-assistant.vercel.app, then retry.';
        } else if (code === 'auth/popup-closed-by-user') {
          detail = 'The Google sign-in window was closed before connecting.';
        } else if (code === 'auth/cancelled-popup-request') {
          detail = 'Another Google sign-in was already open. Close other sign-in windows and retry.';
        } else {
          detail = error instanceof Error ? error.message : 'Could not connect Google through Firebase.';
          if (code && !detail.includes(code)) detail += ' (' + code + ')';
        }
        setGoogleNotice(detail);
        setMessage(detail);
      } finally {
        setBusy('');
      }
      return;
    }

    const popup = window.open(
      'about:blank',
      'life-assistant-google-oauth',
      'width=620,height=760'
    );

    if (!popup) {
      setBusy('');
      setMessage('Your browser blocked the Google sign-in popup.');
      return;
    }

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

      const closeWatch = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(closeWatch);
          setBusy((current) => current === 'google-connect' ? '' : current);
        }
      }, 500);
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

  const googleReconnectNeeded = Boolean(
    google.connected && google.mode === 'firebase' &&
    google.reconnectRequiredAfter && Date.now() >= google.reconnectRequiredAfter
  );

  const providerCards = [
    {
      id: 'microsoft',
      name: 'Microsoft 365',
      note: 'Outlook, Calendar, OneDrive',
      state: 'Planned',
      details: 'Microsoft sign-in and Microsoft Graph permissions are not implemented yet. A Microsoft Entra app registration and a secure OAuth callback are needed before Bella can access Outlook, Calendar, or OneDrive.',
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      note: 'Files and shared folders',
      state: 'Planned',
      details: 'Dropbox sign-in and file APIs are not connected yet. A Dropbox app, user consent, and scoped file-reading endpoints must be added before Bella can search your files.',
    },
    {
      id: 'apple',
      name: 'Apple / iCloud',
      note: 'Photos and iCloud content',
      state: 'Native',
      details: 'Full iCloud Photos access is not available through a general website connection. A companion iPhone or Mac app, with your explicit Photos permissions, is the planned route. This tile does not connect to iCloud today.',
    },
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
              {googleReconnectNeeded
                ? 'Reconnect needed'
                : google.connected
                  ? 'Connected'
                  : status.google?.configured
                    ? 'Ready to connect'
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
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={googleBusy}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [service.id]: event.target.checked,
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>

          {!status.google?.configured && (
            <div className="setup-box">
              <strong>Google connection is not configured yet</strong>
              <p>
                Firebase or server OAuth configuration is missing from this deployment.
              </p>
            </div>
          )}

          {status.google?.mode === 'firebase' && !google.connected && (
            <div className="setup-box firebase-mode">
              <strong>Google is ready to connect</strong>
              <p>
                Select the Google services above and choose Connect Google. This beta connection uses Firebase sign-in and may need renewal after about 50 minutes.
              </p>
            </div>
          )}
          {googleReconnectNeeded && (
            <div className="setup-box">
              <strong>Google access has expired</strong>
              <p>Your account is still listed, but Bella needs fresh permission to access Google services. Select Reconnect Google below.</p>
            </div>
          )}

          <div className="provider-actions">
            {google.connected ? (
              <>
                {!googleReconnectNeeded && (
                  <button
                    className="primary"
                    disabled={googleBusy}
                    onClick={() => verify(google)}
                  >
                    {busy === 'google-test' ? 'Checking…' : 'Test connection'}
                  </button>
                )}
                <button
                  className={googleReconnectNeeded ? 'primary' : ''}
                  disabled={googleBusy}
                  onClick={connect}
                >
                  {googleReconnectNeeded ? 'Reconnect Google' : 'Change permissions'}
                </button>
                <button
                  className="danger"
                  disabled={googleBusy}
                  onClick={disconnect}
                >
                  {busy === 'google-disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                className="primary"
                disabled={googleBusy || !status.google?.configured}
                onClick={connect}
              >
                {busy === 'google-connect' ? 'Opening Google…' : 'Connect Google'}
              </button>
            )}
          </div>
          {googleNotice && (
            <div className="google-feedback" role="status" aria-live="polite">
              {googleNotice}
            </div>
          )}
        </section>

        <section className="provider github-provider">
          <div className="provider-head">
            <div className="provider-mark github-mark">GH</div>
            <div>
              <h2>GitHub</h2>
              <p>Connect your account and let Life&apos;s Assistant see development work you authorize.</p>
            </div>
            <span className={github.connected ? 'state connected' : 'state'}>
              {github.connected
                ? 'Connected'
                : status.github?.configured
                  ? 'Ready'
                  : 'Setup required'}
            </span>
          </div>

          {github.connected && (
            <div className="account-line">
              <strong>{github.login ? '@' + github.login : github.name || 'GitHub account'}</strong>
              <span>
                {github.lastVerifiedAt
                  ? 'Verified ' + new Date(github.lastVerifiedAt).toLocaleString()
                  : 'Connected, not yet verified'}
              </span>
            </div>
          )}

          <div className="service-grid github-services">
            <label className="service live">
              <div>
                <strong>GitHub identity</strong>
                <small>Profile and account identity used to verify whose GitHub is connected.</small>
              </div>
              <span>ON</span>
            </label>

            <label className={'service ' + (githubRepositoryAccess ? 'live' : '')}>
              <div>
                <strong>Private repository access</strong>
                <small>
                  Optional. GitHub OAuth cannot make private source-code access read-only, so this permission is deliberately separate.
                </small>
              </div>
              <input
                type="checkbox"
                checked={githubRepositoryAccess}
                disabled={githubBusy}
                onChange={(event) => setGitHubRepositoryAccess(event.target.checked)}
              />
            </label>
          </div>

          {github.connected && (
            <div className="repo-summary">
              <strong>Change GitHub access</strong>
              <p>Toggle private repository access above, then press Change access to re-authorize GitHub with the new permission.</p>
            </div>
          )}

          {github.connected && typeof github.repositoryCount === 'number' && (
            <div className="repo-summary">
              <strong>{github.repositoryCount} repositories visible</strong>
              {github.repositoryNames?.length ? (
                <p>{github.repositoryNames.join(' · ')}</p>
              ) : (
                <p>No repositories were returned with the current permission set.</p>
              )}
            </div>
          )}

          {!status.github?.configured && (
            <div className="setup-box">
              <strong>GitHub developer setup still needed</strong>
              <p>
                Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel, and use this authorization callback URL:
              </p>
              <code>{status.github?.callbackUrl || 'https://lifes-assistant.vercel.app/api/integrations/github/callback'}</code>
            </div>
          )}

          <div className="provider-actions">
            {github.connected ? (
              <>
                <button
                  className="primary"
                  disabled={githubBusy}
                  onClick={() => verifyGitHub(github)}
                >
                  {busy === 'github-test' ? 'Checking…' : 'Test connection'}
                </button>
                <button disabled={githubBusy} onClick={connectGitHub}>
                  Change access
                </button>
                <button
                  className="danger"
                  disabled={githubBusy}
                  onClick={disconnectGitHub}
                >
                  {busy === 'github-disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                className="primary"
                disabled={githubBusy}
                onClick={connectGitHub}
              >
                {busy === 'github-connect' ? 'Opening GitHub…' : 'Connect GitHub'}
              </button>
            )}
          </div>
        </section>

        <section className="message">{message}</section>

        <div className="coming-grid">
          {providerCards.map((provider) => (
            <article key={provider.id} className="planned-provider">
              <button
                type="button"
                className="planned-trigger"
                aria-expanded={expandedProvider === provider.id}
                aria-controls={'provider-details-' + provider.id}
                onClick={() => setExpandedProvider((current) => current === provider.id ? null : provider.id)}
              >
                <span className="planned-label">
                  <strong>{provider.name}</strong>
                  <small>{provider.note}</small>
                </span>
                <span className="planned-state">{provider.state} {expandedProvider === provider.id ? '−' : '+'}</span>
              </button>
              {expandedProvider === provider.id && (
                <div className="planned-details" id={'provider-details-' + provider.id}>
                  <p>{provider.details}</p>
                  <strong>Connection not yet available</strong>
                </div>
              )}
            </article>
          ))}
        </div>

        <section className="security-note">
          <strong>Connection security</strong>
          <p>
            Google tokens are sealed on the server before the encrypted bundle is saved with your Firebase workspace. Plain Google tokens are not written to localStorage. Full server OAuth can still be enabled later for long-lived refresh tokens.
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
        .github-provider { margin-top: 14px; }
        .github-mark { font-size: .68rem; letter-spacing: -.03em; }
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
        .repo-summary { margin-top: 10px; padding: 10px 12px; background: #202020; border: 1px solid #333; border-radius: 11px; }
        .repo-summary strong { font-size: .68rem; }
        .repo-summary p { margin: 4px 0 0; color: #747474; font-size: .6rem; line-height: 1.45; overflow-wrap: anywhere; }
        .setup-box { margin-top: 12px; padding: 12px; border: 1px solid rgba(218,179,91,.26); border-radius: 12px; background: rgba(68,55,29,.2); }
        .setup-box strong { font-size: .7rem; }
        .setup-box p { margin: 4px 0 7px; color: #887d67; font-size: .63rem; }
        code { display: block; overflow-x: auto; padding: 8px; background: #1c1c1c; border-radius: 8px; color: #c7b78c; font-size: .61rem; }
        .provider-actions { margin-top: 13px; display: flex; flex-wrap: wrap; gap: 7px; }
        .google-feedback { margin-top: 12px; padding: 12px; border: 1px solid #66583d; background: #302b22; color: #f0dfba; border-radius: 10px; font-size: .72rem; line-height: 1.55; overflow-wrap: anywhere; }
        button { border: 1px solid #3b3b3b; background: #2d2d2d; color: #ccc; border-radius: 9px; min-height: 37px; padding: 0 11px; cursor: pointer; font-size: .66rem; }
        button.primary { background: #ededed; color: #111; border-color: #ededed; font-weight: 750; }
        button.danger { border-color: #4b3434; color: #c88989; background: #302626; }
        button:disabled { opacity: .55; cursor: default; }
        .message { margin-top: 9px; padding: 10px 12px; border: 1px solid #343434; background: #1d1d1d; border-radius: 10px; color: #868686; font-size: .64rem; }
        .coming-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
        .coming-grid article { min-height: 78px; border: 1px solid #343434; border-radius: 13px; background: #252525; overflow: hidden; }
        .planned-trigger { width: 100%; min-height: 78px; padding: 13px; display: flex; justify-content: space-between; align-items: flex-start; text-align: left; border: 0; border-radius: 0; background: transparent; gap: 12px; }
        .planned-trigger:hover, .planned-trigger:focus-visible { background: #303030; }
        .planned-label strong, .planned-label small { display: block; }
        .planned-label strong { font-size: .73rem; }
        .planned-label small { margin-top: 4px; color: #888; font-size: .62rem; line-height: 1.4; }
        .planned-state { white-space: nowrap; padding: 4px 7px; border-radius: 999px; background: #333; color: #aaa; font-size: .56rem; }
        .planned-details { border-top: 1px solid #393939; padding: 12px 13px; }
        .planned-details p { margin: 0 0 10px; color: #aaa; font-size: .68rem; line-height: 1.6; }
        .planned-details strong { color: #d4b989; font-size: .65rem; }
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
