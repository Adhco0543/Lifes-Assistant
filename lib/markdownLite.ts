// A small, dependency-free markdown parser for assistant replies.
//
// It covers what the model actually emits in chat: paragraphs, **bold**, *italics*,
// `inline code`, fenced code blocks, links, headings, bullet and numbered lists,
// and blockquotes. It never produces raw HTML, so nothing the model (or a saved
// transcript) contains can inject markup. Rendering happens in
// components/MarkdownLite.tsx, which maps these nodes to React elements.

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'break' };

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; start: number; items: InlineNode[][] }
  | { type: 'code'; language: string; text: string }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'rule' };

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)/i;

export function isSafeHref(href: string): boolean {
  return SAFE_LINK.test(href.trim());
}

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = '';
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };

  const findClosing = (marker: string, from: number): number => {
    let search = from;
    while (search < source.length) {
      const found = source.indexOf(marker, search);
      if (found === -1) return -1;
      // Closing marker must follow a non-space character and not sit inside a word for single '*'/'_'.
      const before = source[found - 1];
      if (before && before !== ' ') return found;
      search = found + marker.length;
    }
    return -1;
  };

  while (index < source.length) {
    const char = source[index];
    const rest = source.slice(index);

    // Inline code: `text`
    if (char === '`') {
      const close = source.indexOf('`', index + 1);
      if (close !== -1) {
        flush();
        nodes.push({ type: 'code', text: source.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }

    // Bold: **text** or __text__
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2);
      const close = findClosing(marker, index + 2);
      if (close !== -1 && close > index + 2) {
        flush();
        nodes.push({ type: 'strong', children: parseInline(source.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }

    // Italic: *text* or _text_ (not inside words for '_')
    if ((char === '*' || char === '_') && source[index + 1] && source[index + 1] !== ' ' && source[index + 1] !== char) {
      const prev = source[index - 1];
      const wordBound = char === '*' || !prev || !/[A-Za-z0-9]/.test(prev);
      if (wordBound) {
        const close = findClosing(char, index + 1);
        if (close !== -1 && (char === '*' || !/[A-Za-z0-9]/.test(source[close + 1] || ''))) {
          flush();
          nodes.push({ type: 'em', children: parseInline(source.slice(index + 1, close)) });
          index = close + 1;
          continue;
        }
      }
    }

    // Link: [label](href)
    if (char === '[') {
      const closeLabel = source.indexOf(']', index + 1);
      if (closeLabel !== -1 && source[closeLabel + 1] === '(') {
        const closeHref = source.indexOf(')', closeLabel + 2);
        if (closeHref !== -1) {
          const label = source.slice(index + 1, closeLabel);
          const href = source.slice(closeLabel + 2, closeHref).trim();
          flush();
          if (isSafeHref(href)) {
            nodes.push({ type: 'link', href, children: parseInline(label) });
          } else {
            nodes.push({ type: 'text', text: label });
          }
          index = closeHref + 1;
          continue;
        }
      }
    }

    // Bare URL
    if (rest.startsWith('http://') || rest.startsWith('https://')) {
      const match = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/);
      if (match) {
        flush();
        nodes.push({ type: 'link', href: match[0], children: [{ type: 'text', text: match[0] }] });
        index += match[0].length;
        continue;
      }
    }

    // Hard line break inside a paragraph
    if (char === '\n') {
      flush();
      nodes.push({ type: 'break' });
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  flush();
  return nodes;
}

const BULLET = /^\s{0,3}[-*•]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}```\s*([A-Za-z0-9_+-]*)\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    const fence = line.match(FENCE);
    if (fence) {
      flushParagraph();
      const language = fence[1] || '';
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // skip closing fence (or run off the end)
      blocks.push({ type: 'code', language, text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: Math.min(6, heading[1].length) as 1 | 2 | 3 | 4 | 5 | 6, children: parseInline(heading[2]) });
      index += 1;
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      flushParagraph();
      const body: string[] = [quote[1]];
      index += 1;
      while (index < lines.length && QUOTE.test(lines[index])) {
        body.push((lines[index].match(QUOTE) as RegExpMatchArray)[1]);
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(body.join('\n')) });
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const start = numbered ? Number(numbered[1]) : 1;
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const current = lines[index];
        const match = ordered ? current.match(NUMBERED) : current.match(BULLET);
        if (!match) break;
        const text: string[] = [ordered ? match[2] : match[1]];
        index += 1;
        // Continuation lines: indented, non-empty, not a new item.
        while (
          index < lines.length &&
          lines[index].trim() &&
          /^\s{2,}/.test(lines[index]) &&
          !BULLET.test(lines[index]) &&
          !NUMBERED.test(lines[index])
        ) {
          text.push(lines[index].trim());
          index += 1;
        }
        items.push(parseInline(text.join('\n')));
      }
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

// Plain-text projection, useful for previews and tests.
export function inlineToText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text;
      if (node.type === 'break') return '\n';
      return inlineToText(node.children);
    })
    .join('');
}

export function markdownToPlainText(source: string): string {
  return parseMarkdown(source)
    .map((block) => {
      if (block.type === 'rule') return '';
      if (block.type === 'code') return block.text;
      if (block.type === 'list') {
        return block.items.map((item, idx) => (block.ordered ? block.start + idx + '. ' : '• ') + inlineToText(item)).join('\n');
      }
      return inlineToText(block.children);
    })
    .filter(Boolean)
    .join('\n\n');
}
