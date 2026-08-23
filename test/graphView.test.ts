import { describe, expect, it } from 'vitest';
import type { FunctionNodeDto, GraphSnapshotDto } from '../src/shared/protocol.js';
import { directionIsActive, directionKey, visibleGraph } from '../src/webview/graphView.js';

const position = { line: 0, character: 0 };
const range = { start: position, end: position };

function node(id: string, incoming: FunctionNodeDto['incoming'] = 'idle', outgoing: FunctionNodeDto['outgoing'] = 'idle'): FunctionNodeDto {
  return {
    kind: 'function', id, label: id, detail: '', symbolKind: 11,
    uri: `file:///${id}.rs`, range, selectionRange: range,
    external: false, sourceAvailable: true, incoming, outgoing,
    hasMoreIncoming: false, hasMoreOutgoing: false
  };
}

function snapshot(): GraphSnapshotDto {
  return {
    revision: 1,
    rootId: 'root',
    includeDependencies: false,
    limits: { nodeCount: 4, maxNodes: 250, expansionBatchSize: 50, limitReached: false },
    nodes: [node('caller'), node('root', 'complete', 'complete'), node('callee'), node('shared')],
    edges: [
      { id: 'in', source: 'caller', target: 'root', kind: 'call' },
      { id: 'out', source: 'root', target: 'callee', kind: 'call' },
      { id: 'shared-a', source: 'caller', target: 'shared', kind: 'call' },
      { id: 'shared-b', source: 'shared', target: 'callee', kind: 'call' }
    ]
  };
}

describe('direction toggles', () => {
  it('marks a loaded direction on until the user collapses it', () => {
    const root = snapshot().nodes.find(item => item.id === 'root') as FunctionNodeDto;
    expect(directionIsActive(root, 'outgoing', new Set())).toBe(true);
    expect(directionIsActive(root, 'outgoing', new Set([directionKey('root', 'outgoing')]))).toBe(false);
  });

  it('removes the outgoing branch while retaining the incoming branch', () => {
    const graph = snapshot();
    const view = visibleGraph(
      { ...graph, edges: graph.edges.filter(edge => edge.id === 'in' || edge.id === 'out') },
      new Set([directionKey('root', 'outgoing')])
    );
    expect([...view.nodeIds]).toEqual(expect.arrayContaining(['root', 'caller']));
    expect(view.nodeIds.has('callee')).toBe(false);
    expect(view.edges.map(edge => edge.id)).not.toContain('out');
  });

  it('retains nodes that remain reachable through another open path', () => {
    const view = visibleGraph(snapshot(), new Set([directionKey('root', 'incoming')]));
    expect(view.nodeIds.has('callee')).toBe(true);
    expect(view.nodeIds.has('shared')).toBe(true);
  });
});
