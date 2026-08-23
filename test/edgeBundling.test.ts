import { describe, expect, it } from 'vitest';
import { bundleFanOutEdges } from '../src/webview/edgeBundling.js';

describe('fan-out edge bundling', () => {
  it('draws one shared trunk while keeping one branch per target', () => {
    const bundles = bundleFanOutEdges([
      edge('first', 0, -183),
      edge('second', 0, 0),
      edge('third', 0, 183),
      edge('fourth', 0, 366)
    ]);

    expect([...bundles.values()].filter(bundle => bundle.drawTrunk)).toHaveLength(1);
    expect(bundles.size).toBe(4);
    expect(new Set([...bundles.values()].map(bundle => bundle.laneX))).toEqual(new Set([605]));
    expect(new Set([...bundles.values()].map(bundle => bundle.trunkMinY))).toEqual(new Set([-183]));
    expect(new Set([...bundles.values()].map(bundle => bundle.trunkMaxY))).toEqual(new Set([366]));
  });

  it('excludes hidden/exact edges and gives different relationship styles separate lanes', () => {
    const bundles = bundleFanOutEdges([
      edge('visible-call', 0, 0),
      edge('hidden-call', 0, 183, { visible: false }),
      edge('exact-call', 0, 366, { sourceHandleId: 'source-edge:exact' }),
      edge('reference', 0, 549, { kind: 'reference' })
    ]);

    expect([...bundles.keys()].sort()).toEqual(['reference', 'visible-call']);
    expect(bundles.get('visible-call')?.laneX).toBe(600);
    expect(bundles.get('reference')?.laneX).toBe(610);
    expect(bundles.has('hidden-call')).toBe(false);
    expect(bundles.has('exact-call')).toBe(false);
  });
});

function edge(
  id: string,
  sourceY: number,
  targetY: number,
  overrides: Partial<{
    visible: boolean;
    kind: 'call' | 'reference';
    sourceHandleId: string;
  }> = {}
) {
  return {
    id,
    sourceNodeId: 'origin',
    sourceHandleId: 'source',
    kind: 'call' as const,
    visible: true,
    sourceX: 500,
    sourceY,
    targetX: 710,
    targetY,
    targetColumnX: 710,
    ...overrides
  };
}
