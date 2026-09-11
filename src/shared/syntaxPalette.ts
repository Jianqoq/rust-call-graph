import type { SyntaxPaletteDto } from './protocol.js';

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
  lifetime: '#4EC9B0'
};

export const SYNTAX_PALETTE_KEYS = [
  'keyword',
  'function',
  'type',
  'variable',
  'parameter',
  'string',
  'number',
  'comment',
  'attribute',
  'lifetime'
] as const satisfies readonly (keyof SyntaxPaletteDto)[];

export function isSafeCssColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
    || /^rgba?\(\s*[\d.]+%?(?:\s*,\s*[\d.]+%?){2,3}\s*\)$/.test(value);
}
