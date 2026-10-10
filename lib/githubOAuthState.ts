import crypto from 'node:crypto';

export type GitHubOAuthState = {
  uid: string;
  repositoryAccess: boolean;
  appOrigin: string;
  issuedAt: number;
  nonce: string;
};

function stateSecret(): string {
  const value = process.env.INTEGRATION_STATE_SECRET?.trim();
  if (!value) throw new Error('Integration state signing is not configured.');
  return value;
}

export function createGitHubOAuthState(input: {
  uid: string;
  repositoryAccess: boolean;
  appOrigin: string;
}): string {
  const payload: GitHubOAuthState = {
    ...input,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(18).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', stateSecret())
    .update(encoded)
    .digest('base64url');

  return encoded + '.' + signature;
}

export function readGitHubOAuthState(state: string): GitHubOAuthState {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) throw new Error('Invalid OAuth state.');

  const expected = crypto
    .createHmac('sha256', stateSecret())
    .update(encoded)
    .digest('base64url');

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('Invalid OAuth state signature.');
  }

  const payload = JSON.parse(
    Buffer.from(encoded, 'base64url').toString('utf8')
  ) as GitHubOAuthState;

  if (
    !payload.uid ||
    !payload.appOrigin ||
    Date.now() - Number(payload.issuedAt || 0) > 10 * 60 * 1000
  ) {
    throw new Error('OAuth state expired or incomplete.');
  }

  return payload;
}
