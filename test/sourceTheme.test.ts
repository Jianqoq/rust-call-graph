import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/webview/index.css'), 'utf8');

describe('Source Expansion token palette', () => {
  it('does not bind syntax colors to chart or symbol-icon theme keys', () => {
    expect(stylesheet).toMatch(/--graph-syntax-keyword:\s*var\(--vscode-editor-foreground/);
    expect(stylesheet).not.toMatch(/--graph-syntax-keyword:\s*var\(--vscode-charts-/);
    expect(stylesheet).not.toMatch(/\.source-semantic-keyword,[\s\S]*?color:\s*var\(--vscode-symbolIcon-keywordForeground/);
  });

  it('renders language-hover code without an inner rectangle', () => {
    const rule = /\.source-language-hover-code\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';

    expect(rule).toMatch(/background:\s*transparent/);
    expect(rule).toMatch(/border:\s*0/);
    expect(rule).toMatch(/border-radius:\s*0/);
    expect(rule).toMatch(/padding:\s*0/);
    expect(rule).toMatch(/white-space:\s*pre-wrap/);
    expect(rule).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('colors hover code fences with editor syntax colors instead of markdown preformat gold', () => {
    const rule = /\.source-language-hover-code\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
    const nested = /\.source-language-hover-code code\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';

    expect(rule).toMatch(/color:\s*var\(--vscode-editor-foreground/);
    expect(rule).not.toMatch(/textPreformat-foreground/);
    expect(nested).toMatch(/color:\s*inherit/);
  });

  it('colors matching brackets from the injected palette instead of possibly transparent webview variables', () => {
    expect(stylesheet).toMatch(/--graph-syntax-bracket1:\s*#ffd700/);
    expect(stylesheet).toMatch(/\.source-semantic-bracket2\s*\{[^}]*color:\s*var\(--graph-syntax-bracket2\)/);
    expect(stylesheet).not.toMatch(/editorBracketHighlight-foreground/);
  });

  it('does not give rust-analyzer method tokens a separate color class', () => {
    expect(stylesheet).not.toMatch(/source-semantic-method/);
  });

  it('colors macros separately from functions and namespaces separately from types', () => {
    expect(stylesheet).toMatch(/--graph-syntax-macro:/);
    expect(stylesheet).toMatch(/--graph-syntax-namespace:\s*var\(--vscode-editor-foreground/);
    expect(stylesheet).toMatch(/color:\s*var\(--graph-syntax-namespace\)/);
    expect(stylesheet).not.toMatch(/source-semantic-module \{\s*color:\s*var\(--graph-syntax-type\)/);
  });

  it('colors Ok/Err/Some/None with the generic type gold, not the Rust struct cyan', () => {
    expect(stylesheet).toMatch(/--graph-syntax-enum-member:/);
    expect(stylesheet).toMatch(/source-semantic-enum-member \{\s*color:\s*var\(--graph-syntax-enum-member\)/);
    expect(stylesheet).not.toMatch(/source-semantic-enum-member \{\s*color:\s*var\(--graph-syntax-type\)/);
    expect(stylesheet).not.toMatch(/source-semantic-enum-member \{\s*color:\s*var\(--graph-syntax-number\)/);
  });

  it('underlines only the hovered definition target while the modifier is held', () => {
    expect(stylesheet).toMatch(/\.is-definition-modifier \.source-hover-anchor\.is-definition-target:hover/);
    expect(stylesheet).not.toMatch(/\.is-definition-modifier \.source-hover-anchor \{/);
  });
});
