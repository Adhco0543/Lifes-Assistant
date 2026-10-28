import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmailSendRequest, parseEmailProviderId } from '../lib/emailApiContracts.ts';
import { parseFirebaseLookupUser } from '../lib/serverAuth.ts';
import { parseTranscriptionResult } from '../lib/transcriptionContracts.ts';
import { parseRadarApiResponse } from '../lib/radarApiContracts.ts';

test('email endpoint contract accepts bounded payloads and rejects malformed input', () => {
  const valid = validateEmailSendRequest({
    to: ' user@example.com ',
    subject: ' Estimate ',
    text: 'The estimate is ready.',
  });
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.deepEqual(valid.body, {
      to: 'user@example.com',
      subject: 'Estimate',
      text: 'The estimate is ready.',
    });
  }

  for (const value of [null, [], { to: 'bad', subject: 'Hi', text: 'Body' },
    { to: 'user@example.com', subject: '', text: 'Body' },
    { to: 'user@example.com', subject: 'Hi\nBcc: victim@example.com', text: 'Body' },
    { to: 'user@example.com', subject: 'x'.repeat(201), text: 'Body' },
    { to: 'user@example.com', subject: 'Hi', text: 'x'.repeat(20_001) }]) {
    assert.equal(validateEmailSendRequest(value).valid, false);
  }
});

test('provider response parsers only return bounded known fields', () => {
  assert.equal(parseEmailProviderId({ id: 'msg_123' }), 'msg_123');
  assert.equal(parseEmailProviderId({ id: 'x'.repeat(201) }), null);
  assert.equal(parseEmailProviderId({ message: 'secret provider detail' }), null);
  assert.deepEqual(parseTranscriptionResult({ text: 'Hello there.' }), { text: 'Hello there.' });
  for (const value of [null, [], { text: '' }, { text: 42 }, { text: 'x'.repeat(500_001) }]) {
    assert.equal(parseTranscriptionResult(value), null);
  }
});

test('Firebase lookup accepts only a well-shaped authenticated user', () => {
  assert.deepEqual(parseFirebaseLookupUser({
    users: [{ localId: 'user_123', email: 'user@example.com', displayName: 'Teejay' }],
  }), { uid: 'user_123', email: 'user@example.com', displayName: 'Teejay' });
  for (const value of [null, [], {}, { users: [] }, { users: [{ localId: '' }] },
    { users: [{ localId: 'x'.repeat(257) }] }]) {
    assert.equal(parseFirebaseLookupUser(value), null);
  }
});

test('Life Radar client response parser filters malformed loops and rejects bad roots', () => {
  assert.throws(() => parseRadarApiResponse(null), /Invalid Life Radar response/);
  assert.throws(() => parseRadarApiResponse({ openLoops: {} }), /Invalid Life Radar response/);
  assert.deepEqual(parseRadarApiResponse({
    openLoops: [
      { title: 'Call supplier', status: 'waiting', priority: 'medium', dueDate: '2026-10-30' },
      { title: 'Broken', status: 'unknown', priority: 'high' },
      null,
    ],
    resolveLoopIds: ['loop-1', {}, 'x'.repeat(121)],
  }), {
    openLoops: [{ title: 'Call supplier', status: 'waiting', priority: 'medium', dueDate: '2026-10-30' }],
    resolveLoopIds: ['loop-1'],
  });
});
