import test from 'node:test';
import assert from 'node:assert/strict';
import { localNoonFromDateKey, syncWorkspaceRadar } from '../lib/workspaceRadar.ts';

test('Life Radar due dates resolve to noon in the configured time zone across DST', () => {
  assert.equal(
    new Date(localNoonFromDateKey('2026-03-08', 'America/New_York')).toISOString(),
    '2026-03-08T16:00:00.000Z'
  );
  assert.equal(
    new Date(localNoonFromDateKey('2026-11-01', 'America/New_York')).toISOString(),
    '2026-11-01T17:00:00.000Z'
  );
});

test('scheduled workspace sync surfaces overdue tasks and is idempotent on a repeated run', async () => {
  const loops = [];
  const store = {
    async getRecentBusinessRecords() {
      return [{
        id: 'task-1',
        kind: 'task',
        data: { title: 'Review overdue follow-up', dueDate: '2000-01-01', status: 'open' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }];
    },
    async getLatestDraft() {
      return null;
    },
    async createOpenLoop(loop) {
      const id = 'loop-' + (loops.length + 1);
      loops.push({ ...loop, id, createdAt: Date.now(), updatedAt: Date.now() });
      return id;
    },
    async updateOpenLoop(id, patch) {
      const index = loops.findIndex((loop) => loop.id === id);
      loops[index] = { ...loops[index], ...patch };
    },
    async resolveOpenLoop(id) {
      const loop = loops.find((item) => item.id === id);
      if (loop) loop.status = 'resolved';
    },
  };

  assert.equal(await syncWorkspaceRadar(loops, store, 'UTC'), 1);
  assert.match(loops[0].title, /^Overdue:/);
  assert.equal(await syncWorkspaceRadar(loops, store, 'UTC'), 0);
  assert.equal(loops.length, 1);
});
