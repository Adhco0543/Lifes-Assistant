import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLifeProfileDocument, getVisibleTools, modeConfig, normalizeLifePreferences, scoreRadarItem, MODE_TOOL_ORDER, suggestedRadarView } from '../lib/lifePreferences.ts';

test('normalizes saved mode, slips, capture preference, and tool overrides', () => {
  const profile = normalizeLifePreferences({
    mode: 'business',
    primary_slips: ['quotes', 'bad-value', 'quotes'],
    capture_pref: 'voice',
    tool_overrides: { pinned: ['quotes', 'invalid'], hidden: ['email'] },
  });
  assert.equal(profile.mode, 'business');
  assert.deepEqual(profile.primary_slips, ['quotes']);
  assert.equal(profile.capture_pref, 'voice');
  assert.deepEqual(profile.tool_overrides, { pinned: ['quotes'], hidden: ['email'] });
});

test('normalizes slips to the onboarding selection rules', () => {
  assert.deepEqual(normalizeLifePreferences({ primary_slips: ['followups', 'quotes', 'projects', 'appointments'] }).primary_slips, ['followups', 'quotes', 'projects']);
  assert.deepEqual(normalizeLifePreferences({ primary_slips: ['quotes', 'unsure'] }).primary_slips, ['unsure']);
});

test('builds the exact persisted user profile shape and preserves its completion timestamp', () => {
  const profile = buildLifeProfileDocument({
    mode: 'everyday', primary_slips: ['followups'], capture_pref: null,
    tool_overrides: { pinned: [], hidden: [] }, internal_note: 'must not persist',
  }, {}, '2026-10-29T12:00:00.000Z');
  assert.deepEqual(profile, {
    mode: 'everyday',
    primary_slips: ['followups'],
    capture_pref: null,
    onboarding_completed_at: '2026-10-29T12:00:00.000Z',
    tool_overrides: { pinned: [], hidden: [] },
  });
  assert.deepEqual(Object.keys(profile), ['mode', 'primary_slips', 'capture_pref', 'onboarding_completed_at', 'tool_overrides']);

  const updated = buildLifeProfileDocument({ mode: 'business' }, profile, '2027-01-01T00:00:00.000Z');
  assert.equal(updated.onboarding_completed_at, profile.onboarding_completed_at);
  assert.equal(updated.capture_pref, null);
});

test('mode ranking favors the selected kind of work and includes age and next action', () => {
  const now = 2_000_000_000;
  const quote = { title: 'Review quote', linkedView: 'quotes', priority: 'medium', status: 'waiting', createdAt: now - 10 * 86400000, updatedAt: now - 3 * 86400000, nextAction: 'Call client' };
  const everyday = normalizeLifePreferences({ mode: 'everyday', primary_slips: ['appointments'] });
  const business = normalizeLifePreferences({ mode: 'business', primary_slips: ['quotes'] });
  assert.ok(scoreRadarItem(quote, business, now) > scoreRadarItem(quote, everyday, now));
  assert.ok(scoreRadarItem(quote, business, now) > scoreRadarItem({ ...quote, nextAction: '' }, business, now));
});

test('mode tool order keeps the core first and changes business tool prominence', () => {
  assert.deepEqual(MODE_TOOL_ORDER.everyday.slice(0, 7), ['radar', 'chat', 'tasks', 'people', 'memory', 'brief', 'search']);
  assert.ok(MODE_TOOL_ORDER.business.indexOf('quotes') < MODE_TOOL_ORDER.everyday.indexOf('quotes'));
});

test('mode config drives prompts, radar weights, and pinned tool ordering', () => {
  assert.equal(modeConfig.everyday.radarWeights.quote, 0.7);
  assert.ok(modeConfig.business.examplePrompts[0].includes('quote'));
  const profile = normalizeLifePreferences({ mode: 'everyday', tool_overrides: { pinned: ['quotes'], hidden: ['email'] } });
  const tools = getVisibleTools(profile, [{ id: 'email' }, { id: 'quotes' }, { id: 'radar' }, { id: 'chat' }]);
  assert.deepEqual(tools.map((tool) => tool.id), ['quotes', 'radar', 'chat']);
});

test('routes radar items to their most relevant tool when no saved destination exists', () => {
  assert.equal(suggestedRadarView({ title: 'Send quote to client' }), 'quotes');
  assert.equal(suggestedRadarView({ title: 'Follow up with client by email' }), 'email');
  assert.equal(suggestedRadarView({ title: 'Plan project steps' }), 'projects');
  assert.equal(suggestedRadarView({ title: 'Renew car registration' }), 'tasks');
  assert.equal(suggestedRadarView({ title: 'Anything', linkedView: 'people' }), 'people');
});
