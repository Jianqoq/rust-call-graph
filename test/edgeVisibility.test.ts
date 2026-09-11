import { describe, expect, it } from 'vitest';
import type { FunctionNodeDto, GraphEdgeDto } from '../src/shared/protocol.js';
import { edgeIsVisible, edgeRevealMode, edgeStrokeStyle, nodeHoverEdgeTarget } from '../src/webview/edgeVisibility.js';

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

describe('edgeRevealMode', () => {
  const call: GraphEdgeDto = { id: 'call', source: 'root', target: 'first', kind: 'call' };

  it('treats hovered function edges as a preview until the function is selected', () => {
    expect(edgeRevealMode(call, { hoveredNodeId: 'root', pinnedEdgeIds: new Set() })).toBe('preview');
  });

  it('keeps selected function edges selected even while the pointer stays on the node', () => {
    expect(edgeRevealMode(call, {
      hoveredNodeId: 'root',
      pinnedNodeId: 'root',
      pinnedEdgeIds: new Set()
    })).toBe('selected');
  });

  it('keeps a pinned relationship selected while an extra hovered relationship stays a preview', () => {
    const sibling: GraphEdgeDto = { id: 'sibling', source: 'root', target: 'second', kind: 'call' };
    const state = {
      hoveredNodeId: 'root',
      hoveredEdgeId: 'sibling',
      pinnedEdgeIds: new Set(['call'])
    };
    expect(edgeRevealMode(call, state)).toBe('selected');
    expect(edgeRevealMode(sibling, state)).toBe('preview');
  });
});

describe('edgeStrokeStyle', () => {
  it('draws selected calls as solid kind color and hover previews as dashed orange', () => {
    expect(edgeStrokeStyle('call', 'selected')).toEqual({
      color: 'var(--graph-call)',
      strokeWidth: 2
    });
    expect(edgeStrokeStyle('call', 'preview')).toEqual({
      color: 'var(--graph-preview)',
      strokeWidth: 2,
      strokeDasharray: '6 6'
    });
  });

  it('keeps selected references dashed in their kind color', () => {
    expect(edgeStrokeStyle('reference', 'selected')).toEqual({
      color: 'var(--graph-reference)',
      strokeWidth: 2,
      strokeDasharray: '7 5'
    });
  });
});
