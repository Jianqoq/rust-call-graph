import { describe, expect, it } from 'vitest';
import type { FunctionNodeDto, GraphEdgeDto } from '../src/shared/protocol.js';
import { edgeIsVisible, edgeSourceHandleId, nodeHoverEdgeTarget } from '../src/webview/edgeVisibility.js';

const position = { line: 0, character: 0 };
const range = { start: position, end: position };

function functionNode(expanded: boolean): FunctionNodeDto {
  return {
    kind: 'function',
    id: 'fn:root',
    label: 'root',
    detail: 'fn root()',
    symbolKind: 11,
    uri: 'file:///root.rs',
    range,
    selectionRange: range,
    external: false,
    sourceAvailable: true,
    incoming: 'idle',
    outgoing: 'idle',
    hasMoreIncoming: false,
    hasMoreOutgoing: false,
    ...(expanded ? { source: { text: 'fn root() {}', startLine: 0, startCharacter: 0, relationships: [], semanticTokens: [] } } : {})
  };
}

describe('nodeHoverEdgeTarget', () => {
  it('shows incident edges for a collapsed node', () => {
    expect(nodeHoverEdgeTarget(functionNode(false))).toBe('fn:root');
  });

  it('keeps aggregate node hover available for an expanded function', () => {
    expect(nodeHoverEdgeTarget(functionNode(true))).toBe('fn:root');
  });
});

describe('edgeSourceHandleId', () => {
  it('uses the node endpoint for aggregate edges even when source ranges exist', () => {
    expect(edgeSourceHandleId('call', true, false)).toBe('source');
  });

  it('uses the exact source range only during an exact source interaction', () => {
    expect(edgeSourceHandleId('call', true, true)).toBe('source-call');
  });

  it('falls back to the node endpoint when no source range exists', () => {
    expect(edgeSourceHandleId('call', false, true)).toBe('source');
  });
});

describe('edgeIsVisible', () => {
  const selected: GraphEdgeDto = { id: 'selected', source: 'root', target: 'first', kind: 'call' };
  const sibling: GraphEdgeDto = { id: 'sibling', source: 'root', target: 'second', kind: 'call' };

  it('does not fall back to aggregate node hover while an exact source relationship is pinned', () => {
    const state = {
      hoveredNodeId: 'root',
      pinnedEdgeIds: new Set(['selected'])
    };
    expect(edgeIsVisible(selected, state)).toBe(true);
    expect(edgeIsVisible(sibling, state)).toBe(false);
  });

  it('shows a newly hovered exact relationship beside the pinned relationship without showing siblings', () => {
    const unrelated: GraphEdgeDto = { id: 'unrelated', source: 'root', target: 'third', kind: 'call' };
    const state = {
      hoveredNodeId: 'root',
      hoveredEdgeId: 'sibling',
      pinnedEdgeIds: new Set(['selected'])
    };
    expect(edgeIsVisible(selected, state)).toBe(true);
    expect(edgeIsVisible(sibling, state)).toBe(true);
    expect(edgeIsVisible(unrelated, state)).toBe(false);
  });
});
