import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_INDEX, cleanToolArgs, toolsForResponsesApi } from '../lib/tools/registry.ts';

test('every tool has a strict schema with all properties required', () => {
  for (const tool of TOOLS) {
    assert.ok(tool.name && tool.description && tool.receiptLabel, tool.name);
    assert.equal(tool.parameters.additionalProperties, false, tool.name);
    const properties = Object.keys(tool.parameters.properties || {});
    assert.deepEqual(tool.parameters.required, properties, tool.name + ' must list every property as required for strict mode');
  }
  const names = TOOLS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length, 'tool names are unique');
});

test('external tools carry a task type so autonomy settings can gate them', () => {
  for (const tool of TOOLS.filter((item) => item.actionClass === 'external')) {
    assert.ok(tool.taskType, tool.name);
  }
  assert.equal(TOOL_INDEX.send_email.actionClass, 'external');
  assert.equal(TOOL_INDEX.draft_email.actionClass, 'draft');
  assert.equal(TOOL_INDEX.create_task.actionClass, 'workspace');
  assert.equal(TOOL_INDEX.list_open_items.actionClass, 'read');
});

test('responses API tool shape', () => {
  const tools = toolsForResponsesApi();
  assert.equal(tools.length, TOOLS.length);
  for (const tool of tools) {
    assert.equal(tool.type, 'function');
    assert.equal(tool.strict, true);
    assert.ok(tool.parameters);
  }
});

test('create_task cleaning', () => {
  const ok = cleanToolArgs('create_task', { title: '  Call   Allen ', dueDate: '2026-11-05', priority: 'high', projectName: null, notes: null });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.args, { title: 'Call Allen', dueDate: '2026-11-05', priority: 'high', projectName: null, notes: null });

  const badDate = cleanToolArgs('create_task', { title: 'x', dueDate: 'tomorrow', priority: 'urgent' });
  assert.equal(badDate.ok, true);
  assert.equal(badDate.args.dueDate, null, 'non-ISO dates are dropped rather than guessed');
  assert.equal(badDate.args.priority, 'medium');

  assert.equal(cleanToolArgs('create_task', { title: '   ' }).ok, false);
});

test('send_email requires a real address; draft_email does not', () => {
  assert.equal(cleanToolArgs('send_email', { to: 'Allen', subject: 'Hi', body: 'Body', category: 'customer' }).ok, false);
  const ok = cleanToolArgs('send_email', { to: 'allen@example.com', subject: 'Quote', body: 'Body', category: 'invoice', amount: '1250.5' });
  assert.equal(ok.ok, true);
  assert.equal(ok.args.amount, 1250.5);
  assert.equal(cleanToolArgs('draft_email', { to: null, subject: 'Quote', body: 'Body', category: 'nonsense' }).args.category, 'other');
});

test('draft_quote keeps amounts exactly and refuses quotes without priced items', () => {
  const ok = cleanToolArgs('draft_quote', {
    clientName: 'Allen Hendershot',
    projectDescription: 'Porch rebuild',
    items: [
      { description: 'Labor', price: 1800, quantity: 1 },
      { description: 'Decking boards', price: 42.5, quantity: 20 },
      { description: 'No price here', price: null, quantity: 1 },
    ],
    notes: null,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.args.items.length, 2, 'items without a price are dropped, never invented');
  assert.equal(ok.args.total, 2650);

  assert.equal(cleanToolArgs('draft_quote', { clientName: 'Allen', projectDescription: 'x', items: [] }).ok, false);
});

test('radar tools clamp snooze days and require ids', () => {
  assert.equal(cleanToolArgs('snooze_radar_item', { openLoopId: 'abc', days: 99 }).args.days, 30);
  assert.equal(cleanToolArgs('snooze_radar_item', { openLoopId: 'abc', days: 0 }).args.days, 1);
  assert.equal(cleanToolArgs('snooze_radar_item', { openLoopId: '', days: 2 }).ok, false);
  assert.equal(cleanToolArgs('resolve_radar_item', {}).ok, false);
});

test('unknown tools are rejected', () => {
  assert.equal(cleanToolArgs('delete_everything', {}).ok, false);
});
