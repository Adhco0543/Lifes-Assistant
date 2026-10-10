import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { createGoogleOAuthState } from '../../../../../lib/googleOAuthState';

const SERVICE_SCOPES: Record<string, string> = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  photos: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
};

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'Google OAuth is not configured yet.',
        setupRequired: true,
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body?.services) ? body.services : [];
  const services = requested
    .map((value: unknown) => String(value))
    .filter((value: string) => Boolean(SERVICE_SCOPES[value]));

  if (!services.length) {
    return NextResponse.json(
      { error: 'Select at least one Google service.' },
      { status: 400 }
    );
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lifes-assistant.vercel.app';
  const redirectUri = appOrigin + '/api/integrations/google/callback';

  const state = createGoogleOAuthState({
    uid: user.uid,
    services,
    appOrigin,
  });

  const scopes = [
    'openid',
    'email',
    'profile',
    ...services.map((service: string) => SERVICE_SCOPES[service]),
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return NextResponse.json({
    url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
  });
}
