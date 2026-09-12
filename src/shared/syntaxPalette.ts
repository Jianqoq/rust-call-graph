import type { SyntaxPaletteDto } from './protocol.js';

export const DARK_BRACKET_PALETTE = {
  bracket1: '#FFD700',
  bracket2: '#DA70D6',
  bracket3: '#179FFF',
  bracket4: '#FFD700',
  bracket5: '#DA70D6',
  bracket6: '#179FFF'
} as const;

export const LIGHT_BRACKET_PALETTE = {
  bracket1: '#0431FA',
  bracket2: '#319331',
  bracket3: '#7B3814',
  bracket4: '#0431FA',
  bracket5: '#319331',
  bracket6: '#7B3814'
} as const;

/** Used only when the active VS Code theme file cannot be resolved. */
export const FALLBACK_SYNTAX_PALETTE: SyntaxPaletteDto = {
  keyword: '#569CD6',
  function: '#DCDCAA',
  type: '#4EC9B0',
  variable: '#9CDCFE',
  parameter: '#9CDCFE',
  string: '#CE9178',
  number: '#B5CEA8',
  comment: '#6A9955',
  attribute: '#DCDCAA',
  lifetime: '#4EC9B0',
  operator: '#D4D4D4',
  macro: '#DCDCAA',
  namespace: '#D4D4D4',
  enumMember: '#E5C07B',
  builtinType: '#E5C07B',
  constant: '#D19A66',
  ...DARK_BRACKET_PALETTE
};

export const SYNTAX_TOKEN_KEYS = [
  'keyword',
  'function',
  'type',
  'variable',
  'parameter',
  'string',
  'number',
  'comment',
  'attribute',
  'lifetime',
  'operator',
  'macro',
  'namespace',
  'enumMember',
  'builtinType',
  'constant'
] as const;

export const SYNTAX_BRACKET_KEYS = [
  'bracket1',
  'bracket2',
  'bracket3',
  'bracket4',
  'bracket5',
  'bracket6'
] as const;

export const SYNTAX_PALETTE_KEYS = [
  ...SYNTAX_TOKEN_KEYS,
  ...SYNTAX_BRACKET_KEYS
] as const satisfies readonly (keyof SyntaxPaletteDto)[];

export type SyntaxTokenKey = typeof SYNTAX_TOKEN_KEYS[number];
export type SyntaxBracketKey = typeof SYNTAX_BRACKET_KEYS[number];

export function syntaxCssVariable(key: keyof SyntaxPaletteDto): string {
  return `--graph-syntax-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

export function isSafeCssColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
    || /^rgba?\(\s*[\d.]+%?(?:\s*,\s*[\d.]+%?){2,3}\s*\)$/.test(value);
}

/** Rejects fully transparent or near-transparent colors that would hide glyphs. */
export function isVisibleHighlightColor(value: string): boolean {
  if (!isSafeCssColor(value)) {
    return false;
  }
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const alphaHex = hex.length === 4 ? hex[3] : hex.length === 8 ? hex.slice(6, 8) : undefined;
    if (alphaHex !== undefined) {
      const alpha = Number.parseInt(alphaHex.padEnd(2, alphaHex), 16) / 255;
      return alpha >= 0.4;
    }
    return true;
  }
  const rgba = /^rgba?\(\s*[\d.]+%?(?:\s*,\s*[\d.]+%?){2}(?:\s*,\s*([\d.]+%?))?\s*\)$/.exec(value);
  const alphaToken = rgba?.[1];
  if (alphaToken === undefined) {
    return true;
  }
  const alpha = alphaToken.endsWith('%')
    ? Number.parseFloat(alphaToken) / 100
    : Number.parseFloat(alphaToken);
  return Number.isFinite(alpha) && alpha >= 0.4;
}
