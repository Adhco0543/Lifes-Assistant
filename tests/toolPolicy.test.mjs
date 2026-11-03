import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, isWithinQuietHours, localMinutesFor, parseClock } from '../lib/tools/policy.ts';

const noon = 12 * 60;
const base = { executedToday: 0, localMinutes: noon };

test('reads are always allowed and never count against limits', () => {
  const result = decide({ dailyExecutionLimit: 1 }, { ...base, actionClass: 'read', executedToday: 50 });
  assert.equal(result.decision, 'allow');
  assert.equal(result.code, 'read_only');
});

test('workspace writes and drafts are allowed without approval', () => {
  assert.equal(decide({}, { ...base, actionClass: 'workspace' }).decision, 'allow');
  assert.equal(decide({}, { ...base, actionClass: 'draft', taskType: 'email' }).decision, 'allow');
});

test('daily execution limit blocks every write once reached', () => {
  const settings = { dailyExecutionLimit: 10 };
  assert.equal(decide(settings, { ...base, actionClass: 'workspace', executedToday: 9 }).decision, 'allow');
  const blocked = decide(settings, { ...base, actionClass: 'workspace', executedToday: 10 });
  assert.equal(blocked.decision, 'blocked');
  assert.equal(blocked.code, 'daily_limit');
  assert.match(blocked.reason, /10/);
});

test('email defaults to asking first', () => {
  const result = decide({}, { ...base, actionClass: 'external', taskType: 'email', recipient: 'a@b.com' });
  assert.equal(result.decision, 'approval_required');
  assert.equal(result.code, 'email_ask');
});

test('email auto_send is honored, per category first', () => {
  const settings = { emailBehavior: 'ask', emailCategories: { followup: 'auto_send', customer: 'ask' } };
  assert.equal(decide(settings, { ...base, actionClass: 'external', taskType: 'email', emailCategory: 'followup' }).decision, 'allow');
  assert.equal(decide(settings, { ...base, actionClass: 'external', taskType: 'email', emailCategory: 'customer' }).decision, 'approval_required');
  assert.equal(decide({ emailBehavior: 'auto_send' }, { ...base, actionClass: 'external', taskType: 'email' }).decision, 'allow');
});

test('draft_only email behavior waits for approval', () => {
  const result = decide({ emailBehavior: 'draft_only' }, { ...base, actionClass: 'external', taskType: 'email' });
  assert.equal(result.decision, 'approval_required');
  assert.equal(result.code, 'email_draft');
});

test('requiresApprovalForTasks overrides auto_send', () => {
  const settings = { emailBehavior: 'auto_send', requiresApprovalForTasks: ['email'] };
  const result = decide(settings, { ...base, actionClass: 'external', taskType: 'email' });
  assert.equal(result.decision, 'approval_required');
  assert.equal(result.code, 'requires_approval_list');
});

test('large amounts always ask, even with auto_send', () => {
  const settings = { emailBehavior: 'auto_send', requireConfirmationForLargeAmounts: 500 };
  assert.equal(decide(settings, { ...base, actionClass: 'external', taskType: 'email', amount: 499 }).decision, 'allow');
  const result = decide(settings, { ...base, actionClass: 'external', taskType: 'email', amount: 501 });
  assert.equal(result.decision, 'approval_required');
  assert.equal(result.code, 'large_amount');
});

test('trusted recipients can be auto-approved when enabled', () => {
  const settings = { emailBehavior: 'ask', autoApproveTrustedCustomers: true, trustedCustomers: ['allen@example.com'] };
  assert.equal(decide(settings, { ...base, actionClass: 'external', taskType: 'email', recipient: 'Allen@Example.com' }).code, 'trusted_recipient');
  assert.equal(decide(settings, { ...base, actionClass: 'external', taskType: 'email', recipient: 'stranger@example.com' }).decision, 'approval_required');
  assert.equal(decide({ ...settings, autoApproveTrustedCustomers: false }, { ...base, actionClass: 'external', taskType: 'email', recipient: 'allen@example.com' }).decision, 'approval_required');
});

test('quiet hours handle overnight windows and only gate external actions', () => {
  const settings = { emailBehavior: 'auto_send', disableDuringHours: { enabled: true, startTime: '18:00', endTime: '08:00' } };
  assert.equal(isWithinQuietHours(settings, 19 * 60), true);
  assert.equal(isWithinQuietHours(settings, 2 * 60), true);
  assert.equal(isWithinQuietHours(settings, 12 * 60), false);
  assert.equal(isWithinQuietHours({ disableDuringHours: { enabled: false, startTime: '18:00', endTime: '08:00' } }, 19 * 60), false);

  const night = { ...base, localMinutes: 22 * 60 };
  assert.equal(decide(settings, { ...night, actionClass: 'external', taskType: 'email' }).code, 'quiet_hours');
  assert.equal(decide(settings, { ...night, actionClass: 'workspace' }).decision, 'allow');
});

test('background runs never send on their own', () => {
  const result = decide({ emailBehavior: 'auto_send' }, { ...base, actionClass: 'external', taskType: 'email', background: true });
  assert.equal(result.decision, 'approval_required');
  assert.equal(result.code, 'background_draft_only');
});

test('clock parsing and local minutes are robust', () => {
  assert.equal(parseClock('18:00'), 18 * 60);
  assert.equal(parseClock('8:05'), 8 * 60 + 5);
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock(undefined), null);
  const minutes = localMinutesFor(new Date('2026-11-03T15:30:00Z'), 'America/New_York');
  assert.equal(minutes, 10 * 60 + 30);
  assert.equal(typeof localMinutesFor(new Date(), 'Not/AZone'), 'number');
});
