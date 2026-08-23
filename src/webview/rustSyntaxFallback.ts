import type { SourceSemanticTokenDto } from '../shared/protocol.js';

const RUST_KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'become', 'box', 'break', 'const', 'continue',
  'crate', 'do', 'dyn', 'else', 'enum', 'extern', 'final', 'fn', 'for', 'gen', 'if',
  'impl', 'in', 'let', 'loop', 'macro', 'match', 'mod', 'move', 'mut', 'override',
  'priv', 'pub', 'raw', 'ref', 'return', 'safe', 'static', 'struct', 'super', 'trait',
  'try', 'type', 'typeof', 'unsafe', 'unsized', 'use', 'virtual', 'where', 'while',
  'yield'
]);

const IDENTIFIER = /^[\p{ID_Start}_][\p{ID_Continue}_]*/u;
const NUMBER = /^(?:0[xX][0-9A-Fa-f_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:[A-Za-z][A-Za-z0-9_]*)?/;

export function withRustSyntaxFallbacks(
  text: string,
  semanticTokens: readonly SourceSemanticTokenDto[]
): readonly SourceSemanticTokenDto[] {
  const fallbacks = rustSyntaxFallbackTokens(text).filter(candidate =>
    !semanticTokens.some(token => rangesOverlap(candidate, token))
  );
  return [...semanticTokens, ...fallbacks]
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
}

export function rustSyntaxFallbackTokens(text: string): readonly SourceSemanticTokenDto[] {
  const tokens: SourceSemanticTokenDto[] = [];
  let index = 0;

  while (index < text.length) {
    const commentEnd = scanComment(text, index);
    if (commentEnd !== undefined) {
      tokens.push(token(index, commentEnd, 'comment'));
      index = commentEnd;
      continue;
    }

    if (text[index] === "'" && /^[\p{ID_Start}_][\p{ID_Continue}_]*/u.test(text.slice(index + 1))) {
      const lifetime = IDENTIFIER.exec(text.slice(index + 1))?.[0];
      if (lifetime !== undefined && text[index + 1 + lifetime.length] !== "'") {
        const end = index + 1 + lifetime.length;
        tokens.push(token(index, end, 'lifetime'));
        index = end;
        continue;
      }
    }

    const stringEnd = scanStringOrCharacter(text, index);
    if (stringEnd !== undefined) {
      tokens.push(token(index, stringEnd, 'string'));
      index = stringEnd;
      continue;
    }

    if (text.startsWith('r#', index)) {
      const rawIdentifier = IDENTIFIER.exec(text.slice(index + 2))?.[0];
      if (rawIdentifier !== undefined) {
        index += 2 + rawIdentifier.length;
        continue;
      }
    }

    const number = NUMBER.exec(text.slice(index))?.[0];
    if (number !== undefined) {
      const end = index + number.length;
      tokens.push(token(index, end, 'number'));
      index = end;
      continue;
    }

    const identifier = IDENTIFIER.exec(text.slice(index))?.[0];
    if (identifier !== undefined) {
      const end = index + identifier.length;
      if (identifier === 'true' || identifier === 'false') {
        tokens.push(token(index, end, 'boolean'));
      } else if (identifier === 'self') {
        tokens.push(token(index, end, 'selfKeyword'));
      } else if (identifier === 'Self' || RUST_KEYWORDS.has(identifier)) {
        tokens.push(token(index, end, 'keyword'));
      }
      index = end;
      continue;
    }

    index += 1;
  }

  return tokens;
}

function scanComment(text: string, start: number): number | undefined {
  if (text.startsWith('//', start)) {
    const newline = text.indexOf('\n', start + 2);
    return newline === -1 ? text.length : newline;
  }
  if (!text.startsWith('/*', start)) {
    return undefined;
  }

  let depth = 1;
  let index = start + 2;
  while (index < text.length && depth > 0) {
    if (text.startsWith('/*', index)) {
      depth += 1;
      index += 2;
    } else if (text.startsWith('*/', index)) {
      depth -= 1;
      index += 2;
    } else {
      index += 1;
    }
  }
  return index;
}

function scanStringOrCharacter(text: string, start: number): number | undefined {
  const rawPrefix = /^(?:br|cr|r)(#+)?"/.exec(text.slice(start));
  if (rawPrefix !== null) {
    const hashes = rawPrefix[1] ?? '';
    const closing = `"${hashes}`;
    const contentStart = start + rawPrefix[0].length;
    const closingStart = text.indexOf(closing, contentStart);
    return closingStart === -1 ? text.length : closingStart + closing.length;
  }

  const quotePrefix = /^(?:b|c)?(["'])/.exec(text.slice(start));
  if (quotePrefix === null) {
    return undefined;
  }
  const quote = quotePrefix[1];
  if (quote === undefined) {
    return undefined;
  }
  let index = start + quotePrefix[0].length;
  let escaped = false;
  while (index < text.length) {
    const character = text[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return index + 1;
    } else if (character === '\n' && quote === "'") {
      return undefined;
    }
    index += 1;
  }
  return quote === '"' ? text.length : undefined;
}

function token(startOffset: number, endOffset: number, tokenType: string): SourceSemanticTokenDto {
  return { startOffset, endOffset, tokenType, modifiers: [] };
}

function rangesOverlap(left: SourceSemanticTokenDto, right: SourceSemanticTokenDto): boolean {
  return left.startOffset < right.endOffset && right.startOffset < left.endOffset;
}
