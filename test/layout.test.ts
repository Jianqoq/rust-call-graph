import { describe, expect, it } from 'vitest';
import type { GraphSnapshotDto } from '../src/shared/protocol.js';
import { layoutGraph, makeRoomForExpandedSources, moveHoveredTargetNearOrigin, moveInspectionTargetsNearOrigins } from '../src/webview/layout.js';

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

  it('preserves manually positioned nodes when graph relationships change', () => {
    const manual = new Map([['root', { x: 137, y: 91 }]]);
    const layout = layoutGraph(snapshot(), manual);
    expect(layout.get('root')).toEqual({ x: 137, y: 91 });
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

  it('temporarily moves a hovered source target into a nearby inspection slot', () => {
    const layout = moveHoveredTargetNearOrigin([
      { id: 'origin', position: { x: 0, y: 0 }, size: { width: 660, height: 560 } },
      { id: 'target', position: { x: 1520, y: 920 }, size: { width: 338, height: 120 } },
      { id: 'other', position: { x: 780, y: 230 }, size: { width: 338, height: 120 } }
    ], 'origin', 'target');

    expect(layout.get('origin')).toEqual({ x: 0, y: 0 });
    expect(layout.get('target')).toEqual({ x: 720, y: 96 });
    expect(layout.get('other')).toEqual({ x: 1108, y: 230 });
  });

  it('reserves ordered inspection slots for a pinned target and a second hovered target', () => {
    const layout = moveInspectionTargetsNearOrigins([
      { id: 'origin', position: { x: 0, y: 0 }, size: { width: 660, height: 560 } },
      { id: 'pinned', position: { x: 710, y: -90 }, size: { width: 338, height: 120 } },
      { id: 'hovered', position: { x: 710, y: 90 }, size: { width: 338, height: 120 } },
      { id: 'other', position: { x: 710, y: 270 }, size: { width: 338, height: 120 } }
    ], [
      { originNodeId: 'origin', targetNodeId: 'pinned' },
      { originNodeId: 'origin', targetNodeId: 'hovered' }
    ]);

    expect(layout.get('pinned')).toEqual({ x: 720, y: 96 });
    expect(layout.get('hovered')).toEqual({ x: 720, y: 240 });
    expect(layout.get('other')).toEqual({ x: 1108, y: 270 });
  });
});
