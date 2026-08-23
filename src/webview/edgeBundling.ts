export interface FanOutEdgeCandidate {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly sourceHandleId: string;
  readonly kind: 'call' | 'reference';
  readonly visible: boolean;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetColumnX: number;
}

export interface FanOutBundle {
  readonly laneX: number;
  readonly trunkMinY: number;
  readonly trunkMaxY: number;
  readonly drawTrunk: boolean;
}

/**
 * Groups visible aggregate fan-out edges that share their source handle,
 * relationship style, direction, and target column. Exactly one edge owns the
 * common stem/trunk; every edge keeps its own target branch and arrowhead.
 */
export function bundleFanOutEdges(
  edges: readonly FanOutEdgeCandidate[]
): ReadonlyMap<string, FanOutBundle> {
  const families = new Map<string, FanOutEdgeCandidate[]>();
  for (const edge of edges) {
    if (!edge.visible || edge.sourceHandleId !== 'source') {
      continue;
    }
    const direction = edge.targetX >= edge.sourceX ? 'right' : 'left';
    const familyKey = [
      edge.sourceNodeId,
      edge.sourceHandleId,
      direction,
      coordinateKey(edge.targetColumnX)
    ].join('|');
    const family = families.get(familyKey) ?? [];
    family.push(edge);
    families.set(familyKey, family);
  }

  const bundles = new Map<string, FanOutBundle>();
  for (const family of families.values()) {
    if (family.length < 2) {
      continue;
    }
    const styleGroups = (['call', 'reference'] as const)
      .map(kind => family.filter(edge => edge.kind === kind))
      .filter(group => group.length > 0);
    for (const [styleIndex, group] of styleGroups.entries()) {
      const ordered = [...group].sort(
        (left, right) => left.targetY - right.targetY || left.id.localeCompare(right.id)
      );
      const first = ordered[0];
      if (first === undefined) {
        continue;
      }
      const baseLaneX = (first.sourceX + first.targetX) / 2;
      const direction = first.targetX >= first.sourceX ? 1 : -1;
      const laneOffset = (styleIndex - (styleGroups.length - 1) / 2) * 10 * direction;
      const laneX = baseLaneX + laneOffset;
      const ys = [first.sourceY, ...ordered.map(edge => edge.targetY)];
      const trunkMinY = Math.min(...ys);
      const trunkMaxY = Math.max(...ys);
      for (const [index, edge] of ordered.entries()) {
        bundles.set(edge.id, {
          laneX,
          trunkMinY,
          trunkMaxY,
          drawTrunk: index === 0
        });
      }
    }
  }
  return bundles;
}

function coordinateKey(value: number): string {
  return (Math.round(value * 2) / 2).toFixed(1);
}
