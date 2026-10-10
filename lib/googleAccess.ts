import { openGoogleTokenBundle, sealGoogleTokenBundle } from './googleTokenVault';

export type GoogleTokenResult = {
  accessToken: string;
  sealedBundle: string;
  bundle: Record<string, unknown>;
  refreshed: boolean;
};

export async function getGoogleAccessToken(
  sealedBundle: string
): Promise<GoogleTokenResult> {
  const bundle = openGoogleTokenBundle(sealedBundle);
  const accessToken = String(bundle.access_token || '');
  const expiresAt = Number(bundle.expires_at || 0);

  if (accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken, sealedBundle, bundle, refreshed: false };
  }

  const refreshToken = String(bundle.refresh_token || '');
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Google connection needs to be re-authorized.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Google token refresh failed.');
  }

  const refreshed = await response.json();
  const nextBundle = {
    ...bundle,
    access_token: refreshed.access_token,
    expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    scope: refreshed.scope || bundle.scope,
    token_type: refreshed.token_type || bundle.token_type,
  };
  const nextSealed = sealGoogleTokenBundle(nextBundle);

  return {
    accessToken: String(refreshed.access_token || ''),
    sealedBundle: nextSealed,
    bundle: nextBundle,
    refreshed: true,
  };
}
