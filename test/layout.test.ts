import { describe, expect, it } from 'vitest';
import type { GraphSnapshotDto } from '../src/shared/protocol.js';
import { finishGridDrag, layoutGraph, makeRoomForExpandedSources, previewGridDrag, reorderRecentTargetsInGrid } from '../src/webview/layout.js';

const position = { line: 0, character: 0 };
const range = { start: position, end: position };

function node(id: string) {
  return {
    kind: 'function' as const,
    id,
    label: id,
    detail: '',
    symbolKind: 11,
    uri: `file:///${id}.rs`,
    range,
    selectionRange: range,
    external: false,
    sourceAvailable: true,
    incoming: 'idle' as const,
    outgoing: 'idle' as const,
    hasMoreIncoming: false,
    hasMoreOutgoing: false
  };
}

function snapshot(): GraphSnapshotDto {
  return {
    revision: 1,
    rootId: 'root',
    includeDependencies: false,
    limits: { nodeCount: 4, maxNodes: 250, expansionBatchSize: 50, limitReached: false },
    nodes: [node('caller'), node('root'), node('callee'), node('cycle')],
    edges: [
      { id: 'incoming', source: 'caller', target: 'root', kind: 'call' },
      { id: 'outgoing', source: 'root', target: 'callee', kind: 'call' },
      { id: 'cycle-a', source: 'callee', target: 'cycle', kind: 'call' },
      { id: 'cycle-b', source: 'cycle', target: 'root', kind: 'call' }
    ]
  };
}

describe('layoutGraph', () => {
  it('places callers left and callees right of the entry function', () => {
    const layout = layoutGraph(snapshot(), new Map());
    expect(layout.get('caller')?.x).toBeLessThan(layout.get('root')?.x ?? 0);
    expect(layout.get('callee')?.x).toBeGreaterThan(layout.get('root')?.x ?? 0);
    expect(layout.size).toBe(4);
  });

  it('normalizes saved positions into rows while preserving a moved column x', () => {
    const manual = new Map([['root', { x: 137, y: 91 }]]);
    const layout = layoutGraph(snapshot(), manual);
    expect(layout.get('root')).toEqual({ x: 137, y: 0 });
    expect([...layout.values()].every(point => point.y % 183 === 0)).toBe(true);
  });

  it('uses half-size horizontal and vertical whitespace between collapsed nodes', () => {
    const compact: GraphSnapshotDto = {
      revision: 1,
      rootId: 'root',
      includeDependencies: false,
      limits: { nodeCount: 3, maxNodes: 250, expansionBatchSize: 50, limitReached: false },
      nodes: [node('root'), node('first'), node('second')],
      edges: [
        { id: 'first-edge', source: 'root', target: 'first', kind: 'call' },
        { id: 'second-edge', source: 'root', target: 'second', kind: 'call' }
      ]
    };
    const layout = layoutGraph(compact, new Map());
    expect((layout.get('first')?.x ?? 0) - (layout.get('root')?.x ?? 0)).toBe(549);
    expect(Math.abs((layout.get('second')?.y ?? 0) - (layout.get('first')?.y ?? 0))).toBe(183);
  });

  it('preserves one shared x for every node in a horizontally moved rank column', () => {
    const compact: GraphSnapshotDto = {
      revision: 1,
      rootId: 'root',
      includeDependencies: false,
      limits: { nodeCount: 3, maxNodes: 250, expansionBatchSize: 50, limitReached: false },
      nodes: [node('root'), node('first'), node('second')],
      edges: [
        { id: 'first-edge', source: 'root', target: 'first', kind: 'call' },
        { id: 'second-edge', source: 'root', target: 'second', kind: 'call' }
      ]
    };
    const moved = new Map([
      ['root', { x: 0, y: 0 }],
      ['first', { x: 812, y: -183 }],
      ['second', { x: 812, y: 183 }]
    ]);

    const layout = layoutGraph(compact, moved);

    expect(layout.get('first')?.x).toBe(812);
    expect(layout.get('second')?.x).toBe(812);
  });

  it('pushes same-column nodes down when source expands without moving adjacent columns', () => {
    const layout = makeRoomForExpandedSources([
      { id: 'expanded', position: { x: 0, y: 0 }, size: { width: 660, height: 560 } },
      { id: 'below', position: { x: 0, y: 230 }, size: { width: 338, height: 120 } },
      { id: 'cascade', position: { x: 0, y: 460 }, size: { width: 338, height: 120 } },
      { id: 'next-column', position: { x: 760, y: 230 }, size: { width: 338, height: 120 } }
    ], new Set(['expanded']));

    expect(layout.get('expanded')).toEqual({ x: 0, y: 0 });
    expect(layout.get('below')).toEqual({ x: 0, y: 584 });
    expect(layout.get('cascade')).toEqual({ x: 0, y: 728 });
    expect(layout.get('next-column')).toEqual({ x: 760, y: 230 });
  });

  it('temporarily shifts a compact right-hand column beyond expanded source', () => {
    const layout = makeRoomForExpandedSources([
      { id: 'expanded', position: { x: 0, y: 0 }, size: { width: 660, height: 560 } },
      { id: 'right', position: { x: 549, y: 0 }, size: { width: 338, height: 120 } },
      { id: 'far-right', position: { x: 1098, y: 0 }, size: { width: 338, height: 120 } }
    ], new Set(['expanded']));

    expect(layout.get('expanded')).toEqual({ x: 0, y: 0 });
    expect(layout.get('right')).toEqual({ x: 710, y: 0 });
    expect(layout.get('far-right')).toEqual({ x: 1259, y: 0 });
  });

  it('restores baseline positions when no source nodes remain expanded', () => {
    const baseline = [
      { id: 'root', position: { x: 17, y: 31 }, size: { width: 338, height: 120 } },
      { id: 'below', position: { x: 17, y: 261 }, size: { width: 338, height: 120 } }
    ];

    const layout = makeRoomForExpandedSources(baseline, new Set());

    expect(layout.get('root')).toEqual({ x: 17, y: 31 });
    expect(layout.get('below')).toEqual({ x: 17, y: 261 });
  });

  it('assigns recent targets to same-column cells from newest and nearest to oldest and farthest', () => {
    const boxes = [
      { id: 'origin', position: { x: 0, y: 0 }, size: { width: 660, height: 560 } },
      { id: 'first', position: { x: 710, y: -183 }, size: { width: 338, height: 120 } },
      { id: 'second', position: { x: 710, y: 0 }, size: { width: 338, height: 120 } },
      { id: 'third', position: { x: 710, y: 183 }, size: { width: 338, height: 120 } },
      { id: 'far-column', position: { x: 1259, y: 0 }, size: { width: 338, height: 120 } }
    ];
    const layout = reorderRecentTargetsInGrid(boxes, [
      { originNodeId: 'origin', targetNodeId: 'third' },
      { originNodeId: 'origin', targetNodeId: 'second' },
      { originNodeId: 'origin', targetNodeId: 'first' }
    ]);

    expect(layout.get('third')).toEqual({ x: 710, y: 0 });
    expect(layout.get('second')).toEqual({ x: 710, y: -183 });
    expect(layout.get('first')).toEqual({ x: 710, y: 183 });
    expect(layout.get('far-column')).toEqual({ x: 1259, y: 0 });
    expect(new Set(['first', 'second', 'third'].map(id => layout.get(id)?.y))).toEqual(new Set([-183, 0, 183]));
  });

  it('moves a target only among the bounded cells of its existing column', () => {
    const layout = reorderRecentTargetsInGrid([
      { id: 'origin', position: { x: 0, y: 183 }, size: { width: 660, height: 560 } },
      { id: 'near', position: { x: 1098, y: -366 }, size: { width: 338, height: 120 } },
      { id: 'target', position: { x: 1098, y: 366 }, size: { width: 338, height: 120 } },
      { id: 'middle', position: { x: 1098, y: 183 }, size: { width: 338, height: 120 } }
    ], [{ originNodeId: 'origin', targetNodeId: 'target' }]);

    expect(layout.get('target')).toEqual({ x: 1098, y: 183 });
    expect(layout.get('middle')).toEqual({ x: 1098, y: 366 });
    expect(Math.min(...[...layout.values()].map(point => point.y))).toBe(-366);
    expect(Math.max(...[...layout.values()].map(point => point.y))).toBe(366);
  });

  it('moves every cell in a column together during horizontal drag', () => {
    const positions = new Map([
      ['top', { x: 710, y: -183 }],
      ['focused', { x: 710, y: 0 }],
      ['bottom', { x: 710, y: 183 }],
      ['other-column', { x: 1259, y: 0 }]
    ]);

    const preview = previewGridDrag(positions, 'focused', { x: 710, y: 0 }, { x: 900, y: 420 });

    expect(preview.get('top')).toEqual({ x: 900, y: -183 });
    expect(preview.get('focused')).toEqual({ x: 900, y: 183 });
    expect(preview.get('bottom')).toEqual({ x: 900, y: 183 });
    expect(preview.get('other-column')).toEqual({ x: 1259, y: 0 });
  });

  it('swaps a focused node into the nearest row cell when vertical drag ends', () => {
    const positions = new Map([
      ['top', { x: 710, y: -183 }],
      ['focused', { x: 710, y: 0 }],
      ['bottom', { x: 710, y: 183 }]
    ]);

    const completed = finishGridDrag(positions, 'focused', { x: 710, y: 0 }, { x: 710, y: 170 });

    expect(completed.get('top')).toEqual({ x: 710, y: -183 });
    expect(completed.get('focused')).toEqual({ x: 710, y: 183 });
    expect(completed.get('bottom')).toEqual({ x: 710, y: 0 });
  });
});
