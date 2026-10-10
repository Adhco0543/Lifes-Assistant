import {
  openGitHubTokenBundle,
  sealGitHubTokenBundle,
} from './githubTokenVault';

export type GitHubTokenResult = {
  accessToken: string;
  sealedBundle: string;
  bundle: Record<string, unknown>;
  refreshed: boolean;
};

export async function getGitHubAccessToken(
  sealedBundle: string
): Promise<GitHubTokenResult> {
  const bundle = openGitHubTokenBundle(sealedBundle);
  const accessToken = String(bundle.access_token || '');
  const expiresAt = Number(bundle.expires_at || 0);

  if (accessToken && (!expiresAt || expiresAt > Date.now() + 60_000)) {
    return { accessToken, sealedBundle, bundle, refreshed: false };
  }

  const refreshToken = String(bundle.refresh_token || '');
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('GitHub connection needs to be re-authorized.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('GitHub token refresh failed.');
  }

  const refreshed = await response.json();
  if (!refreshed.access_token) {
    throw new Error(refreshed.error_description || 'GitHub token refresh failed.');
  }

  const nextBundle = {
    ...bundle,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || refreshToken,
    expires_at: refreshed.expires_in
      ? Date.now() + Number(refreshed.expires_in) * 1000
      : 0,
    refresh_token_expires_at: refreshed.refresh_token_expires_in
      ? Date.now() + Number(refreshed.refresh_token_expires_in) * 1000
      : bundle.refresh_token_expires_at || 0,
    scope: refreshed.scope || bundle.scope || '',
    token_type: refreshed.token_type || bundle.token_type || 'bearer',
  };

  const nextSealed = sealGitHubTokenBundle(nextBundle);

  return {
    accessToken: String(refreshed.access_token),
    sealedBundle: nextSealed,
    bundle: nextBundle,
    refreshed: true,
  };
}
