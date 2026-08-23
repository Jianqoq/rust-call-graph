export interface PositionDto {
  readonly line: number;
  readonly character: number;
}

export interface RangeDto {
  readonly start: PositionDto;
  readonly end: PositionDto;
}

export type FunctionExpansionState = 'idle' | 'loading' | 'complete' | 'truncated' | 'unavailable';
export type RelationshipKind = 'call' | 'reference' | 'membership';

export interface FunctionNodeDto {
  readonly kind: 'function';
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly symbolKind: number;
  readonly uri: string;
  readonly range: RangeDto;
  readonly selectionRange: RangeDto;
  readonly external: boolean;
  readonly sourceAvailable: boolean;
  readonly ownerTypeId?: string;
  readonly incoming: FunctionExpansionState;
  readonly outgoing: FunctionExpansionState;
  readonly hasMoreIncoming: boolean;
  readonly hasMoreOutgoing: boolean;
  readonly source?: FunctionSourceDto;
}

export interface TypeNodeDto {
  readonly kind: 'type';
  readonly id: string;
  readonly typeKind: 'struct' | 'enum';
  readonly label: string;
  readonly detail: string;
  readonly uri: string;
  readonly range: RangeDto;
  readonly selectionRange: RangeDto;
  readonly variants: readonly string[];
  readonly methodCount: number;
  readonly expanded: boolean;
  readonly hasMoreMethods: boolean;
}

export type GraphNodeDto = FunctionNodeDto | TypeNodeDto;

export interface SourceRelationshipDto {
  readonly id: string;
  readonly edgeId: string;
  readonly kind: Exclude<RelationshipKind, 'membership'>;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly targetNodeId: string;
  readonly label: string;
}

export interface SourceSemanticTokenDto {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly tokenType: string;
  readonly modifiers: readonly string[];
}

export interface FunctionSourceDto {
  readonly text: string;
  readonly startLine: number;
  readonly startCharacter: number;
  readonly relationships: readonly SourceRelationshipDto[];
  readonly semanticTokens: readonly SourceSemanticTokenDto[];
}

export type SourceHoverBlockDto =
  | { readonly kind: 'code'; readonly value: string; readonly language?: string }
  | { readonly kind: 'markdown'; readonly value: string };

export interface GraphEdgeDto {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: RelationshipKind;
  readonly sourceRange?: RangeDto;
  readonly label?: string;
}

export interface GraphLimitsDto {
  readonly nodeCount: number;
  readonly maxNodes: number;
  readonly expansionBatchSize: number;
  readonly limitReached: boolean;
}

export interface GraphSnapshotDto {
  readonly revision: number;
  readonly rootId: string;
  readonly nodes: readonly GraphNodeDto[];
  readonly edges: readonly GraphEdgeDto[];
  readonly includeDependencies: boolean;
  readonly limits: GraphLimitsDto;
}

export type HostToWebviewMessage =
  | { readonly type: 'graphSnapshot'; readonly snapshot: GraphSnapshotDto; readonly reason: 'initial' | 'expand' | 'source' | 'refresh' | 'settings' }
  | { readonly type: 'operation'; readonly state: 'loading' | 'idle'; readonly label: string }
  | { readonly type: 'sourceHover'; readonly requestId: number; readonly nodeId: string; readonly sourceOffset: number; readonly blocks: readonly SourceHoverBlockDto[] }
  | { readonly type: 'announce'; readonly tone: 'info' | 'warning' | 'error'; readonly message: string };

export type WebviewToHostMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'expandFunction'; readonly nodeId: string; readonly direction: 'incoming' | 'outgoing' }
  | { readonly type: 'expandType'; readonly nodeId: string; readonly loadMore: boolean }
  | { readonly type: 'toggleSource'; readonly nodeId: string }
  | { readonly type: 'openSource'; readonly nodeId: string }
  | { readonly type: 'requestSourceHover'; readonly requestId: number; readonly nodeId: string; readonly sourceOffset: number }
  | { readonly type: 'refresh' }
  | { readonly type: 'setIncludeDependencies'; readonly value: boolean };

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return type === 'ready'
    || type === 'expandFunction'
    || type === 'expandType'
    || type === 'toggleSource'
    || type === 'openSource'
    || type === 'requestSourceHover'
    || type === 'refresh'
    || type === 'setIncludeDependencies';
}
