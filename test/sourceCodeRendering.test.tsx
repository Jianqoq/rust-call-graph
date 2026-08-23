import { ReactFlowProvider } from '@xyflow/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeActions } from '../src/webview/graphTypes.js';
import { SourceCode } from '../src/webview/SourceCode.js';

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
  clearSourceHover: vi.fn()
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
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

    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('struct Widget')).toBeTruthy();
    expect(screen.getByText('workspace type')).toBeTruthy();
    expect(screen.getByText('Copy')).toBeTruthy();
  });
});
