import test from 'node:test';
import assert from 'node:assert/strict';
import { toAutonomyDraft, toAutonomySettings, describeAutonomyDraft } from '../lib/autonomyDraft.ts';

const base = {
  emailBehavior: 'ask',
  emailCategories: { customer: 'ask', followup: 'auto_draft', invoice: 'ask' },
  requiresApprovalForTasks: ['email', 'quote'],
  requireConfirmationForLargeAmounts: 10000,
  dailyExecutionLimit: 50,
  disableDuringHours: { enabled: false },
};

test('defaults round-trip into the form and back', () => {
  const draft = toAutonomyDraft(base);
  assert.equal(draft.emailMode, 'ask');
  assert.equal(draft.confirmOver, '10000');
  assert.equal(draft.quietEnabled, false);
  const patch = toAutonomySettings(draft, base);
  assert.equal(patch.emailBehavior, 'ask');
  assert.deepEqual([...patch.requiresApprovalForTasks].sort(), ['email', 'quote']);
  assert.deepEqual(patch.emailCategories, { customer: 'ask', followup: 'ask', invoice: 'ask' });
});

test('turning on auto-send removes email from the always-ask list, and turning it off puts it back', () => {
  const draft = { ...toAutonomyDraft(base), emailMode: 'auto_send', categories: { customer: 'ask', followup: 'auto_send', invoice: 'ask' } };
  const patch = toAutonomySettings(draft, base);
  assert.equal(patch.emailBehavior, 'auto_send');
  assert.deepEqual(patch.requiresApprovalForTasks, ['quote']);
  assert.equal(patch.emailCategories.followup, 'auto_send');

  const back = toAutonomySettings({ ...draft, emailMode: 'draft_only' }, { ...base, requiresApprovalForTasks: ['quote'] });
  assert.deepEqual([...back.requiresApprovalForTasks].sort(), ['email', 'quote']);
});

test('numbers are clamped and quiet hours are kept', () => {
  const draft = { ...toAutonomyDraft(base), confirmOver: '-5', dailyLimit: 'abc', quietEnabled: true, quietStart: '21:00', quietEnd: '06:30' };
  const patch = toAutonomySettings(draft, base);
  assert.equal(patch.requireConfirmationForLargeAmounts, 0);
  assert.equal(patch.dailyExecutionLimit, 0);
  assert.deepEqual(patch.disableDuringHours, { enabled: true, startTime: '21:00', endTime: '06:30' });
  const lines = describeAutonomyDraft(draft);
  assert.ok(lines.some((line) => line.includes('9:00 PM') && line.includes('6:30 AM')));
  assert.ok(lines.some((line) => line.includes('No daily cap')));
});
