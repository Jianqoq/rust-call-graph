import type { Node } from '@xyflow/react';
import type { FunctionExpansionState, GraphNodeDto, SourceHoverBlockDto } from '../shared/protocol.js';

export interface HoveredRelationship {
  readonly edgeId: string;
  readonly originNodeId: string;
  readonly targetNodeId: string;
}

export interface SourceHoverData {
  readonly nodeId: string;
  readonly sourceOffset: number;
  readonly blocks: readonly SourceHoverBlockDto[];
}

export interface BaseNodeData extends Record<string, unknown> {
  readonly dto: GraphNodeDto;
}

export interface NodeActions {
  readonly toggleSource: (nodeId: string) => void;
  readonly toggleFunctionDirection: (
    nodeId: string,
    direction: 'incoming' | 'outgoing',
    state: FunctionExpansionState,
    active: boolean
  ) => void;
  readonly expandType: (nodeId: string, loadMore: boolean) => void;
  readonly openSource: (nodeId: string) => void;
  readonly focusNode: (nodeId: string) => void;
  readonly goBack: () => void;
  readonly hoverRelationship: (relationship: HoveredRelationship | undefined) => void;
  readonly pinRelationship: (relationship: HoveredRelationship) => void;
  readonly followRelationship: (originNodeId: string, targetNodeId: string) => void;
  readonly requestSourceHover: (nodeId: string, sourceOffset: number) => void;
  readonly clearSourceHover: () => void;
}

export interface RustNodeData extends BaseNodeData {
  readonly root: boolean;
  readonly focused: boolean;
  readonly canGoBack: boolean;
  readonly incomingActive: boolean;
  readonly outgoingActive: boolean;
  readonly proximityTarget: boolean;
  readonly sourceHover?: SourceHoverData;
  readonly actions: NodeActions;
}

export type BaseFlowNode = Node<BaseNodeData, 'rustNode'>;
export type RustFlowNode = Node<RustNodeData, 'rustNode'>;
