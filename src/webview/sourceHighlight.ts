import type { SourceSemanticTokenDto } from '../shared/protocol.js';
import { withRustSyntaxFallbacks } from './rustSyntaxFallback.js';

export interface HighlightedRustSegment {
  readonly text: string;
  readonly token?: SourceSemanticTokenDto;
}

export function isRustHoverLanguage(language: string | undefined): boolean {
  return language === undefined || language.length === 0 || language === 'rust' || language === 'rs';
}

export function semanticTokenClassName(token: SourceSemanticTokenDto): string {
  const tokenType = token.tokenType.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const modifiers = token.modifiers.map(modifier =>
    `source-semantic-${modifier.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
  );
  return ['source-semantic', `source-semantic-${tokenType}`, ...modifiers].join(' ');
}

export function highlightRustSegments(text: string): readonly HighlightedRustSegment[] {
  const tokens = withRustSyntaxFallbacks(text, []).filter(item => item.endOffset > item.startOffset);
  const boundaries = new Set<number>([0, text.length]);
  for (const token of tokens) {
    boundaries.add(Math.max(0, token.startOffset));
    boundaries.add(Math.min(text.length, token.endOffset));
  }
  const offsets = [...boundaries].sort((left, right) => left - right);
  const segments: HighlightedRustSegment[] = [];
  for (let index = 0; index + 1 < offsets.length; index += 1) {
    const start = offsets[index] ?? 0;
    const end = offsets[index + 1] ?? text.length;
    if (end <= start) {
      continue;
    }
    const token = tokens.find(item => item.startOffset <= start && item.endOffset >= end);
    segments.push({
      text: text.slice(start, end),
      ...(token === undefined ? {} : { token })
    });
  }
  return segments;
}
