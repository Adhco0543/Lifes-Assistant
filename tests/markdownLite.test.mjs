import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, parseInline, markdownToPlainText, isSafeHref } from '../lib/markdownLite.ts';

test('bold, italics, and inline code no longer leak raw symbols', () => {
  const nodes = parseInline('Call **Allen Hendershot** about the *porch* and run `npm test`.');
  assert.deepEqual(nodes.map((node) => node.type), ['text', 'strong', 'text', 'em', 'text', 'code', 'text']);
  assert.equal(nodes[1].children[0].text, 'Allen Hendershot');
  assert.equal(nodes[3].children[0].text, 'porch');
  assert.equal(nodes[5].text, 'npm test');
});

test('unbalanced markers are left as plain text instead of swallowing the message', () => {
  assert.deepEqual(parseInline('2 ** 3 is 8'), [{ type: 'text', text: '2 ** 3 is 8' }]);
  assert.deepEqual(parseInline('snake_case_name stays'), [{ type: 'text', text: 'snake_case_name stays' }]);
  assert.deepEqual(parseInline('a * b * c'), [{ type: 'text', text: 'a * b * c' }]);
});

test('lists, headings, quotes, and code fences become blocks', () => {
  const blocks = parseMarkdown([
    '## Today',
    'Two things:',
    '- Call Allen',
    '- Send the **porch quote**',
    '',
    '1. Measure',
    '2. Order lumber',
    '   16 ft boards',
    '',
    '> Approval-first for external actions',
    '',
    '```bash',
    'npm test',
    '```',
    '---',
    'Done.',
  ].join('\n'));
  assert.deepEqual(blocks.map((block) => block.type), ['heading', 'paragraph', 'list', 'list', 'quote', 'code', 'rule', 'paragraph']);
  assert.equal(blocks[0].level, 2);
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[2].items[1][1].type, 'strong');
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[3].items.length, 2);
  assert.match(markdownToPlainText('1. Measure\n2. Order lumber\n   16 ft boards'), /Order lumber\n16 ft boards/);
  assert.equal(blocks[5].language, 'bash');
  assert.equal(blocks[5].text, 'npm test');
});

test('links only render for http(s), mailto, and tel; everything else stays text', () => {
  const [link] = parseInline('[Quote](https://example.com/q/1)');
  assert.equal(link.type, 'link');
  assert.equal(link.href, 'https://example.com/q/1');
  const [plain] = parseInline('[click](javascript:alert(1))');
  assert.deepEqual(plain, { type: 'text', text: 'click' });
  assert.equal(isSafeHref('mailto:allen@example.com'), true);
  assert.equal(isSafeHref('data:text/html,hi'), false);
  const bare = parseInline('See https://example.com/path. Then stop.');
  assert.equal(bare[1].type, 'link');
  assert.equal(bare[1].href, 'https://example.com/path');
});

test('plain text with blank lines becomes separate paragraphs and keeps single newlines', () => {
  const blocks = parseMarkdown('Line one\nLine two\n\nSecond paragraph');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].children.map((node) => node.type), ['text', 'break', 'text']);
  assert.equal(markdownToPlainText('Hi **there**\n\nBye'), 'Hi there\n\nBye');
});
