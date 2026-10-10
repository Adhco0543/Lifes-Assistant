import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { getGoogleAccessToken } from '../../../../../lib/googleAccess';

async function probe(url: string, accessToken: string): Promise<boolean> {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken },
    cache: 'no-store',
  });
  return response.ok;
}

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sealedBundle = String(body?.sealedBundle || '');
    const token = await getGoogleAccessToken(sealedBundle);

    if (String(token.bundle.uid || '') !== user.uid) {
      return NextResponse.json({ error: 'Connection owner mismatch.' }, { status: 403 });
    }

    const services = Array.isArray(token.bundle.services)
      ? token.bundle.services.map(String)
      : [];
    const checks: Record<string, boolean> = {};

    if (services.includes('drive')) {
      checks.drive = await probe(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
        token.accessToken
      );
    }
    if (services.includes('gmail')) {
      checks.gmail = await probe(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        token.accessToken
      );
    }
    if (services.includes('calendar')) {
      checks.calendar = await probe(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        token.accessToken
      );
    }
    if (services.includes('photos')) {
      checks.photos = String(token.bundle.scope || '').includes(
        'photospicker.mediaitems.readonly'
      );
    }

    return NextResponse.json({
      ok: Object.values(checks).every(Boolean),
      checks,
      sealedBundle: token.sealedBundle,
      refreshed: token.refreshed,
      checkedAt: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Google connection test failed.',
      },
      { status: 400 }
    );
  }
}
