import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  overlayEditorColorCustomizations,
  paletteFromResolvedTheme,
  resolveThemeTokens
} from '../src/extension/themeTokenColors.js';
import { FALLBACK_SYNTAX_PALETTE } from '../src/shared/syntaxPalette.js';

describe('active VS Code theme syntax palette', () => {
  it('reads Atom One Dark Rust scopes from the current theme file', () => {
    const palette = paletteFromResolvedTheme({
      rules: [
        { scopes: ['keyword'], foreground: '#C678DD' },
        { scopes: ['entity.name.function'], foreground: '#61AFEF' },
        { scopes: ['entity.name.type'], foreground: '#E5C07B' },
        { scopes: ['entity.name.type.rust'], foreground: '#56B6C2' },
        { scopes: ['variable'], foreground: '#E06C75' },
        { scopes: ['variable.parameter'], foreground: '#ABB2BF' },
        { scopes: ['string'], foreground: '#98C379' },
        { scopes: ['constant.numeric'], foreground: '#D19A66' },
        { scopes: ['comment'], foreground: '#5C6370' },
        { scopes: ['meta.attribute.rust'], foreground: '#D19A66' },
        { scopes: ['entity.name.lifetime.rust'], foreground: '#D19A66' }
      ],
      semantic: {},
      colors: {}
    });

    expect(palette.keyword).toBe('#C678DD');
    expect(palette.function).toBe('#61AFEF');
    expect(palette.type).toBe('#56B6C2');
    expect(palette.variable).toBe('#E06C75');
    expect(palette.parameter).toBe('#E06C75');
    expect(palette.string).toBe('#98C379');
  });

  it('prefers the later included theme file and semantic token colors', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rust-call-graph-theme-'));
    writeFileSync(path.join(root, 'base.json'), JSON.stringify({
      tokenColors: [{ scope: 'keyword', settings: { foreground: '#111111' } }]
    }));
    writeFileSync(path.join(root, 'theme.json'), JSON.stringify({
      include: './base.json',
      tokenColors: [{ scope: 'keyword', settings: { foreground: '#C678DD' } }],
      semanticTokenColors: { function: '#61AFEF' }
    }));

    const theme = resolveThemeTokens(
      path.join(root, 'theme.json'),
      filePath => readFileSync(filePath, 'utf8'),
      path.dirname,
      path.join
    );
    const palette = paletteFromResolvedTheme(theme);

    expect(palette.keyword).toBe('#C678DD');
    expect(palette.function).toBe('#61AFEF');
  });

  it('applies workbench token color customizations for the active theme', () => {
    const palette = overlayEditorColorCustomizations(
      FALLBACK_SYNTAX_PALETTE,
      'Atom One Dark',
      {
        keywords: '#ff0000',
        '[Atom One Dark]': {
          functions: '#00ff00'
        }
      },
      {
        rules: {
          variable: '#0000ff'
        }
      }
    );

    expect(palette.keyword).toBe('#ff0000');
    expect(palette.function).toBe('#00ff00');
    expect(palette.variable).toBe('#0000ff');
  });

  it('does not let language-specific descendant selectors steal generic token colors', () => {
    const palette = paletteFromResolvedTheme({
      rules: [
        { scopes: ['variable'], foreground: '#E06C75' },
        { scopes: ['meta.array.literal.js variable', 'meta.array.literal.ts variable'], foreground: '#E5C07B' },
        { scopes: ['entity.name.function'], foreground: '#61AFEF' },
        { scopes: ['ng.interpolation function'], foreground: '#E06C75' }
      ],
      semantic: {},
      colors: {}
    });

    expect(palette.variable).toBe('#E06C75');
    expect(palette.function).toBe('#61AFEF');
  });

  it('uses theme bracket-pair colors and ignores near-transparent ones', () => {
    const palette = paletteFromResolvedTheme({
      rules: [],
      semantic: {},
      colors: {
        'editorBracketHighlight.foreground1': '#E06C75',
        'editorBracketHighlight.foreground2': '#ABB2BF26'
      }
    });

    expect(palette.bracket1).toBe('#E06C75');
    expect(palette.bracket2).toBe('#DA70D6');
  });
});
