import { Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SourceHoverBlockDto } from '../shared/protocol.js';
import { highlightRustSegments, isRustHoverLanguage, semanticTokenClassName } from './sourceHighlight.js';

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

export type InlineMarkdownSpan =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'codeLink'; readonly value: string }
  | { readonly kind: 'bold'; readonly value: string }
  | { readonly kind: 'link'; readonly value: string };

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
      <div className="source-language-hover-content">
        {mergeAdjacentCodeBlocks(blocks.flatMap(block => block.kind === 'code'
          ? [{ kind: 'code' as const, value: block.value, ...(block.language === undefined ? {} : { language: block.language }) }]
          : parseHoverMarkdown(block.value)
        )).map((item, index) => renderBlock(item, String(index)))}
      </div>
    </aside>,
    document.body
  );
}

function mergeAdjacentCodeBlocks(blocks: readonly RenderBlock[]): readonly RenderBlock[] {
  const merged: RenderBlock[] = [];
  for (const block of blocks) {
    const previous = merged.at(-1);
    if (block.kind === 'code' && previous?.kind === 'code' && block.language === previous.language) {
      merged[merged.length - 1] = {
        kind: 'code',
        value: `${previous.value ?? ''}\n${block.value ?? ''}`,
        ...(block.language === undefined && previous.language === undefined
          ? {}
          : { language: block.language ?? previous.language })
      };
    } else {
      merged.push(block);
    }
  }
  return merged;
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
        <code>{renderHoverCode(block.value ?? '', block.language)}</code>
      </pre>
    );
  }
  return <p key={key}>{renderInlineMarkdown(block.value ?? '')}</p>;
}

function renderHoverCode(value: string, language: string | undefined): ReactNode {
  if (!isRustHoverLanguage(language)) {
    return value;
  }
  return highlightRustSegments(value, { rainbowBrackets: false, colorTypeParameters: true }).map((segment, index) => (
    segment.token === undefined
      ? <Fragment key={index}>{segment.text}</Fragment>
      : <span className={semanticTokenClassName(segment.token)} key={index}>{segment.text}</span>
  ));
}

export function parseInlineMarkdown(value: string): readonly InlineMarkdownSpan[] {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[`[^`\n]+`\]\([^)\n]+\)|\[[^\]\n]+\]\([^)\n]+\))/g;
  const spans: InlineMarkdownSpan[] = [];
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) {
      spans.push({ kind: 'text', value: value.slice(cursor, index) });
    }
    const token = match[0];
    if (token.startsWith('`')) {
      spans.push({ kind: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      spans.push({ kind: 'bold', value: token.slice(2, -2) });
    } else {
      const codeLink = /^\[`([^`\n]+)`\]\([^)\n]+\)$/.exec(token);
      if (codeLink?.[1] !== undefined) {
        spans.push({ kind: 'codeLink', value: codeLink[1] });
      } else {
        spans.push({ kind: 'link', value: /^\[([^\]]+)\]/.exec(token)?.[1] ?? token });
      }
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) {
    spans.push({ kind: 'text', value: value.slice(cursor) });
  }
  return spans;
}

function renderInlineMarkdown(value: string): readonly ReactNode[] {
  return parseInlineMarkdown(value).map((span, index) => {
    if (span.kind === 'codeLink') {
      return <span className="source-language-hover-link" key={index}><code>{span.value}</code></span>;
    }
    if (span.kind === 'code') {
      return <code key={index}>{span.value}</code>;
    }
    if (span.kind === 'bold') {
      return <strong key={index}>{span.value}</strong>;
    }
    if (span.kind === 'link') {
      return <span className="source-language-hover-link" key={index}>{span.value}</span>;
    }
    return <Fragment key={index}>{span.value}</Fragment>;
  });
}
