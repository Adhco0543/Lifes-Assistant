'use client';

import React from 'react';
import { parseMarkdown, type BlockNode, type InlineNode } from '../lib/markdownLite';

type MarkdownLiteProps = {
  text: string;
  className?: string;
};

function renderInline(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = keyPrefix + '-' + index;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.text}</React.Fragment>;
      case 'break':
        return <br key={key} />;
      case 'strong':
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case 'code':
        return <code key={key} className="md-inline-code">{node.text}</code>;
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="md-link">
            {renderInline(node.children, key)}
          </a>
        );
      default:
        return null;
    }
  });
}

function renderBlock(block: BlockNode, index: number): React.ReactNode {
  const key = 'b' + index;
  switch (block.type) {
    case 'paragraph':
      return <p key={key} className="md-p">{renderInline(block.children, key)}</p>;
    case 'heading': {
      // Chat bubbles should not shout: cap headings at h4 size regardless of level.
      const Tag = ('h' + Math.min(6, Math.max(3, block.level + 2))) as 'h3' | 'h4' | 'h5' | 'h6';
      return <Tag key={key} className="md-h">{renderInline(block.children, key)}</Tag>;
    }
    case 'list': {
      const items = block.items.map((item, itemIndex) => (
        <li key={key + '-' + itemIndex}>{renderInline(item, key + '-' + itemIndex)}</li>
      ));
      return block.ordered
        ? <ol key={key} className="md-list" start={block.start}>{items}</ol>
        : <ul key={key} className="md-list">{items}</ul>;
    }
    case 'code':
      return (
        <pre key={key} className="md-pre" data-language={block.language || undefined}>
          <code>{block.text}</code>
        </pre>
      );
    case 'quote':
      return <blockquote key={key} className="md-quote">{renderInline(block.children, key)}</blockquote>;
    case 'rule':
      return <hr key={key} className="md-rule" />;
    default:
      return null;
  }
}

/**
 * Renders assistant text with light markdown support and no raw HTML.
 * Styling is scoped with global class names so it works inside any bubble.
 */
export default function MarkdownLite({ text, className }: MarkdownLiteProps) {
  const blocks = React.useMemo(() => parseMarkdown(text || ''), [text]);
  return (
    <div className={'md-root' + (className ? ' ' + className : '')}>
      {blocks.map(renderBlock)}
      <style jsx global>{`
        .md-root { font-size: inherit; line-height: 1.55; word-break: break-word; }
        .md-root > :first-child { margin-top: 0; }
        .md-root > :last-child { margin-bottom: 0; }
        .md-p { margin: 0 0 .65em; white-space: pre-wrap; }
        .md-h { margin: .9em 0 .35em; font-size: 1em; font-weight: 700; letter-spacing: .01em; }
        .md-list { margin: 0 0 .65em; padding-left: 1.35em; }
        .md-list li { margin: .2em 0; white-space: pre-wrap; }
        .md-list li::marker { color: #9fd9b8; }
        .md-inline-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: .9em;
          padding: .08em .35em;
          border-radius: 6px;
          background: rgba(255,255,255,.09);
          border: 1px solid rgba(255,255,255,.08);
        }
        .md-pre {
          margin: 0 0 .7em;
          padding: .75em .9em;
          border-radius: 10px;
          background: rgba(0,0,0,.35);
          border: 1px solid rgba(255,255,255,.08);
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: .86em;
          line-height: 1.5;
        }
        .md-pre code { background: none; border: 0; padding: 0; }
        .md-quote {
          margin: 0 0 .65em;
          padding: .2em 0 .2em .85em;
          border-left: 3px solid rgba(159,217,184,.6);
          color: rgba(255,255,255,.78);
          white-space: pre-wrap;
        }
        .md-rule { border: 0; border-top: 1px solid rgba(255,255,255,.12); margin: .8em 0; }
        .md-link { color: #9fd9b8; text-decoration: underline; text-underline-offset: 2px; }
        .md-link:hover { color: #c3ead4; }
      `}</style>
    </div>
  );
}
