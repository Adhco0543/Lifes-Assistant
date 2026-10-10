import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { createGitHubOAuthState } from '../../../../../lib/githubOAuthState';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'GitHub OAuth is not configured yet.',
        setupRequired: true,
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const repositoryAccess = body?.repositoryAccess === true;
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lifes-assistant.vercel.app';
  const redirectUri = appOrigin + '/api/integrations/github/callback';

  const state = createGitHubOAuthState({
    uid: user.uid,
    repositoryAccess,
    appOrigin,
  });

  const scopes = ['read:user', 'user:email', 'offline_access'];
  if (repositoryAccess) scopes.push('repo');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    allow_signup: 'true',
  });

  return NextResponse.json({
    url: 'https://github.com/login/oauth/authorize?' + params.toString(),
  });
}
