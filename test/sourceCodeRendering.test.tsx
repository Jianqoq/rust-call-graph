import { ReactFlowProvider } from '@xyflow/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeActions } from '../src/webview/graphTypes.js';
import { SourceCode } from '../src/webview/SourceCode.js';

const reactFlowMocks = vi.hoisted(() => ({
  updateNodeInternals: vi.fn()
}));

vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  useUpdateNodeInternals: () => reactFlowMocks.updateNodeInternals
}));

const defaultResizeObserver = globalThis.ResizeObserver;

const actions: NodeActions = {
  toggleSource: vi.fn(),
  toggleFunctionDirection: vi.fn(),
  expandType: vi.fn(),
  openSource: vi.fn(),
  focusNode: vi.fn(),
  goBack: vi.fn(),
  hoverRelationship: vi.fn(),
  pinRelationship: vi.fn(),
  followRelationship: vi.fn(),
  requestSourceHover: vi.fn(),
  openDefinition: vi.fn(),
  clearSourceHover: vi.fn()
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: defaultResizeObserver,
    writable: true
  });
  document.querySelector('.source-language-hover')?.remove();
});

describe('SourceCode relationship rendering', () => {
  it('renders a qualified Rust path without icon spacing and highlights only its function name', () => {
    const text = 'fn load() { std::fs::read_to_string("input")?; }';
    const nameStart = text.indexOf('read_to_string');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:load"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [],
            relationships: [{
              id: 'source:read',
              edgeId: 'edge:read',
              kind: 'call',
              startOffset: nameStart,
              endOffset: nameStart + 'read_to_string'.length,
              targetNodeId: 'fn:read_to_string',
              label: 'read_to_string'
            }]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    const relationship = screen.getByRole('button', { name: /Call to read_to_string/ });
    expect(relationship.textContent).toBe('read_to_string');
    expect(relationship.querySelector('svg')).toBeNull();
    expect(screen.getByText((_content, element) =>
      element?.classList.contains('source-line-content') === true
      && element.textContent?.includes('std::fs::read_to_string') === true
    )).toBeTruthy();
  });

  it('requests rust-analyzer hover without replacing relationship hover or click behavior', () => {
    vi.useFakeTimers();
    const text = 'fn load() { validate_order(); }';
    const nameStart = text.indexOf('validate_order');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:load"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [{ startOffset: nameStart, endOffset: nameStart + 14, tokenType: 'function', modifiers: [] }],
            relationships: [{
              id: 'source:validate',
              edgeId: 'edge:validate',
              kind: 'call',
              startOffset: nameStart,
              endOffset: nameStart + 14,
              targetNodeId: 'fn:validate_order',
              label: 'validate_order'
            }]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    const relationship = screen.getByRole('button', { name: /Call to validate_order/ });
    fireEvent.mouseEnter(relationship);
    act(() => vi.advanceTimersByTime(321));

    expect(actions.hoverRelationship).toHaveBeenCalledWith({
      edgeId: 'edge:validate',
      originNodeId: 'fn:load',
      targetNodeId: 'fn:validate_order'
    });
    expect(actions.requestSourceHover).toHaveBeenCalledWith('fn:load', nameStart);

    fireEvent.click(relationship);
    expect(actions.pinRelationship).toHaveBeenCalledWith({
      edgeId: 'edge:validate',
      originNodeId: 'fn:load',
      targetNodeId: 'fn:validate_order'
    });
  });

  it('opens rust-analyzer definitions with Ctrl+click on variables and call names', () => {
    const text = 'fn load(source: &str) { source.lines(); }';
    const variableStart = text.indexOf('source.lines');
    const callStart = text.indexOf('lines');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:load"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [
              { startOffset: variableStart, endOffset: variableStart + 6, tokenType: 'variable', modifiers: [] },
              { startOffset: callStart, endOffset: callStart + 5, tokenType: 'function', modifiers: [] }
            ],
            relationships: [{
              id: 'source:lines',
              edgeId: 'edge:lines',
              kind: 'call',
              startOffset: callStart,
              endOffset: callStart + 5,
              targetNodeId: 'fn:lines',
              label: 'lines'
            }]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    fireEvent.click(screen.getByText((_content, element) =>
      element?.classList.contains('source-hover-anchor') === true
      && element.textContent === 'source'
    ), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /Call to lines/ }), { ctrlKey: true });

    expect(actions.openDefinition).toHaveBeenCalledWith('fn:load', variableStart);
    expect(actions.openDefinition).toHaveBeenCalledWith('fn:load', callStart);
    expect(actions.pinRelationship).not.toHaveBeenCalled();
  });

  it('does not mark keywords, operators, or brackets as definition targets', () => {
    const text = 'fn tally() { amount + 1 }';
    const { container } = render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:tally"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [],
            relationships: []
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    const anchor = (value: string) =>
      [...container.querySelectorAll('.source-hover-anchor')].find(node => node.textContent === value);

    expect(anchor('fn')?.classList.contains('is-definition-target')).toBe(false);
    expect(anchor('tally')?.classList.contains('is-definition-target')).toBe(true);
    expect(anchor('+')?.classList.contains('is-definition-target')).toBe(false);
    expect(anchor('(')?.classList.contains('is-definition-target')).toBe(false);
  });

  it('does not add a goto-definition underline on methods or Option variants', () => {
    const text = 'fn tally() { Some(manifest.join(path)) }';
    const joinStart = text.indexOf('join');
    const someStart = text.indexOf('Some');
    const { container } = render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:tally"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [
              { startOffset: someStart, endOffset: someStart + 4, tokenType: 'enumMember', modifiers: [] },
              { startOffset: joinStart, endOffset: joinStart + 4, tokenType: 'method', modifiers: [] }
            ],
            relationships: [{
              id: 'source:join',
              edgeId: 'edge:join',
              kind: 'call',
              startOffset: joinStart,
              endOffset: joinStart + 4,
              targetNodeId: 'fn:join',
              label: 'join'
            }]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    const anchor = (value: string) =>
      [...container.querySelectorAll('.source-hover-anchor')].find(node => node.textContent === value);

    expect(anchor('Some')?.classList.contains('is-definition-target')).toBe(false);
    expect(anchor('join')?.classList.contains('is-definition-target')).toBe(false);
    expect(anchor('join')?.querySelector('.source-relationship-call')).not.toBeNull();
  });

  it('renders safe VS Code-style code and documentation blocks for the active token', () => {
    const text = 'fn load(value: Widget) {}';
    const tokenStart = text.indexOf('Widget');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:load"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [{ startOffset: tokenStart, endOffset: tokenStart + 6, tokenType: 'struct', modifiers: [] }],
            relationships: []
          }}
          sourceHover={{
            nodeId: 'fn:load',
            sourceOffset: tokenStart,
            blocks: [
              { kind: 'code', language: 'rust', value: 'struct Widget' },
              { kind: 'markdown', value: 'A **workspace type** with `Copy` semantics.' }
            ]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    fireEvent.mouseEnter(screen.getByText('Widget').closest('.source-hover-anchor') as HTMLElement);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.querySelector('.source-language-hover-code')?.textContent).toBe('struct Widget');
    expect(tooltip.querySelector('.source-semantic-keyword')?.textContent).toBe('struct');
    expect(tooltip.querySelector('.source-semantic-type')?.textContent).toBe('Widget');
    expect(screen.getByText('workspace type')).toBeTruthy();
    expect(screen.getByText('Copy')).toBeTruthy();
  });

  it('syntax-highlights hover Rust code instead of rendering it as one preformat color', () => {
    const text = 'fn load(manifest: BTreeMap<String, String>) {}';
    const tokenStart = text.indexOf('manifest');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:load"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [{ startOffset: tokenStart, endOffset: tokenStart + 8, tokenType: 'variable', modifiers: [] }],
            relationships: []
          }}
          sourceHover={{
            nodeId: 'fn:load',
            sourceOffset: tokenStart,
            blocks: [
              { kind: 'code', language: 'rust', value: 'let manifest: BTreeMap<String, String>' }
            ]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    fireEvent.mouseEnter(screen.getByText((_content, element) =>
      element?.classList.contains('source-hover-anchor') === true
      && element.textContent === 'manifest'
    ));

    const tooltip = screen.getByRole('tooltip');
    const highlighted = [...tooltip.querySelectorAll('[class*="source-semantic-"]')].map(node => ({
      text: node.textContent,
      className: node.className
    }));
    expect(highlighted).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'let', className: expect.stringContaining('source-semantic-keyword') }),
      expect.objectContaining({ text: 'manifest', className: expect.stringContaining('source-semantic-variable') }),
      expect.objectContaining({ text: 'BTreeMap', className: expect.stringContaining('source-semantic-type') }),
      expect.objectContaining({ text: 'String', className: expect.stringContaining('source-semantic-type') })
    ]));
  });

  it('matches native VS Code hover chrome without provider or language labels', () => {
    const text = 'fn inspect() {}';
    const tokenStart = text.indexOf('inspect');
    render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:inspect"
          source={{
            text,
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [{ startOffset: tokenStart, endOffset: tokenStart + 7, tokenType: 'function', modifiers: [] }],
            relationships: []
          }}
          sourceHover={{
            nodeId: 'fn:inspect',
            sourceOffset: tokenStart,
            blocks: [
              { kind: 'markdown', value: '```rust\nengine_worker::backtest_exchange\n```' },
              { kind: 'markdown', value: '```rust\npub(crate) fn inspect() -> anyhow::Result<()>\n```' },
              { kind: 'markdown', value: 'Go to [Result](command:show)' }
            ]
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );

    fireEvent.mouseEnter(screen.getByText('inspect').closest('.source-hover-anchor') as HTMLElement);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.querySelector('.source-language-hover-label')).toBeNull();
    expect(tooltip.querySelector('.source-language-hover-language')).toBeNull();
    expect(tooltip.querySelectorAll('.source-language-hover-code')).toHaveLength(1);
  });

  it('does not recursively remeasure React Flow from its source ResizeObserver', () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | undefined;
    let resizeObserver: ResizeObserver | undefined;
    class CapturingResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
        resizeObserver = this;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', {
      value: CapturingResizeObserver,
      writable: true
    });

    const { container } = render(
      <ReactFlowProvider>
        <SourceCode
          nodeId="fn:inspect"
          source={{
            text: 'fn inspect() {}',
            startLine: 0,
            startCharacter: 0,
            semanticTokens: [],
            relationships: []
          }}
          actions={actions}
        />
      </ReactFlowProvider>
    );
    act(() => vi.advanceTimersByTime(20));
    reactFlowMocks.updateNodeInternals.mockClear();

    act(() => {
      resizeCallback?.([], resizeObserver as ResizeObserver);
      vi.advanceTimersByTime(20);
    });
    expect(reactFlowMocks.updateNodeInternals).not.toHaveBeenCalled();

    fireEvent.scroll(container.querySelector('.source-shell') as HTMLElement);
    act(() => vi.advanceTimersByTime(20));
    expect(reactFlowMocks.updateNodeInternals).toHaveBeenCalledWith('fn:inspect');
  });
});
