import { readGoogleOAuthState } from '../../../../../lib/googleOAuthState';
import { sealGoogleTokenBundle } from '../../../../../lib/googleTokenVault';

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
      '<div style="text-align:center"><strong>Life\'s Assistant</strong><p style="color:#888">Finishing connection…</p></div>' +
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
    const state = readGoogleOAuthState(stateText);
    origin = state.appOrigin;

    if (providerError) {
      return popupResponse(origin, {
        type: 'life-assistant-google-oauth',
        ok: false,
        error: providerError,
      });
    }

    if (!code) {
      throw new Error('Google did not return an authorization code.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth is not configured.');
    }

    const redirectUri = origin + '/api/integrations/google/callback';

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });

    if (!tokenResponse.ok) {
      throw new Error('Google token exchange failed.');
    }

    const tokens = await tokenResponse.json();
    const accessToken = String(tokens.access_token || '');
    if (!accessToken) {
      throw new Error('Google did not return an access token.');
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: 'Bearer ' + accessToken },
        cache: 'no-store',
      }
    );
    const profile = profileResponse.ok ? await profileResponse.json() : {};

    const sealedBundle = sealGoogleTokenBundle({
      uid: state.uid,
      access_token: accessToken,
      refresh_token: tokens.refresh_token || null,
      expires_at: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      scope: tokens.scope || '',
      token_type: tokens.token_type || 'Bearer',
      services: state.services,
    });

    return popupResponse(origin, {
      type: 'life-assistant-google-oauth',
      ok: true,
      provider: 'google',
      email: profile.email || '',
      name: profile.name || '',
      services: state.services,
      scope: tokens.scope || '',
      sealedBundle,
      connectedAt: Date.now(),
    });
  } catch (error) {
    return popupResponse(origin, {
      type: 'life-assistant-google-oauth',
      ok: false,
      error: error instanceof Error ? error.message : 'Google connection failed.',
    });
  }
}
