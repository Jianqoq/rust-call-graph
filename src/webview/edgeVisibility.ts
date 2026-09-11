import type { GraphEdgeDto, GraphNodeDto } from '../shared/protocol.js';

export interface EdgeVisibilityState {
  readonly hoveredNodeId?: string | undefined;
  readonly hoveredEdgeId?: string | undefined;
  readonly pinnedNodeId?: string | undefined;
  readonly pinnedEdgeIds: ReadonlySet<string>;
}

export type EdgeRevealMode = 'selected' | 'preview';

export interface EdgeStrokeStyle {
  readonly color: string;
  readonly strokeWidth: number;
  readonly strokeDasharray?: string;
}

export function nodeHoverEdgeTarget(node: GraphNodeDto): string | undefined {
  return node.id;
}

export function edgeIsVisible(edge: GraphEdgeDto, state: EdgeVisibilityState): boolean {
  const exactSourceInteractionActive = state.hoveredEdgeId !== undefined || state.pinnedEdgeIds.size > 0;
  return state.pinnedEdgeIds.has(edge.id)
    || edgeTouches(edge, state.pinnedNodeId)
    || (exactSourceInteractionActive
      ? edge.id === state.hoveredEdgeId
      : edgeTouches(edge, state.hoveredNodeId));
}

/** Selected/pinned edges keep kind styling; hover-only edges are a dashed preview. */
export function edgeRevealMode(edge: GraphEdgeDto, state: EdgeVisibilityState): EdgeRevealMode | undefined {
  if (!edgeIsVisible(edge, state)) {
    return undefined;
  }
  if (state.pinnedEdgeIds.has(edge.id) || edgeTouches(edge, state.pinnedNodeId)) {
    return 'selected';
  }
  return 'preview';
}

export function edgeStrokeStyle(kind: GraphEdgeDto['kind'], reveal: EdgeRevealMode): EdgeStrokeStyle {
  if (reveal === 'preview') {
    return {
      color: 'var(--graph-preview)',
      strokeWidth: kind === 'membership' ? 1.4 : 2,
      strokeDasharray: '6 6'
    };
  }
  const color = kind === 'reference'
    ? 'var(--graph-reference)'
    : kind === 'membership'
      ? 'var(--graph-membership)'
      : 'var(--graph-call)';
  return {
    color,
    strokeWidth: kind === 'membership' ? 1.4 : 2,
    ...(kind === 'reference'
      ? { strokeDasharray: '7 5' }
      : kind === 'membership'
        ? { strokeDasharray: '2 5' }
        : {})
  };
}

function edgeTouches(edge: GraphEdgeDto, nodeId: string | undefined): boolean {
  return nodeId !== undefined && (edge.source === nodeId || edge.target === nodeId);
}
