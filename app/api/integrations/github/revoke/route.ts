import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { openGitHubTokenBundle } from '../../../../../lib/githubTokenVault';
import { revokeOAuthConnection } from '../../../../../lib/oauthRevocation';
import { reportIntegrationFailure } from '../../../../../lib/integrationDiagnostics';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const result = await revokeOAuthConnection({
    provider: 'github',
    authenticatedUid: user.uid,
    body,
    openBundle: openGitHubTokenBundle,
    githubClientId: process.env.GITHUB_CLIENT_ID?.trim(),
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET?.trim(),
  });
  if (!result.body.ok) reportIntegrationFailure('github', 'revoke', result.status);
  return NextResponse.json(result.body, { status: result.status });
}
