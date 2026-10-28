import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDeclaredBodyTooLarge,
  isFileTooLarge,
  readLimitedFormData,
  readLimitedJson,
  readLimitedText,
} from '../lib/requestLimits.ts';

function post(body, headers = {}) {
  return new Request('https://example.test/api', { method: 'POST', body, headers });
}

function chunkedRequest(chunks, headers = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('https://example.test/api', { method: 'POST', body: stream, headers, duplex: 'half' });
}

test('content-length header is only a fast path', () => {
  assert.equal(isDeclaredBodyTooLarge(post('x', { 'content-length': '500' }), 100), true);
  assert.equal(isDeclaredBodyTooLarge(post('x'), 100), false);
  assert.equal(isDeclaredBodyTooLarge(post('x', { 'content-length': 'abc' }), 100), false);
});

test('actual body size is enforced when content-length is missing or understated', async () => {
  const chunked = await readLimitedText(chunkedRequest(['a'.repeat(60), 'b'.repeat(60)]), 100);
  assert.deepEqual(chunked, { ok: false, status: 413 });

  const lying = await readLimitedText(post('z'.repeat(500), { 'content-length': '5' }), 100);
  assert.deepEqual(lying, { ok: false, status: 413 });

  const declaredLarge = await readLimitedText(post('ok', { 'content-length': '5000' }), 100);
  assert.deepEqual(declaredLarge, { ok: false, status: 413 });
});

test('bodies within the limit are parsed; malformed JSON yields null', async () => {
  const good = await readLimitedJson(chunkedRequest(['{"a":', '1}']), 100);
  assert.deepEqual(good, { ok: true, value: { a: 1 } });
  const bad = await readLimitedJson(post('{nope'), 100);
  assert.deepEqual(bad, { ok: true, value: null });
  const multibyte = await readLimitedText(post('é'.repeat(60)), 100);
  assert.deepEqual(multibyte, { ok: false, status: 413 });
});

test('multipart uploads are bounded and files are checked by size', async () => {
  const form = new FormData();
  form.append('audio', new Blob(['x'.repeat(200)], { type: 'audio/webm' }), 'a.webm');
  const small = await readLimitedFormData(new Request('https://example.test/api', { method: 'POST', body: form }), 10_000);
  assert.equal(small.ok, true);
  assert.equal(small.value.get('audio').size, 200);

  const bigForm = new FormData();
  bigForm.append('audio', new Blob(['x'.repeat(5000)], { type: 'audio/webm' }), 'a.webm');
  const big = await readLimitedFormData(new Request('https://example.test/api', { method: 'POST', body: bigForm }), 1000);
  assert.deepEqual(big, { ok: false, status: 413 });

  assert.equal(isFileTooLarge({ size: 11 }, 10), true);
  assert.equal(isFileTooLarge({ size: 10 }, 10), false);
});
