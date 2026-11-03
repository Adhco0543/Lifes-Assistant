import { createSign } from 'node:crypto';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedAccessToken = '';
let cachedTokenExpiresAt = 0;

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Firebase service account is not configured.');

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Firebase service account configuration is invalid.');
  }
  const account = value as Record<string, unknown>;
  if (
    typeof account.client_email !== 'string' ||
    !account.client_email.endsWith('.iam.gserviceaccount.com') ||
    typeof account.private_key !== 'string' ||
    !account.private_key.includes('-----BEGIN PRIVATE KEY-----') ||
    typeof account.project_id !== 'string' ||
    account.project_id !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
    throw new Error('Firebase service account configuration is invalid.');
  }
  return {
    client_email: account.client_email,
    private_key: account.private_key,
    project_id: account.project_id,
  };
}

export async function getFirestoreAccessToken(now = Math.floor(Date.now() / 1000)): Promise<string> {
  if (cachedAccessToken && cachedTokenExpiresAt - now > 60) return cachedAccessToken;

  const account = loadServiceAccount();
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const unsigned = [
    base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64Url(JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: tokenUrl,
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = unsigned + '.' + signer.sign(account.private_key, 'base64url');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not authenticate the Life Radar scheduled run.');

  const result = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof result.access_token !== 'string' || !result.access_token) {
    throw new Error('Google returned an invalid access token.');
  }
  cachedAccessToken = result.access_token;
  cachedTokenExpiresAt = now + (typeof result.expires_in === 'number' ? result.expires_in : 3600);
  return cachedAccessToken;
}
