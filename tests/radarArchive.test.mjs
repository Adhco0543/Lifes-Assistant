import test from 'node:test';
import assert from 'node:assert/strict';
import { getRadarArchiveCandidates, isAllenQuoteLoop, isLegacyCodeReviewLoop } from '../lib/radarArchive.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-01T12:00:00.000Z');
function makeLoop(id, title, days, patch = {}) {
  return { id, title, createdAt: now - days * DAY, status: 'open', archived: false,
    source: 'conversation', linkedView: 'chat', userMarkedImportant: false,
    priority: 'medium', dueAt: null, ...patch };
}

test('recognizes old code and source retrieval test loops', () => {
  for (const title of ['Review the code','GitHub repository','Retrieve GitHub','Retrieve source files','Source files']) {
    assert.equal(isLegacyCodeReviewLoop({title}), true, title);
  }
  assert.equal(isLegacyCodeReviewLoop({title:'Finish quote draft for allen hendershot'}), false);
  assert.equal(isAllenQuoteLoop({title:'Finish quote draft for allen hendershot'}), true);
});

test('targeted cleanup excludes valuable work and already archived loops', () => {
  const loops = [
    makeLoop('test','Review the code',19),
    makeLoop('fresh','Review the code',2),
    makeLoop('quote','Finish quote draft for allen hendershot',35,{source:'workspace-draft',linkedView:'quotes',priority:'high'}),
    makeLoop('pinned','GitHub repository',25,{userMarkedImportant:true}),
    makeLoop('archived','Retrieve source files',20,{archived:true}),
    makeLoop('task','Call important client',25,{source:'workspace-task'}),
  ];
  assert.deepEqual(getRadarArchiveCandidates(loops, 'code-review', 14, now).map(x=>x.id), ['test']);
});

test('age-based cleanup is reversible selection and protects urgent, quotes and pinned', () => {
  const loops = [makeLoop('old','Old conversation note',45),
    makeLoop('high','Urgent item',45,{priority:'high'}),
    makeLoop('allen','Review quote for Allen Hendershot',35),
    makeLoop('due','Payment due tomorrow',35,{dueAt:now + DAY}),
    makeLoop('new','Recent note',5)];
  assert.deepEqual(getRadarArchiveCandidates(loops, 'older', 30, now).map(x=>x.id), ['old']);
  assert.deepEqual(getRadarArchiveCandidates(loops, 'older', 0, now), []);
});
