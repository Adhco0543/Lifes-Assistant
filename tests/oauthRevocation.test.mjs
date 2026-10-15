import test from 'node:test';
import assert from 'node:assert/strict';
import { revokeOAuthConnection } from '../lib/oauthRevocation.ts';

const owner = 'account-a';
const base = {
  provider: 'google',
  authenticatedUid: owner,
  body: { sealedBundle: 'opaque-bundle' },
  openBundle: () => ({ uid: owner, access_token: 'access-value', refresh_token: 'refresh-value' }),
};

test('rejects malformed revocation input and owner mismatch', async () => {
  for (const body of [null, {}, { sealedBundle: 12 }]) {
    assert.equal((await revokeOAuthConnection({ ...base, body })).status, 400);
  }
  assert.equal((await revokeOAuthConnection({
    ...base, openBundle: () => ({ uid: 'account-b', access_token: 'value' }),
  })).status, 403);
});

test('Google revokes with refresh token when provider confirms', async () => {
  const result = await revokeOAuthConnection({
    ...base,
    fetcher: async (_url, options) => {
      assert.equal(options.body.get('token'), 'refresh-value');
      return new Response(null, { status: 200 });
    },
  });
  assert.deepEqual(result.body, { ok: true, revoked: true });
});

test('HTTP rejection, network errors and absent tokens are not success', async () => {
  for (const fetcher of [
    async () => new Response('unexpected', { status: 401 }),
    async () => { throw new Error('upstream failed'); },
  ]) {
    const result = await revokeOAuthConnection({ ...base, fetcher });
    assert.equal(result.status, 502);
    assert.equal(result.body.revoked, false);
    assert.doesNotMatch(JSON.stringify(result), /unexpected|upstream failed/);
  }
  assert.equal((await revokeOAuthConnection({
    ...base, openBundle: () => ({ uid: owner }),
  })).status, 400);
});

test('GitHub requires credentials and confirms DELETE 204', async () => {
  assert.equal((await revokeOAuthConnection({ ...base, provider: 'github' })).status, 503);
  const result = await revokeOAuthConnection({
    ...base,
    provider: 'github',
    githubClientId: 'app',
    githubClientSecret: 'configured',
    fetcher: async (_url, options) => {
      assert.equal(options.method, 'DELETE');
      assert.equal(JSON.parse(options.body).access_token, 'access-value');
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(result.body.revoked, true);
});
