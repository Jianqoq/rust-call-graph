import { Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SourceHoverBlockDto } from '../shared/protocol.js';

export interface SourceHoverAnchor {
  readonly sourceOffset: number;
  readonly left: number;
  readonly top: number;
}

interface RenderBlock {
  readonly kind: 'code' | 'paragraph' | 'separator';
  readonly value?: string;
  readonly language?: string;
}

export function SourceHoverCard({
  anchor,
  blocks,
  onMouseEnter,
  onMouseLeave
}: {
  readonly anchor: SourceHoverAnchor;
  readonly blocks: readonly SourceHoverBlockDto[];
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
}) {
  return createPortal(
    <aside
      id="source-language-hover"
      className="source-language-hover nodrag nowheel"
      role="tooltip"
      style={{ left: anchor.left, top: anchor.top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="source-language-hover-label">rust-analyzer</div>
      <div className="source-language-hover-content">
        {blocks.flatMap((block, blockIndex) => {
          const renderBlocks = block.kind === 'code'
            ? [{ kind: 'code' as const, value: block.value, ...(block.language === undefined ? {} : { language: block.language }) }]
            : parseHoverMarkdown(block.value);
          return renderBlocks.map((item, itemIndex) => renderBlock(item, `${blockIndex}:${itemIndex}`));
        })}
      </div>
    </aside>,
    document.body
  );
}

export function parseHoverMarkdown(value: string): readonly RenderBlock[] {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks: RenderBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', value: paragraph.join('\n') });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = /^```([^`]*)$/.exec(line.trim());
    if (fence !== null) {
      flushParagraph();
      const code: string[] = [];
      for (index += 1; index < lines.length && (lines[index] ?? '').trim() !== '```'; index += 1) {
        code.push(lines[index] ?? '');
      }
      const language = fence[1]?.trim();
      blocks.push({
        kind: 'code',
        value: code.join('\n'),
        ...(language === undefined || language.length === 0 ? {} : { language })
      });
    } else if (/^-{3,}$/.test(line.trim())) {
      flushParagraph();
      blocks.push({ kind: 'separator' });
    } else if (line.trim().length === 0) {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

function renderBlock(block: RenderBlock, key: string): ReactNode {
  if (block.kind === 'separator') {
    return <hr key={key} />;
  }
  if (block.kind === 'code') {
    return (
      <pre className="source-language-hover-code" key={key}>
        {block.language !== undefined && <span className="source-language-hover-language">{block.language}</span>}
        <code>{block.value}</code>
      </pre>
    );
  }
  return <p key={key}>{renderInlineMarkdown(block.value ?? '')}</p>;
}

function renderInlineMarkdown(value: string): readonly ReactNode[] {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) {
      nodes.push(value.slice(cursor, index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={index}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else {
      const label = /^\[([^\]]+)\]/.exec(token)?.[1] ?? token;
      nodes.push(<span className="source-language-hover-link" key={index}>{label}</span>);
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}
