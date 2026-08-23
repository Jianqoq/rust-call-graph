import { describe, expect, it } from 'vitest';
import type { FunctionSourceDto } from '../src/shared/protocol.js';
import { buildSourceLines, clampedSourceHandleRightInset } from '../src/webview/SourceCode.js';

describe('source relationship handle geometry', () => {
  it('moves an overflowing long-name handle back to the source viewport boundary', () => {
    expect(clampedSourceHandleRightInset(-5, 1101, 920, 0.5)).toBe(357);
  });

  it('keeps a handle at its function token when it already fits', () => {
    expect(clampedSourceHandleRightInset(-5, 618, 920, 0.5)).toBe(-5);
  });
});

describe('buildSourceLines', () => {
  it('keeps two calls to one function as independently addressable source ranges', () => {
    const text = 'fn root() {\n    target();\n    target();\n}';
    const first = text.indexOf('target');
    const second = text.indexOf('target', first + 1);
    const source: FunctionSourceDto = {
      text,
      startLine: 9,
      startCharacter: 0,
      semanticTokens: [],
      relationships: [
        { id: 'first', edgeId: 'first-edge', kind: 'call', startOffset: first, endOffset: first + 6, targetNodeId: 'target', label: 'target' },
        { id: 'second', edgeId: 'second-edge', kind: 'call', startOffset: second, endOffset: second + 6, targetNodeId: 'target', label: 'target' }
      ]
    };

    const lines = buildSourceLines(source);
    const relationships = lines.flatMap(line => line.segments.flatMap(segment => segment.relationship ?? []));
    expect(lines.map(line => line.number)).toEqual([10, 11, 12, 13]);
    expect(relationships.map(item => item.edgeId)).toEqual(['first-edge', 'second-edge']);
  });

  it('preserves rust-analyzer semantic token types while segmenting source', () => {
    const text = 'fn root(value: usize) -> usize { value + 1 }';
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: [
        { startOffset: 0, endOffset: 2, tokenType: 'keyword', modifiers: [] },
        { startOffset: 3, endOffset: 7, tokenType: 'function', modifiers: ['declaration'] },
        { startOffset: 8, endOffset: 13, tokenType: 'parameter', modifiers: ['declaration'] }
      ]
    };

    const lines = buildSourceLines(source);
    const tokenTypes = lines.flatMap(line => line.segments.flatMap(segment =>
      (segment as { semanticToken?: { tokenType: string } }).semanticToken?.tokenType ?? []
    ));

    expect(tokenTypes).toEqual(expect.arrayContaining(['keyword', 'function', 'parameter']));
  });
});
