import type { SourceSemanticTokenDto } from '../shared/protocol.js';
import { withRustSyntaxFallbacks, coveringSemanticToken } from './rustSyntaxFallback.js';

export interface HighlightedRustSegment {
  readonly text: string;
  readonly token?: SourceSemanticTokenDto;
}

export function isRustHoverLanguage(language: string | undefined): boolean {
  return language === undefined || language.length === 0 || language === 'rust' || language === 'rs';
}

const DEFINITION_TOKEN_TYPES = new Set([
  'attribute',
  'builtinType',
  'constParameter',
  'decorator',
  'enum',
  'enumMember',
  'field',
  'function',
  'interface',
  'lifetime',
  'macro',
  'macroBang',
  'method',
  'module',
  'namespace',
  'parameter',
  'procMacro',
  'property',
  'selfKeyword',
  'selfTypeKeyword',
  'static',
  'struct',
  'type',
  'typeAlias',
  'typeParameter',
  'union',
  'unresolvedReference',
  'variable'
]);

const RESULT_OPTION_VARIANTS = new Set(['Ok', 'Err', 'Some', 'None']);

export function isDefinitionNavigableToken(tokenType: string): boolean {
  return DEFINITION_TOKEN_TYPES.has(tokenType);
}

export function showsGotoDefinitionUnderline(
  tokenType: string | undefined,
  text: string,
  hasRelationship: boolean
): boolean {
  if (hasRelationship || tokenType === undefined) {
    return false;
  }
  if (tokenType === 'method' || tokenType === 'enumMember' || RESULT_OPTION_VARIANTS.has(text)) {
    return false;
  }
  return isDefinitionNavigableToken(tokenType);
}

export function semanticTokenClassName(token: SourceSemanticTokenDto): string {
  const tokenType = displayTokenType(token.tokenType).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const modifiers = token.modifiers.map(modifier =>
    `source-semantic-${modifier.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
  );
  return ['source-semantic', `source-semantic-${tokenType}`, ...modifiers].join(' ');
}

const DISPLAY_TOKEN_TYPES: Readonly<Record<string, string>> = {
  method: 'function',
  macroBang: 'macro',
  procMacro: 'macro',
  module: 'namespace',
  typeAlias: 'type',
  union: 'type',
  selfTypeKeyword: 'keyword',
  static: 'variable'
};

function displayTokenType(tokenType: string): string {
  return DISPLAY_TOKEN_TYPES[tokenType] ?? tokenType;
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
    const token = coveringSemanticToken(tokens, start, end);
    segments.push({
      text: text.slice(start, end),
      ...(token === undefined ? {} : { token })
    });
  }
  return segments;
}
