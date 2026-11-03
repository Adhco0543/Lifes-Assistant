import test from 'node:test';
import assert from 'node:assert/strict';
import { clientNameFromRadarTitle } from '../lib/radarHandoff.ts';

test('client names are read from Radar titles, including lowercase ones', () => {
  assert.equal(clientNameFromRadarTitle('Finish quote draft for allen hendershot'), 'Allen Hendershot');
  assert.equal(clientNameFromRadarTitle('Follow up with Maria Lopez'), 'Maria Lopez');
  assert.equal(clientNameFromRadarTitle('Review stale quote: Allen Hendershot'), '');
  assert.equal(clientNameFromRadarTitle('Finish your quote draft'), '');
});
