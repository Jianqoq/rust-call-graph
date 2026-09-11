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
const PRIMITIVE_TYPES = new Set([
  'bool', 'char', 'f32', 'f64', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
  'str', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize'
]);
const FN_PREFIX_KEYWORDS = new Set(['async', 'const', 'extern', 'pub', 'safe', 'unsafe']);
const BINDING_KEYWORDS = new Set(['const', 'let', 'static']);

const PUNCTUATION_TOKEN_TYPES = new Set([
  'punctuation', 'colon', 'comma', 'semicolon', 'dot',
  'parenthesis', 'brace', 'bracket', 'angle'
]);

const OPERATOR_LEXEMES = [
  '<<=', '>>=', '||=', '&&=', '..=',
  '==', '!=', '<=', '>=', '&&', '||',
  '<<', '>>', '->', '=>', '::', '..',
  '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=',
  '|', '&', '^', '!', '?', '=', '+', '-', '*', '/', '%', '@'
];

export function withRustSyntaxFallbacks(
  text: string,
  semanticTokens: readonly SourceSemanticTokenDto[]
): readonly SourceSemanticTokenDto[] {
  const fallbacks = rustSyntaxFallbackTokens(text).filter(candidate =>
    !semanticTokens.some(item => rangesOverlap(candidate, item))
  );
  return overlayOperatorTokens(
    text,
    overlayBracketPairTokens(text, [...semanticTokens, ...fallbacks])
  );
}

export function coveringSemanticToken(
  tokens: readonly SourceSemanticTokenDto[],
  startOffset: number,
  endOffset: number
): SourceSemanticTokenDto | undefined {
  let best: { readonly token: SourceSemanticTokenDto; readonly index: number } | undefined;
  for (const [index, token] of tokens.entries()) {
    if (token.startOffset > startOffset || token.endOffset < endOffset) {
      continue;
    }
    const length = token.endOffset - token.startOffset;
    const bestLength = best === undefined ? undefined : best.token.endOffset - best.token.startOffset;
    if (
      best === undefined
      || length < (bestLength ?? length)
      || (length === bestLength && (token.startOffset > best.token.startOffset || (token.startOffset === best.token.startOffset && index >= best.index)))
    ) {
      best = { token, index };
    }
  }
  return best?.token;
}

export function rustSyntaxFallbackTokens(text: string): readonly SourceSemanticTokenDto[] {
  const tokens: SourceSemanticTokenDto[] = [];
  let index = 0;
  let expectFunctionName = false;
  let expectVariableName = false;

  while (index < text.length) {
    const commentEnd = scanComment(text, index);
    if (commentEnd !== undefined) {
      tokens.push(token(index, commentEnd, 'comment'));
      expectFunctionName = false;
      expectVariableName = false;
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
      expectFunctionName = false;
      expectVariableName = false;
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
      expectFunctionName = false;
      expectVariableName = false;
      index = end;
      continue;
    }

    const identifier = IDENTIFIER.exec(text.slice(index))?.[0];
    if (identifier !== undefined) {
      const end = index + identifier.length;
      if (identifier === 'true' || identifier === 'false') {
        tokens.push(token(index, end, 'boolean'));
        expectFunctionName = false;
        expectVariableName = false;
      } else if (identifier === 'self') {
        tokens.push(token(index, end, 'selfKeyword'));
        expectFunctionName = false;
        expectVariableName = false;
      } else if (identifier === 'Self' || RUST_KEYWORDS.has(identifier)) {
        tokens.push(token(index, end, 'keyword'));
        if (identifier === 'fn') {
          expectFunctionName = true;
          expectVariableName = false;
        } else if (BINDING_KEYWORDS.has(identifier)) {
          expectFunctionName = false;
          expectVariableName = true;
        } else if (identifier !== 'mut' && !FN_PREFIX_KEYWORDS.has(identifier)) {
          expectFunctionName = false;
          expectVariableName = false;
        }
      } else if (expectFunctionName) {
        tokens.push(token(index, end, 'function'));
        expectFunctionName = false;
        expectVariableName = false;
      } else if (expectVariableName) {
        tokens.push(token(index, end, 'variable'));
        expectFunctionName = false;
        expectVariableName = false;
      } else if (PRIMITIVE_TYPES.has(identifier) || isTypeLikeIdentifier(identifier)) {
        tokens.push(token(index, end, 'type'));
      }
      index = end;
      continue;
    }

    const character = text[index] ?? '';
    if (!/\s/u.test(character)) {
      expectFunctionName = false;
      expectVariableName = false;
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

function overlayBracketPairTokens(
  text: string,
  tokens: readonly SourceSemanticTokenDto[]
): readonly SourceSemanticTokenDto[] {
  const brackets = rustBracketPairTokens(text);
  if (brackets.length === 0) {
    return sortTokens(tokens);
  }
  const kept = tokens.filter(item => !brackets.some(bracket =>
    rangesOverlap(item, bracket) && (PUNCTUATION_TOKEN_TYPES.has(item.tokenType) || tokenSpanEquals(item, bracket))
  ));
  return sortTokens([...kept, ...brackets]);
}

function overlayOperatorTokens(
  text: string,
  tokens: readonly SourceSemanticTokenDto[]
): readonly SourceSemanticTokenDto[] {
  const operators = rustOperatorTokens(text);
  if (operators.length === 0) {
    return sortTokens(tokens);
  }
  const kept = tokens.filter(item => !operators.some(operator =>
    rangesOverlap(item, operator) && PUNCTUATION_TOKEN_TYPES.has(item.tokenType)
  ));
  const extra = operators.filter(operator =>
    !kept.some(item => tokenSpanEquals(item, operator))
  );
  return sortTokens([...kept, ...extra]);
}

function rustOperatorTokens(text: string): readonly SourceSemanticTokenDto[] {
  const skipped = skippedOffsets(text);
  const tokens: SourceSemanticTokenDto[] = [];
  for (let index = 0; index < text.length; ) {
    if (skipped.has(index)) {
      index += 1;
      continue;
    }
    const lexeme = OPERATOR_LEXEMES.find(candidate => text.startsWith(candidate, index));
    if (lexeme === undefined) {
      index += 1;
      continue;
    }
    tokens.push(token(index, index + lexeme.length, 'operator'));
    index += lexeme.length;
  }
  return tokens;
}

function rustBracketPairTokens(text: string): readonly SourceSemanticTokenDto[] {
  const skipped = skippedOffsets(text);
  const tokens: SourceSemanticTokenDto[] = [];
  const stack: number[] = [];
  const pairs: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' };

  for (let index = 0; index < text.length; index += 1) {
    if (skipped.has(index)) {
      continue;
    }
    const character = text[index] ?? '';
    if (character === '(' || character === '[' || character === '{') {
      const depth = (stack.length % 6) + 1;
      stack.push(depth);
      tokens.push(token(index, index + 1, `bracket${depth}`));
      continue;
    }
    if (pairs[character] === undefined) {
      continue;
    }
    const depth = stack.pop() ?? 1;
    tokens.push(token(index, index + 1, `bracket${depth}`));
  }
  return tokens;
}

function skippedOffsets(text: string): Set<number> {
  const skipped = new Set<number>();
  for (const item of rustSyntaxFallbackTokens(text)) {
    if (item.tokenType !== 'string' && item.tokenType !== 'comment') {
      continue;
    }
    for (let index = item.startOffset; index < item.endOffset; index += 1) {
      skipped.add(index);
    }
  }
  return skipped;
}

function isTypeLikeIdentifier(identifier: string): boolean {
  const first = [...identifier][0];
  if (first === undefined || first.toUpperCase() !== first || first.toLowerCase() === first) {
    return false;
  }
  return identifier.length === 1 || /[\p{Ll}]/u.test(identifier);
}

function token(startOffset: number, endOffset: number, tokenType: string): SourceSemanticTokenDto {
  return { startOffset, endOffset, tokenType, modifiers: [] };
}

function sortTokens(tokens: readonly SourceSemanticTokenDto[]): SourceSemanticTokenDto[] {
  return [...tokens].sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
}

function tokenSpanEquals(left: SourceSemanticTokenDto, right: SourceSemanticTokenDto): boolean {
  return left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function rangesOverlap(left: SourceSemanticTokenDto, right: SourceSemanticTokenDto): boolean {
  return left.startOffset < right.endOffset && right.startOffset < left.endOffset;
}
