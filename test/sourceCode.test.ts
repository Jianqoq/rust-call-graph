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

  it('adds lexical Rust colors when the semantic provider omits keywords and literals', () => {
    const text = 'pub async fn load() { let ready = true; return ready; }';
    const nameStart = text.indexOf('load');
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: [{
        startOffset: nameStart,
        endOffset: nameStart + 'load'.length,
        tokenType: 'function',
        modifiers: ['declaration']
      }]
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: 'pub', tokenType: 'keyword' },
      { text: 'async', tokenType: 'keyword' },
      { text: 'fn', tokenType: 'keyword' },
      { text: 'let', tokenType: 'keyword' },
      { text: 'true', tokenType: 'boolean' },
      { text: 'return', tokenType: 'keyword' }
    ]));
  });

  it('does not treat keywords inside comments or strings as code', () => {
    const text = '// fn return\nlet message = "async false";';
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: '// fn return', tokenType: 'comment' },
      { text: 'let', tokenType: 'keyword' },
      { text: '"async false"', tokenType: 'string' }
    ]));
    expect(renderedTokens).not.toEqual(expect.arrayContaining([
      { text: 'async', tokenType: 'keyword' },
      { text: 'false', tokenType: 'boolean' }
    ]));
  });

  it('distinguishes Rust lifetimes from character literals', () => {
    const text = "fn borrow<'a>(value: &'a str) -> char { 'x' }";
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: "'a", tokenType: 'lifetime' },
      { text: "'x'", tokenType: 'string' }
    ]));
  });

  it('does not color the keyword portion of a raw identifier', () => {
    const source: FunctionSourceDto = {
      text: 'let r#type = 1;',
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: 'let', tokenType: 'keyword' },
      { text: '1', tokenType: 'number' }
    ]));
    expect(renderedTokens).not.toContainEqual({ text: 'type', tokenType: 'keyword' });
  });

  it('colors hover-like Rust signatures with keywords, bindings, functions, and types', () => {
    const source: FunctionSourceDto = {
      text: 'let manifest: BTreeMap<String, String> = pub(crate) fn inspect() -> anyhow::Result<()>',
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: 'let', tokenType: 'keyword' },
      { text: 'manifest', tokenType: 'variable' },
      { text: 'BTreeMap', tokenType: 'type' },
      { text: 'String', tokenType: 'type' },
      { text: 'fn', tokenType: 'keyword' },
      { text: 'inspect', tokenType: 'function' },
      { text: 'Result', tokenType: 'type' }
    ]));
  });

  it('keeps rust-analyzer parameter tokens so they can share the editor variable color', () => {
    const text = 'fn load(source: &str) { source.lines().map(|line| line); }';
    const sourceStart = text.indexOf('source');
    const lineStart = text.indexOf('|line|') + 1;
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: [
        { startOffset: sourceStart, endOffset: sourceStart + 6, tokenType: 'parameter', modifiers: ['declaration'] },
        { startOffset: lineStart, endOffset: lineStart + 4, tokenType: 'parameter', modifiers: [] }
      ]
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: 'source', tokenType: 'parameter' },
      { text: 'line', tokenType: 'parameter' }
    ]));
  });

  it('applies editor bracket-pair depths to matching parentheses', () => {
    const source: FunctionSourceDto = {
      text: 'fn load() { f(g()); }',
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens.filter(item => item.text === '(').map(item => item.tokenType)).toEqual([
      'bracket1',
      'bracket2',
      'bracket3'
    ]);
  });

  it('does not color brackets inside strings', () => {
    const text = 'fn load() { let message = "(ok)"; }';
    const inner = text.indexOf('(ok)');
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: []
    };
    const covering = buildSourceLines(source).flatMap(line => line.segments.filter(segment =>
      segment.startOffset <= inner && segment.endOffset > inner
    ));
    expect(covering.map(segment => (segment as { semanticToken?: { tokenType: string } }).semanticToken?.tokenType)).toEqual(['string']);
  });

  it('colors closure pipes and logical operators instead of leaving them as punctuation', () => {
    const text = 'fn load(source: &str) { source.lines().map(|line| line.len() == 0 || false); }';
    const pipe = text.indexOf('|line|');
    const or = text.indexOf('||');
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: [
        { startOffset: pipe, endOffset: pipe + 1, tokenType: 'punctuation', modifiers: [] },
        { startOffset: pipe + 5, endOffset: pipe + 6, tokenType: 'punctuation', modifiers: [] }
      ]
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens).toEqual(expect.arrayContaining([
      { text: '|', tokenType: 'operator' },
      { text: '||', tokenType: 'operator' },
      { text: '==', tokenType: 'operator' },
      { text: '&', tokenType: 'operator' }
    ]));
    expect(text.slice(or, or + 2)).toBe('||');
  });

  it('keeps empty call parentheses as matching bracket depths even when rust-analyzer spans both', () => {
    const text = 'fn load() { lines(); }';
    const signature = text.indexOf('()');
    const call = text.indexOf('lines()') + 'lines'.length;
    const source: FunctionSourceDto = {
      text,
      startLine: 0,
      startCharacter: 0,
      relationships: [],
      semanticTokens: [
        { startOffset: signature, endOffset: signature + 2, tokenType: 'parenthesis', modifiers: [] },
        { startOffset: call, endOffset: call + 2, tokenType: 'parenthesis', modifiers: [] }
      ]
    };

    const renderedTokens = buildSourceLines(source).flatMap(line => line.segments.flatMap(segment => {
      const semanticToken = (segment as { semanticToken?: { tokenType: string } }).semanticToken;
      return semanticToken === undefined ? [] : [{ text: segment.text, tokenType: semanticToken.tokenType }];
    }));

    expect(renderedTokens.filter(item => item.text === '(').map(item => item.tokenType)).toEqual([
      'bracket1',
      'bracket2'
    ]);
    expect(renderedTokens.filter(item => item.text === ')').map(item => item.tokenType)).toEqual([
      'bracket1',
      'bracket2'
    ]);
  });
});
