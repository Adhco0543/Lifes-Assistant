import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { openGoogleTokenBundle } from '../../../../../lib/googleTokenVault';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bundle = openGoogleTokenBundle(String(body?.sealedBundle || ''));

    if (String(bundle.uid || '') !== user.uid) {
      return NextResponse.json({ error: 'Connection owner mismatch.' }, { status: 403 });
    }

    const token = String(bundle.refresh_token || bundle.access_token || '');
    if (token) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        cache: 'no-store',
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
