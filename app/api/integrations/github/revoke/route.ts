import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { openGitHubTokenBundle } from '../../../../../lib/githubTokenVault';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bundle = openGitHubTokenBundle(String(body?.sealedBundle || ''));

    if (String(bundle.uid || '') !== user.uid) {
      return NextResponse.json({ error: 'Connection owner mismatch.' }, { status: 403 });
    }

    const accessToken = String(bundle.access_token || '');
    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';

    if (accessToken && clientId && clientSecret) {
      const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
      await fetch(
        'https://api.github.com/applications/' +
          encodeURIComponent(clientId) +
          '/token',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Basic ' + basic,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2026-03-10',
          },
          body: JSON.stringify({ access_token: accessToken }),
          cache: 'no-store',
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
