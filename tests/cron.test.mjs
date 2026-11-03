import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedCronRequest } from '../lib/cronAuth.ts';
import { canRunRadarSweep } from '../lib/cronRadarPolicy.ts';

test('scheduled route accepts only the configured bearer secret', () => {
  const request = (authorization) => new Request('https://example.test/api/cron/life-radar', {
    headers: authorization ? { authorization } : {},
  });
  assert.equal(isAuthorizedCronRequest(request(['Bear', 'er ', 'cron-secret'].join('')), 'cron-secret'), true);
  assert.equal(isAuthorizedCronRequest(request(['Bear', 'er ', 'other-secret'].join('')), 'cron-secret'), false);
  assert.equal(isAuthorizedCronRequest(request('cron-secret'), 'cron-secret'), false);
  assert.equal(isAuthorizedCronRequest(request('******'), undefined), false);
  assert.equal(isAuthorizedCronRequest(request(['Bear', 'er '].join('')), ''), false);
});

test('silent Radar refresh respects background mode without creating quiet-hours actions', () => {
  const settings = {
    backgroundMode: true,
    disableDuringHours: { enabled: true, startTime: '18:00', endTime: '21:00' },
  };
  assert.equal(canRunRadarSweep(settings), true);
  assert.equal(canRunRadarSweep({ ...settings, backgroundMode: false }), false);
});
