import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { getGitHubAccessToken } from '../../../../../lib/githubAccess';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sealedBundle = String(body?.sealedBundle || '');
    const token = await getGitHubAccessToken(sealedBundle);

    if (String(token.bundle.uid || '') !== user.uid) {
      return NextResponse.json({ error: 'Connection owner mismatch.' }, { status: 403 });
    }

    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + token.accessToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      cache: 'no-store',
    });

    if (!profileResponse.ok) {
      return NextResponse.json(
        { ok: false, error: 'GitHub account verification failed.' },
        { status: 400 }
      );
    }

    const profile = await profileResponse.json();
    const scopeHeader = profileResponse.headers.get('x-oauth-scopes') || '';
    const scopes = scopeHeader
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      login: profile.login || '',
      name: profile.name || '',
      avatarUrl: profile.avatar_url || '',
      repositoryAccess:
        scopes.includes('repo') || token.bundle.repositoryAccess === true,
      scopes,
      sealedBundle: token.sealedBundle,
      refreshed: token.refreshed,
      checkedAt: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'GitHub connection test failed.',
      },
      { status: 400 }
    );
  }
}
