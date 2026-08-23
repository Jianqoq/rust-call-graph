import type { GraphEdgeDto, GraphNodeDto } from '../shared/protocol.js';

export interface EdgeVisibilityState {
  readonly hoveredNodeId?: string | undefined;
  readonly hoveredEdgeId?: string | undefined;
  readonly pinnedNodeId?: string | undefined;
  readonly pinnedEdgeIds: ReadonlySet<string>;
}

export function nodeHoverEdgeTarget(node: GraphNodeDto): string | undefined {
  return node.id;
}

export function edgeSourceHandleId(
  edgeId: string,
  sourceRelationshipAvailable: boolean,
  exactSourceInteraction: boolean
): string {
  return sourceRelationshipAvailable && exactSourceInteraction ? `source-${edgeId}` : 'source';
}

export function edgeIsVisible(edge: GraphEdgeDto, state: EdgeVisibilityState): boolean {
  const exactSourceInteractionActive = state.hoveredEdgeId !== undefined || state.pinnedEdgeIds.size > 0;
  return state.pinnedEdgeIds.has(edge.id)
    || edgeTouches(edge, state.pinnedNodeId)
    || (exactSourceInteractionActive
      ? edge.id === state.hoveredEdgeId
      : edgeTouches(edge, state.hoveredNodeId));
}

function edgeTouches(edge: GraphEdgeDto, nodeId: string | undefined): boolean {
  return nodeId !== undefined && (edge.source === nodeId || edge.target === nodeId);
}
