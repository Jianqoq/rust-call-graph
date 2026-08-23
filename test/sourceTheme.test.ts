import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/webview/index.css'), 'utf8');

describe('Source Expansion token palette', () => {
  it('uses graph syntax colors instead of symbol-icon colors for Rust keywords', () => {
    expect(stylesheet).toContain('--graph-syntax-keyword:');
    expect(stylesheet).toMatch(/\.source-semantic-keyword,[\s\S]*?color:\s*var\(--graph-syntax-keyword\)/);
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
});
