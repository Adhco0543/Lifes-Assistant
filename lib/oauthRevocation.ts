export type OAuthProvider = 'google' | 'github';

export type RevocationResult = {
  status: number;
  body: { ok: boolean; revoked: boolean; error?: string };
};

type TokenBundle = Record<string, unknown>;

type RevocationOptions = {
  provider: OAuthProvider;
  authenticatedUid: string;
  body: unknown;
  openBundle: (sealedBundle: string) => TokenBundle;
  fetcher?: typeof fetch;
  githubClientId?: string;
  githubClientSecret?: string;
};

const failure = (status: number, error: string): RevocationResult => ({
  status,
  body: { ok: false, revoked: false, error },
});

/**
 * Only a confirmed provider success is reported as revoked. Never return secrets
 * or upstream response bodies, including on malformed input and network failures.
 */
export async function revokeOAuthConnection({
  provider,
  authenticatedUid,
  body,
  openBundle,
  fetcher = fetch,
  githubClientId = '',
  githubClientSecret = '',
}: RevocationOptions): Promise<RevocationResult> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return failure(400, 'Invalid revocation request.');
  }

  const rawSealed = (body as Record<string, unknown>).sealedBundle;
  if (typeof rawSealed !== 'string' || !rawSealed || rawSealed.length > 20_000) {
    return failure(400, 'Missing or invalid connection.');
  }

  let bundle: TokenBundle;
  try {
    bundle = openBundle(rawSealed);
  } catch {
    return failure(400, 'Invalid connection.');
  }

  if (!bundle || typeof bundle !== 'object' || bundle.uid !== authenticatedUid) {
    return failure(403, 'Connection owner mismatch.');
  }

  const token = provider === 'google'
    ? (bundle.refresh_token || bundle.access_token)
    : bundle.access_token;

  if (typeof token !== 'string' || !token.trim()) {
    return failure(400, 'Connection has no revocable token.');
  }

  if (provider === 'github' && (!githubClientId || !githubClientSecret)) {
    return failure(503, 'GitHub revocation is not configured.');
  }

  try {
    const response = provider === 'google'
      ? await fetcher('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
          cache: 'no-store',
        })
      : await fetcher(
          'https://api.github.com/applications/' +
            encodeURIComponent(githubClientId) + '/token',
          {
            method: 'DELETE',
            headers: {
              Authorization: 'Basic ' +
                Buffer.from(githubClientId + ':' + githubClientSecret).toString('base64'),
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2026-03-10',
            },
            body: JSON.stringify({ access_token: token }),
            cache: 'no-store',
          }
        );

    if (!response.ok) {
      return failure(502, 'The provider did not confirm disconnection. Try again.');
    }
    return { status: 200, body: { ok: true, revoked: true } };
  } catch {
    return failure(502, 'Could not contact the provider. Try again.');
  }
}
