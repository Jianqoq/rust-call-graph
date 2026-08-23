import type {
  FunctionExpansionState,
  FunctionNodeDto,
  GraphEdgeDto,
  GraphSnapshotDto
} from '../shared/protocol.js';

export type FunctionDirection = 'incoming' | 'outgoing';

export interface VisibleGraph {
  readonly nodeIds: ReadonlySet<string>;
  readonly edges: readonly GraphEdgeDto[];
}

export function directionKey(nodeId: string, direction: FunctionDirection): string {
  return `${nodeId}:${direction}`;
}

export function directionIsActive(
  node: FunctionNodeDto,
  direction: FunctionDirection,
  collapsedDirections: ReadonlySet<string>
): boolean {
  const state: FunctionExpansionState = direction === 'incoming' ? node.incoming : node.outgoing;
  return state !== 'idle'
    && state !== 'unavailable'
    && !collapsedDirections.has(directionKey(node.id, direction));
}

export function visibleGraph(
  snapshot: GraphSnapshotDto,
  collapsedDirections: ReadonlySet<string>
): VisibleGraph {
  const edges = snapshot.edges.filter(edge => !edgeIsCollapsed(edge, collapsedDirections));
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const source = adjacency.get(edge.source) ?? new Set<string>();
    source.add(edge.target);
    adjacency.set(edge.source, source);
    const target = adjacency.get(edge.target) ?? new Set<string>();
    target.add(edge.source);
    adjacency.set(edge.target, target);
  }

  const nodeIds = new Set<string>([snapshot.rootId]);
  const queue = [snapshot.rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const adjacent of adjacency.get(current) ?? []) {
      if (!nodeIds.has(adjacent)) {
        nodeIds.add(adjacent);
        queue.push(adjacent);
      }
    }
  }

  return {
    nodeIds,
    edges: edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  };
}

function edgeIsCollapsed(edge: GraphEdgeDto, collapsedDirections: ReadonlySet<string>): boolean {
  if (edge.kind === 'membership') {
    return false;
  }
  return collapsedDirections.has(directionKey(edge.source, 'outgoing'))
    || collapsedDirections.has(directionKey(edge.target, 'incoming'));
}
