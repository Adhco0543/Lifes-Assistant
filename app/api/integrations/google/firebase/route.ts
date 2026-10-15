import { NextResponse } from 'next/server';
import { reportIntegrationFailure } from '../../../../../lib/integrationDiagnostics';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { sealGoogleTokenBundle } from '../../../../../lib/googleTokenVault';

type GoogleService = 'drive' | 'gmail' | 'calendar' | 'photos';

const SERVICE_SCOPES: Record<GoogleService, string> = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  photos: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
};

function sanitizeServices(value: unknown): GoogleService[] {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<GoogleService>([
    'drive',
    'gmail',
    'calendar',
    'photos',
  ]);

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '') as GoogleService)
        .filter((item) => allowed.has(item))
    )
  );
}

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const accessToken = String(body?.accessToken || '').trim();
    const services = sanitizeServices(body?.services);

    if (!accessToken) {
      return NextResponse.json({ error: 'Google access token is missing.' }, { status: 400 });
    }

    if (!services.length) {
      return NextResponse.json({ error: 'Select at least one Google service.' }, { status: 400 });
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: 'Bearer ' + accessToken },
        cache: 'no-store',
      }
    );

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: 'Google authorization could not be verified.' },
        { status: 400 }
      );
    }

    const profile = await profileResponse.json();
    const scope = services.map((service) => SERVICE_SCOPES[service]).join(' ');

    const bundle = {
      uid: user.uid,
      source: 'firebase-google',
      access_token: accessToken,
      expires_at: Date.now() + 50 * 60 * 1000,
      token_type: 'Bearer',
      scope,
      services,
      email: String(profile.email || ''),
      name: String(profile.name || ''),
      google_user_id: String(profile.sub || ''),
      picture: String(profile.picture || ''),
      connected_at: Date.now(),
    };

    return NextResponse.json({
      ok: true,
      sealedBundle: sealGoogleTokenBundle(bundle),
      email: bundle.email,
      name: bundle.name,
      services,
      scope,
      connectedAt: bundle.connected_at,
      reconnectRequiredAfter: bundle.expires_at,
      mode: 'firebase',
    });
  } catch {
    reportIntegrationFailure('google', 'request');
    return NextResponse.json(
      { ok: false, error: 'Google connection could not be completed. Please retry.' },
      { status: 400 }
    );
  }
}
