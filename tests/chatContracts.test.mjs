import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatRequest, parseChatApiResponse, parseResponsesApiResult } from '../lib/chatApiContracts.ts';
import { currentChatContext, recallKeywords, compactConversationMessages } from '../lib/chatContext.ts';

test('chat request rejects objects of wrong shape and oversized fields', () => {
  for (const value of [null, [], 'hello', { message: 42 }, { history: 'wrong' },
    { attachments: [{}, {}, {}, {}] }, { message: 'x'.repeat(60001) }]) {
    assert.equal(validateChatRequest(value).valid, false);
  }
  assert.equal(validateChatRequest({ message: 'hello', history: [] }).valid, true);
});

test('chat response rejects missing or invalid message and action payload', () => {
  for (const value of [null, [], { message: 19 }, { message: '' },
    { message: 'ok', data: [] }, { message: 'ok', type: 'unexpected' }]) {
    assert.throws(() => parseChatApiResponse(value), /Invalid chat response/);
  }
  assert.deepEqual(parseChatApiResponse({ message: 'Hi' }),
    { type: 'chat', message: 'Hi' });
  assert.equal(parseChatApiResponse({
    message: 'Draft created',
    type: 'quote',
    data: { title: 'Materials' },
  }).type, 'quote');
});

test('external model response is normalized even with malformed nested data', () => {
  assert.throws(() => parseResponsesApiResult(null), /Invalid AI response/);
  const result = parseResponsesApiResult({
    output_text: 'Hello',
    output: [null, false, { type: 'message', content: [false, { type: 'output_text', text: 'Hi' }] }],
  });
  assert.equal(result.output_text, 'Hello');
  assert.equal(result.output?.[0]?.content?.[0]?.text, 'Hi');
});

const msg = (content, role = 'user', timestamp = 1) => ({
  id: String(timestamp), conversationId: 'local', userId: 'account',
  role, content, timestamp,
});

test('chat flow context respects memory order and bounded history', () => {
  const messages = Array.from({ length: 30 }, (_, i) =>
    msg('message ' + i + ' ' + 'x'.repeat(700), i % 2 ? 'assistant' : 'user', i + 1));
  const context = currentChatContext(messages);
  assert.ok(context.omitted > 0);
  assert.equal(context.omitted + context.selected.length, messages.length);
  assert.equal(context.selected.at(-1).content.trim().startsWith('message 29'), true);
  assert.ok(recallKeywords('Can you recall my Git repository setup?').includes('repository'));
  const compacted = compactConversationMessages(messages, ['message'], 8);
  assert.ok(compacted.length <= 8);
  assert.ok(compacted.every((item) => item.content.length <= 900));
});

test('responses parser surfaces function calls for the tool loop', () => {
  const result = parseResponsesApiResult({
    status: 'completed',
    output: [
      { type: 'function_call', call_id: 'call_1', name: 'create_task', arguments: '{"title":"Call Allen"}' },
      { type: 'function_call', call_id: 'call_2', name: 'list_open_items' },
      { type: 'function_call', name: 'missing_call_id', arguments: '{}' },
      { type: 'message', content: [{ type: 'output_text', text: 'Working on it.' }] },
    ],
  });
  assert.deepEqual(result.functionCalls, [
    { call_id: 'call_1', name: 'create_task', arguments: '{"title":"Call Allen"}' },
    { call_id: 'call_2', name: 'list_open_items', arguments: '{}' },
  ]);
  assert.equal(parseResponsesApiResult({ output: [] }).functionCalls, undefined);
});

test('chat response parser accepts well-formed action receipts and drops malformed ones', () => {
  const parsed = parseChatApiResponse({
    type: 'chat',
    message: 'Done.',
    actions: [
      { callId: 'c1', tool: 'create_task', label: 'Task created', summary: 'Call Allen', status: 'done', reason: 'Saved.', policyCode: 'workspace_write', recordId: 'r1', linkedView: 'tasks', at: 1 },
      { callId: 'c2', tool: 'send_email', label: 'Email sent', summary: 'Quote → a@b.com', status: 'approval_required', reason: 'Asks first.', policyCode: 'email_ask', pendingAction: { tool: 'send_email', args: { to: 'a@b.com' } }, at: 2 },
      { tool: 'send_email', summary: 'bad status', status: 'maybe' },
      'not an object',
    ],
  });
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[0].status, 'done');
  assert.equal(parsed.actions[1].pendingAction.args.to, 'a@b.com');
  assert.equal(parseChatApiResponse({ message: 'Hi' }).actions, undefined);
});
