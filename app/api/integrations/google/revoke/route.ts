import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { openGoogleTokenBundle } from '../../../../../lib/googleTokenVault';
import { revokeOAuthConnection } from '../../../../../lib/oauthRevocation';
import { reportIntegrationFailure } from '../../../../../lib/integrationDiagnostics';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const result = await revokeOAuthConnection({
    provider: 'google',
    authenticatedUid: user.uid,
    body,
    openBundle: openGoogleTokenBundle,
  });
  if (!result.body.ok) reportIntegrationFailure('google', 'revoke', result.status);
  return NextResponse.json(result.body, { status: result.status });
}
