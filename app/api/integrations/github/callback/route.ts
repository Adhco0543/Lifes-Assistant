import { readGitHubOAuthState } from '../../../../../lib/githubOAuthState';
import { sealGitHubTokenBundle } from '../../../../../lib/githubTokenVault';

function popupResponse(
  origin: string,
  payload: Record<string, unknown>,
  status = 200
): Response {
  const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin);

  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><title>Life\'s Assistant</title></head>' +
      '<body style="font-family:system-ui;background:#202020;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0">' +
      '<div style="text-align:center"><strong>Life\'s Assistant</strong><p style="color:#888">Finishing GitHub connection…</p></div>' +
      '<script>try{if(window.opener){window.opener.postMessage(' +
      safePayload +
      ',' +
      safeOrigin +
      ');window.close();}}catch(e){}<\/script></body></html>',
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const stateText = url.searchParams.get('state') || '';
  const providerError = url.searchParams.get('error') || '';

  let origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lifes-assistant.vercel.app';

  try {
    const state = readGitHubOAuthState(stateText);
    origin = state.appOrigin;

    if (providerError) {
      return popupResponse(origin, {
        type: 'life-assistant-github-oauth',
        ok: false,
        error: providerError,
      });
    }

    if (!code) throw new Error('GitHub did not return an authorization code.');

    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth is not configured.');
    }

    const redirectUri = origin + '/api/integrations/github/callback';
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
        cache: 'no-store',
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('GitHub token exchange failed.');
    }

    const tokens = await tokenResponse.json();
    const accessToken = String(tokens.access_token || '');
    if (!accessToken) {
      throw new Error(
        tokens.error_description || 'GitHub did not return an access token.'
      );
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      cache: 'no-store',
    });

    if (!userResponse.ok) {
      throw new Error('GitHub account lookup failed.');
    }

    const profile = await userResponse.json();
    const scope = String(tokens.scope || '');

    const sealedBundle = sealGitHubTokenBundle({
      uid: state.uid,
      access_token: accessToken,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expires_in
        ? Date.now() + Number(tokens.expires_in) * 1000
        : 0,
      refresh_token_expires_at: tokens.refresh_token_expires_in
        ? Date.now() + Number(tokens.refresh_token_expires_in) * 1000
        : 0,
      scope,
      token_type: tokens.token_type || 'bearer',
      repositoryAccess: state.repositoryAccess,
      githubLogin: profile.login || '',
      githubUserId: profile.id || null,
    });

    return popupResponse(origin, {
      type: 'life-assistant-github-oauth',
      ok: true,
      provider: 'github',
      login: profile.login || '',
      name: profile.name || '',
      avatarUrl: profile.avatar_url || '',
      repositoryAccess: state.repositoryAccess,
      scope,
      sealedBundle,
      connectedAt: Date.now(),
    });
  } catch (error) {
    return popupResponse(origin, {
      type: 'life-assistant-github-oauth',
      ok: false,
      error:
        error instanceof Error ? error.message : 'GitHub connection failed.',
    });
  }
}
