import type { SyntaxPaletteDto } from '../shared/protocol.js';
import { SYNTAX_PALETTE_KEYS } from '../shared/syntaxPalette.js';

export function applySyntaxPalette(palette: SyntaxPaletteDto): void {
  const root = document.documentElement;
  for (const key of SYNTAX_PALETTE_KEYS) {
    root.style.setProperty(`--graph-syntax-${key}`, palette[key]);
  }
}
