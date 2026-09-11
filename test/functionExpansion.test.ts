import { describe, expect, it } from 'vitest';
import { isOpenableSourceScheme } from '../src/shared/functionExpansion.js';

describe('standard library source URIs', () => {
  it('treats rustup file URIs as openable source', () => {
    expect(isOpenableSourceScheme('file')).toBe(true);
    expect(isOpenableSourceScheme('vscode-remote')).toBe(true);
    expect(isOpenableSourceScheme('https')).toBe(false);
  });
});
