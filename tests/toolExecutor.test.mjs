import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolExecutor } from '../lib/tools/executor.ts';
import { encodeFields } from '../lib/tools/firestoreRest.ts';

// ---- Fake Firestore REST backend -------------------------------------------------
// Stores documents in memory and answers the subset of the REST API the client uses.

function fakeFirestore(initial = {}) {
  const docs = new Map(Object.entries(initial)); // path -> plain object
  let counter = 0;
  const calls = [];

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.split('/documents/')[1] || '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    assert.equal(init.headers.Authorization, 'Bearer test-token');

    if (path.endsWith(':runQuery')) {
      const parent = path.replace(':runQuery', '');
      const query = body.structuredQuery;
      const collectionId = query.from[0].collectionId;
      const filters = query.where ? (query.where.compositeFilter ? query.where.compositeFilter.filters : [query.where]) : [];
      const results = [...docs.entries()]
        .filter(([docPath]) => docPath.startsWith(parent + '/' + collectionId + '/') && docPath.split('/').length === parent.split('/').length + 2)
        .filter(([, data]) => filters.every((filter) => {
          const field = filter.fieldFilter.field.fieldPath;
          const expected = decode(filter.fieldFilter.value);
          const actual = data[field];
          if (filter.fieldFilter.op === 'EQUAL') return actual === expected;
          if (filter.fieldFilter.op === 'GREATER_THAN_OR_EQUAL') return actual >= expected;
          if (filter.fieldFilter.op === 'LESS_THAN') return actual < expected;
          return false;
        }))
        .slice(0, query.limit || 50)
        .map(([docPath, data]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + docPath, fields: encodeFields(data) } }));
      return jsonResponse(results);
    }

    if (method === 'GET') {
      const data = docs.get(path);
      if (!data) return new Response('not found', { status: 404 });
      return jsonResponse({ name: 'projects/p/databases/(default)/documents/' + path, fields: encodeFields(data) });
    }

    if (method === 'POST') {
      counter += 1;
      const id = 'doc' + counter;
      docs.set(path + '/' + id, decodeFieldsPlain(body.fields));
      return jsonResponse({ name: 'projects/p/databases/(default)/documents/' + path + '/' + id, fields: body.fields });
    }

    if (method === 'PATCH') {
      const existing = docs.get(path) || {};
      docs.set(path, { ...existing, ...decodeFieldsPlain(body.fields) });
      return jsonResponse({ name: 'projects/p/databases/(default)/documents/' + path, fields: body.fields });
    }

    return new Response('unsupported', { status: 500 });
  };

  return { fetchImpl, docs, calls };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFieldsPlain(value.mapValue.fields);
  return null;
}

function decodeFieldsPlain(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

const NOW = Date.parse('2026-11-03T17:00:00Z'); // noon in New York

function makeExecutor(store, extra = {}) {
  return new ToolExecutor({
    uid: 'u1',
    idToken: 'test-token',
    projectId: 'p',
    timeZone: 'America/New_York',
    conversationId: 'conv1',
    now: () => NOW,
    fetchImpl: store.fetchImpl,
    ...extra,
  });
}

const eventsIn = (store) => [...store.docs.entries()].filter(([path]) => path.startsWith('users/u1/events/')).map(([, data]) => data);
const recordsIn = (store, kind) => [...store.docs.entries()].filter(([path]) => path.startsWith('users/u1/records/')).map(([, data]) => data).filter((data) => data.kind === kind);

test('create_task writes a task record and a receipt attributed to the assistant', async () => {
  const store = fakeFirestore();
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'create_task', arguments: { title: 'Call Allen about the porch', dueDate: '2026-11-05', priority: 'high', projectName: null, notes: null } });

  assert.equal(result.receipt.status, 'done');
  assert.equal(result.receipt.tool, 'create_task');
  assert.equal(result.receipt.linkedView, 'tasks');
  const output = JSON.parse(result.modelOutput);
  assert.equal(output.executed, true);
  assert.ok(output.taskId);

  const tasks = recordsIn(store, 'task');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].data.title, 'Call Allen about the porch');
  assert.equal(tasks[0].data.status, 'open');
  assert.equal(tasks[0].data.createdBy, 'assistant');

  const events = eventsIn(store);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventName, 'task.created');
  assert.equal(events[0].data.actor, 'assistant');
  assert.equal(events[0].data.status, 'done');
  assert.equal(events[0].data.conversationId, 'conv1');
  assert.equal(events[0].createdAt, NOW);
});

test('reads leave no receipt and return real ids the model can act on', async () => {
  const store = fakeFirestore({
    'users/u1/records/t1': { kind: 'task', data: { title: 'Open one', status: 'open' }, createdAt: 1, updatedAt: 2 },
    'users/u1/records/t2': { kind: 'task', data: { title: 'Done one', status: 'done' }, createdAt: 1, updatedAt: 3 },
    'users/u1/openLoops/l1': { title: 'Finish quote draft for allen hendershot', status: 'open', priority: 'high', createdAt: 1, updatedAt: 1 },
    'users/u1/openLoops/l2': { title: 'Old thing', status: 'resolved', createdAt: 1, updatedAt: 1 },
  });
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'list_open_items', arguments: { include: ['tasks', 'radar'] } });
  assert.equal(result.receipt, null);
  const output = JSON.parse(result.modelOutput);
  assert.deepEqual(output.tasks.map((task) => task.taskId), ['t1']);
  assert.deepEqual(output.radar.map((loop) => loop.openLoopId), ['l1']);
  assert.equal(eventsIn(store).length, 0);
});

test('send_email with default settings waits for approval, parks a draft, and never calls the provider', async () => {
  const store = fakeFirestore();
  const executor = makeExecutor(store);
  const result = await executor.execute({
    callId: 'c1',
    name: 'send_email',
    arguments: { to: 'allen@example.com', subject: 'Porch quote', body: 'Hi Allen, the quote is attached.', category: 'customer', amount: null },
  });

  assert.equal(result.receipt.status, 'approval_required');
  assert.equal(result.receipt.policyCode, 'email_ask');
  assert.equal(result.receipt.pendingAction.tool, 'send_email');
  assert.equal(result.receipt.pendingAction.args.to, 'allen@example.com');
  const output = JSON.parse(result.modelOutput);
  assert.equal(output.executed, false);
  assert.match(output.instruction, /Do not claim it was sent/);

  const draft = store.docs.get('users/u1/drafts/work-email');
  assert.ok(draft, 'draft parked in Email drafts');
  assert.equal(draft.data.subject, 'Porch quote');

  const events = eventsIn(store);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventName, 'action.approval_required');
  assert.equal(events[0].data.actor, 'assistant');
});

test('send_email sends when the user enabled auto_send for that category', async () => {
  const store = fakeFirestore({
    'users/u1/settings/autonomy': { emailBehavior: 'ask', emailCategories: { followup: 'auto_send' }, dailyExecutionLimit: 50 },
  });
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.RESEND_API_KEY = 'k';
  process.env.EMAIL_FROM = 'bella@example.com';
  process.env.EMAIL_DOMAIN_VERIFIED = 'true';
  let providerCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      providerCalls += 1;
      return jsonResponse({ id: 'resend-123' });
    }
    return originalFetch(url, init);
  };
  try {
    const executor = makeExecutor(store);
    const result = await executor.execute({
      callId: 'c1',
      name: 'send_email',
      arguments: { to: 'allen@example.com', subject: 'Checking in', body: 'Any questions on the quote?', category: 'followup', amount: null },
    });
    assert.equal(providerCalls, 1);
    assert.equal(result.receipt.status, 'done');
    assert.equal(result.receipt.policyCode, 'email_auto');
    const events = eventsIn(store);
    assert.equal(events[0].eventName, 'email.sent');
    assert.equal(events[0].data.providerId, 'resend-123');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('daily limit counts only the assistant\'s completed actions and blocks past it', async () => {
  const store = fakeFirestore({
    'users/u1/settings/autonomy': { dailyExecutionLimit: 2 },
    'users/u1/events/e1': { eventName: 'task.created', data: { actor: 'assistant', status: 'done' }, createdAt: NOW - 60_000 },
    'users/u1/events/e2': { eventName: 'note.saved', data: { actor: 'assistant', status: 'done' }, createdAt: NOW - 30_000 },
    'users/u1/events/e3': { eventName: 'task.created', data: {}, createdAt: NOW - 10_000 }, // user action, not counted
    'users/u1/events/e4': { eventName: 'task.created', data: { actor: 'assistant', status: 'done' }, createdAt: NOW - 36 * 3_600_000 }, // yesterday
  });
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'save_note', arguments: { title: null, text: 'Measure the back steps' } });
  assert.equal(result.receipt.status, 'blocked');
  assert.equal(result.receipt.policyCode, 'daily_limit');
  assert.equal(recordsIn(store, 'note').length, 0);
  const blockedEvents = eventsIn(store).filter((event) => event.eventName === 'action.blocked');
  assert.equal(blockedEvents.length, 1);
});

test('the executor keeps its own count within one conversation turn', async () => {
  const store = fakeFirestore({ 'users/u1/settings/autonomy': { dailyExecutionLimit: 1 } });
  const executor = makeExecutor(store);
  const first = await executor.execute({ callId: 'c1', name: 'save_memory', arguments: { text: 'Allen prefers texts', category: 'preference' } });
  const second = await executor.execute({ callId: 'c2', name: 'save_memory', arguments: { text: 'Second memory', category: 'general' } });
  assert.equal(first.receipt.status, 'done');
  assert.equal(second.receipt.status, 'blocked');
});

test('invalid arguments fail cleanly without touching the workspace', async () => {
  const store = fakeFirestore();
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'send_email', arguments: { to: 'Allen', subject: 'x', body: 'y', category: 'customer', amount: null } });
  assert.equal(result.receipt.status, 'failed');
  assert.equal(result.receipt.policyCode, 'invalid_args');
  assert.equal(store.docs.size, 0);
  assert.match(JSON.parse(result.modelOutput).error, /valid recipient/);
});

test('acting on a missing id fails and records the failure', async () => {
  const store = fakeFirestore();
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'complete_task', arguments: { taskId: 'nope' } });
  assert.equal(result.receipt.status, 'failed');
  assert.equal(result.receipt.policyCode, 'execution_error');
  assert.match(JSON.parse(result.modelOutput).instruction, /Do not claim it happened/);
  assert.equal(eventsIn(store).filter((event) => event.eventName === 'action.failed').length, 1);
});

test('snooze and resolve update the radar item in place', async () => {
  const store = fakeFirestore({ 'users/u1/openLoops/l1': { title: 'Follow up with Allen', status: 'open', createdAt: 1, updatedAt: 1 } });
  const executor = makeExecutor(store);
  const snoozed = await executor.execute({ callId: 'c1', name: 'snooze_radar_item', arguments: { openLoopId: 'l1', days: 3 } });
  assert.equal(snoozed.receipt.status, 'done');
  assert.equal(store.docs.get('users/u1/openLoops/l1').status, 'snoozed');
  assert.equal(store.docs.get('users/u1/openLoops/l1').snoozedUntil, NOW + 3 * 86_400_000);
  const resolved = await executor.execute({ callId: 'c2', name: 'resolve_radar_item', arguments: { openLoopId: 'l1' } });
  assert.equal(resolved.receipt.status, 'done');
  assert.equal(store.docs.get('users/u1/openLoops/l1').status, 'resolved');
});

test('unknown tools return an error for the model and no receipt', async () => {
  const store = fakeFirestore();
  const executor = makeExecutor(store);
  const result = await executor.execute({ callId: 'c1', name: 'wipe_account', arguments: {} });
  assert.equal(result.receipt, null);
  assert.match(JSON.parse(result.modelOutput).error, /Unknown tool/);
});
