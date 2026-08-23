import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
  type NodeProps,
  type NodeTypes,
  type Viewport
} from '@xyflow/react';
import {
  Braces,
  Check,
  CircleAlert,
  Eraser,
  Focus,
  LoaderCircle,
  Network,
  RefreshCw
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent
} from 'react';
import type { GraphEdgeDto, GraphSnapshotDto, HostToWebviewMessage } from '../shared/protocol.js';
import { bridge } from './bridge.js';
import { edgeIsVisible, edgeSourceHandleId, nodeHoverEdgeTarget } from './edgeVisibility.js';
import { directionIsActive, directionKey, visibleGraph } from './graphView.js';
import type { BaseFlowNode, HoveredRelationship, NodeActions, RustFlowNode, SourceHoverData } from './graphTypes.js';
import { activeInspectionRelationships, clearNodeSelection, nextPinnedRelationship, pinnedRelationshipAfterSourceToggle, promoteRecentRelationship } from './interactionState.js';
import { finishGridDrag, layoutGraph, makeRoomForExpandedSources, previewGridDrag, reorderRecentTargetsInGrid, type Point, type Size } from './layout.js';
import { NODE_INTERACTION } from './nodeInteraction.js';
import { RustNode } from './RustNode.js';

const nodeTypes: NodeTypes = {
  rustNode: RustNode as unknown as ComponentType<NodeProps>
};
const INITIAL_READABLE_ZOOM = 0.7;

interface NavigationEntry {
  readonly nodeId: string;
  readonly viewport: Viewport;
}

interface GridDragSession {
  readonly nodeId: string;
  readonly renderedStart: Point;
  readonly initialPositions: ReadonlyMap<string, Point>;
  renderedPosition: Point;
}

interface CompletedGridDrag {
  readonly nodeId: string;
  readonly positions: ReadonlyMap<string, Point>;
}

export function App() {
  return (
    <ReactFlowProvider>
      <GraphSurface />
    </ReactFlowProvider>
  );
}

function GraphSurface() {
  const flow = useReactFlow<BaseFlowNode, Edge>();
  const [snapshot, setSnapshot] = useState<GraphSnapshotDto>();
  const [baseNodes, setBaseNodes] = useState<BaseFlowNode[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  const [hoveredRelationship, setHoveredRelationship] = useState<HoveredRelationship>();
  const [collapsedDirections, setCollapsedDirections] = useState<ReadonlySet<string>>(new Set());
  const [pinnedNodeId, setPinnedNodeId] = useState<string>();
  const [pinnedRelationship, setPinnedRelationship] = useState<HoveredRelationship>();
  const [recentRelationships, setRecentRelationships] = useState<readonly HoveredRelationship[]>([]);
  const [focusNodeId, setFocusNodeId] = useState<string>();
  const [navigation, setNavigation] = useState<readonly NavigationEntry[]>([]);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [announcement, setAnnouncement] = useState('Waiting for graph data.');
  const [announcementTone, setAnnouncementTone] = useState<'info' | 'warning' | 'error'>('info');
  const [sourceHover, setSourceHover] = useState<SourceHoverData>();
  const sourceHoverRequestId = useRef(0);
  const initialViewApplied = useRef(false);
  const baselinePositions = useRef(new Map<string, Point>());
  const measuredSizes = useRef(new Map<string, Size>());
  const expandedSourceIds = useRef<ReadonlySet<string>>(new Set());
  const gridDragSession = useRef<GridDragSession | undefined>(undefined);
  const completedGridDrag = useRef<CompletedGridDrag | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  const pinnedEdgeIds = useMemo<ReadonlySet<string>>(
    () => pinnedRelationship === undefined ? new Set() : new Set([pinnedRelationship.edgeId]),
    [pinnedRelationship]
  );

  const focusGraphNode = useCallback((nodeId: string, originNodeId?: string) => {
    setPinnedRelationship(undefined);
    const node = flow.getNode(nodeId);
    if (node === undefined) {
      setAnnouncement('The target node is not currently visible. Expand its relationship first.');
      setAnnouncementTone('warning');
      return;
    }
    const origin = originNodeId ?? focusNodeId;
    if (origin !== undefined && origin !== nodeId) {
      setNavigation(history => [...history, { nodeId: origin, viewport: flow.getViewport() }]);
    }
    setFocusNodeId(nodeId);
    setAnnouncement(`Focused ${node.data.dto.label}.`);
    setAnnouncementTone('info');
    void flow.fitView({ nodes: [node], padding: 0.65, duration: reducedMotion ? 0 : 220, maxZoom: 1.35 });
  }, [flow, focusNodeId, reducedMotion]);

  const goBack = useCallback(() => {
    const entry = navigation.at(-1);
    if (entry === undefined) {
      return;
    }
    setNavigation(history => history.slice(0, -1));
    setFocusNodeId(entry.nodeId);
    void flow.setViewport(entry.viewport, { duration: reducedMotion ? 0 : 220 });
    const node = flow.getNode(entry.nodeId);
    setAnnouncement(`Returned to ${node?.data.dto.label ?? 'the previous node'}.`);
  }, [flow, navigation, reducedMotion]);

  const rememberRelationship = useCallback((relationship: HoveredRelationship) => {
    setRecentRelationships(history => promoteRecentRelationship(history, relationship));
  }, []);

  const hoverRelationship = useCallback((relationship: HoveredRelationship | undefined) => {
    setHoveredRelationship(relationship);
    if (relationship !== undefined) {
      rememberRelationship(relationship);
    }
  }, [rememberRelationship]);

  const pinRelationship = useCallback((relationship: HoveredRelationship) => {
    rememberRelationship(relationship);
    setPinnedNodeId(undefined);
    setBaseNodes(clearNodeSelection);
    setPinnedRelationship(current => nextPinnedRelationship(current, relationship));
  }, [rememberRelationship]);

  const requestSourceHover = useCallback((nodeId: string, sourceOffset: number) => {
    const requestId = sourceHoverRequestId.current + 1;
    sourceHoverRequestId.current = requestId;
    setSourceHover(undefined);
    bridge.postMessage({ type: 'requestSourceHover', requestId, nodeId, sourceOffset });
  }, []);

  const clearSourceHover = useCallback(() => {
    sourceHoverRequestId.current += 1;
    setSourceHover(undefined);
  }, []);

  const toggleFunctionDirection: NodeActions['toggleFunctionDirection'] = useCallback((nodeId, direction, state, active) => {
    const key = directionKey(nodeId, direction);
    setHoveredRelationship(undefined);
    setPinnedRelationship(undefined);
    setCollapsedDirections(current => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    const relationship = direction === 'incoming' ? 'callers' : 'callees';
    if (active) {
      setAnnouncement(`Hidden all ${relationship} for this function.`);
      setAnnouncementTone('info');
    } else if (state === 'idle') {
      setAnnouncement(`Loading all ${relationship} for this function.`);
      setAnnouncementTone('info');
      bridge.postMessage({ type: 'expandFunction', nodeId, direction });
    } else {
      setAnnouncement(`Showing all ${relationship} for this function.`);
      setAnnouncementTone('info');
    }
  }, []);

  const actions = useMemo<NodeActions>(() => ({
    toggleSource: nodeId => {
      setPinnedRelationship(current => pinnedRelationshipAfterSourceToggle(current, nodeId));
      clearSourceHover();
      bridge.postMessage({ type: 'toggleSource', nodeId });
    },
    toggleFunctionDirection,
    expandType: (nodeId, loadMore) => bridge.postMessage({ type: 'expandType', nodeId, loadMore }),
    openSource: nodeId => bridge.postMessage({ type: 'openSource', nodeId }),
    focusNode: nodeId => focusGraphNode(nodeId),
    goBack,
    hoverRelationship,
    pinRelationship,
    followRelationship: (originNodeId, targetNodeId) => focusGraphNode(targetNodeId, originNodeId),
    requestSourceHover,
    clearSourceHover
  }), [clearSourceHover, focusGraphNode, goBack, hoverRelationship, pinRelationship, requestSourceHover, toggleFunctionDirection]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>): void => {
      const message = event.data;
      if (message.type === 'graphSnapshot') {
        expandedSourceIds.current = new Set(message.snapshot.nodes
          .filter(node => node.kind === 'function' && node.source !== undefined)
          .map(node => node.id));
        setSnapshot(message.snapshot);
        const snapshotNodeIds = new Set(message.snapshot.nodes.map(node => node.id));
        setRecentRelationships(history => history.filter(relationship =>
          snapshotNodeIds.has(relationship.originNodeId) && snapshotNodeIds.has(relationship.targetNodeId)
        ));
        setFocusNodeId(current => current ?? message.snapshot.rootId);
        setAnnouncement(`${message.snapshot.nodes.length} nodes in the graph.`);
        setAnnouncementTone(message.snapshot.limits.limitReached ? 'warning' : 'info');
        reconcileNodes(
          message.snapshot,
          setBaseNodes,
          baselinePositions.current
        );
      } else if (message.type === 'operation') {
        setLoadingLabel(message.state === 'loading' ? message.label : '');
      } else if (message.type === 'sourceHover') {
        if (message.requestId === sourceHoverRequestId.current) {
          setSourceHover({
            nodeId: message.nodeId,
            sourceOffset: message.sourceOffset,
            blocks: message.blocks
          });
        }
      } else if (message.type === 'announce') {
        setAnnouncement(message.message);
        setAnnouncementTone(message.tone);
      }
    };
    window.addEventListener('message', onMessage);
    bridge.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (snapshot === undefined || initialViewApplied.current || baseNodes.length === 0) {
      return;
    }
    const saved = bridge.getState()?.viewport;
    const timer = window.setTimeout(() => {
      initialViewApplied.current = true;
      if (saved !== undefined) {
        void flow.setViewport(saved);
      } else {
        void flow.fitView({
          padding: 0.25,
          duration: reducedMotion ? 0 : 240,
          minZoom: INITIAL_READABLE_ZOOM,
          maxZoom: 1.2
        });
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [baseNodes.length, flow, reducedMotion, snapshot]);

  useEffect(() => {
    if (baseNodes.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => persistView(baseNodes, baselinePositions.current, flow.getViewport()), 150);
    return () => window.clearTimeout(timer);
  }, [baseNodes, flow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setPinnedNodeId(undefined);
        setPinnedRelationship(undefined);
        setHoveredRelationship(undefined);
        clearSourceHover();
        setAnnouncement('Pinned relationships cleared.');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSourceHover]);

  const graphView = useMemo(
    () => snapshot === undefined ? undefined : visibleGraph(snapshot, collapsedDirections),
    [collapsedDirections, snapshot]
  );
  const hoveredEdgeId = hoveredRelationship?.edgeId;

  const nodes = useMemo<RustFlowNode[]>(() => {
    const visibleBaseNodes = baseNodes.filter(node => graphView?.nodeIds.has(node.id) === true);
    const boxes = visibleBaseNodes.map(node => ({
      id: node.id,
      position: baselinePositions.current.get(node.id) ?? node.position,
      size: effectiveNodeSize(
        node,
        node.data.dto.kind === 'function' && node.data.dto.source !== undefined,
        measuredSizes.current.get(node.id)
      )
    }));
    const inspectionRelationships = activeInspectionRelationships(pinnedRelationship, hoveredRelationship);
    const gridPositions = reorderRecentTargetsInGrid(boxes, recentRelationships);
    const reorderedBoxes = boxes.map(box => ({
      ...box,
      position: gridPositions.get(box.id) ?? box.position
    }));
    const visibleExpandedIds = new Set(reorderedBoxes
      .filter(box => expandedSourceIds.current.has(box.id))
      .map(box => box.id));
    const positions = makeRoomForExpandedSources(reorderedBoxes, visibleExpandedIds);
    const inspectionTargetIds = new Set(inspectionRelationships.map(relationship => relationship.targetNodeId));

    return visibleBaseNodes.map(node => {
      const dto = node.data.dto;
      const position = positions.get(node.id) ?? node.position;
      return {
        ...node,
        position,
        data: {
          ...node.data,
          root: node.id === snapshot?.rootId,
          focused: node.id === focusNodeId,
          canGoBack: node.id === focusNodeId && navigation.length > 0,
          incomingActive: dto.kind === 'function' && directionIsActive(dto, 'incoming', collapsedDirections),
          outgoingActive: dto.kind === 'function' && directionIsActive(dto, 'outgoing', collapsedDirections),
          proximityTarget: inspectionTargetIds.has(node.id),
          ...(sourceHover?.nodeId === node.id ? { sourceHover } : {}),
          actions
        }
      };
    });
  }, [actions, baseNodes, collapsedDirections, focusNodeId, graphView, hoveredRelationship, navigation.length, pinnedRelationship, recentRelationships, snapshot?.rootId, sourceHover]);

  const edges = useMemo<Edge[]>(() => snapshot === undefined || graphView === undefined ? [] : graphView.edges.map(edge => {
    const visible = edgeIsVisible(edge, {
      hoveredNodeId,
      hoveredEdgeId,
      pinnedNodeId,
      pinnedEdgeIds
    });
    const anchored = sourceHasRelationship(snapshot, edge);
    const exactSourceInteraction = hoveredEdgeId === edge.id || pinnedEdgeIds.has(edge.id);
    const color = edge.kind === 'reference'
      ? 'var(--graph-reference)'
      : edge.kind === 'membership'
        ? 'var(--graph-membership)'
        : 'var(--graph-call)';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edgeSourceHandleId(edge.id, anchored, exactSourceInteraction),
      targetHandle: 'target',
      type: 'smoothstep',
      hidden: !visible,
      selectable: false,
      focusable: false,
      interactionWidth: 16,
      zIndex: 0,
      ...(edge.kind === 'membership' ? {} : {
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color
        }
      }),
      style: {
        stroke: color,
        strokeWidth: edge.kind === 'membership' ? 1.4 : 2,
        ...(edge.kind === 'reference'
          ? { strokeDasharray: '7 5' }
          : edge.kind === 'membership'
            ? { strokeDasharray: '2 5' }
            : {})
      },
      ariaLabel: `${edge.kind} from ${nodeLabel(snapshot, edge.source)} to ${nodeLabel(snapshot, edge.target)}`
    };
  }), [graphView, hoveredEdgeId, hoveredNodeId, pinnedEdgeIds, pinnedNodeId, snapshot]);

  const onNodesChange = useCallback((changes: NodeChange<BaseFlowNode>[]) => {
    setBaseNodes(current => {
      const session = gridDragSession.current;
      const completed = completedGridDrag.current;
      const draggedPosition = session === undefined
        ? undefined
        : changes.find(change =>
          change.type === 'position'
          && change.id === session.nodeId
          && change.position !== undefined
        );
      const completedPosition = completed === undefined
        ? undefined
        : changes.find(change =>
          change.type === 'position'
          && change.id === completed.nodeId
          && change.position !== undefined
          && change.dragging === false
        );
      const normalizedChanges = completedPosition === undefined || completed === undefined
        ? changes
        : changes.map(change => change.type === 'position'
          && change.id === completed.nodeId
          && change.position !== undefined
          && change.dragging === false
          ? { ...change, position: completed.positions.get(change.id) ?? change.position }
          : change);
      let next = applyNodeChanges(normalizedChanges, current);

      if (completed !== undefined && completedPosition !== undefined) {
        replacePositions(baselinePositions.current, completed.positions);
        next = next.map(node => ({
          ...node,
          position: completed.positions.get(node.id) ?? node.position
        }));
        completedGridDrag.current = undefined;
      } else if (session !== undefined && draggedPosition?.type === 'position' && draggedPosition.position !== undefined) {
        session.renderedPosition = draggedPosition.position;
        const preview = previewGridDrag(
          session.initialPositions,
          session.nodeId,
          session.renderedStart,
          draggedPosition.position
        );
        replacePositions(baselinePositions.current, preview);
        next = next.map(node => ({
          ...node,
          position: preview.get(node.id) ?? node.position
        }));
      } else if (session === undefined && completed === undefined) {
        for (const change of changes) {
          if (change.type === 'position' && change.position !== undefined) {
            baselinePositions.current.set(change.id, change.position);
          }
        }
      }

      for (const node of next) {
        if (node.measured?.width !== undefined && node.measured.height !== undefined) {
          measuredSizes.current.set(node.id, {
            width: node.measured.width,
            height: node.measured.height
          });
        }
      }

      return next;
    });
  }, []);

  const onNodeDragStart: OnNodeDrag<RustFlowNode> = useCallback((_, node) => {
    const visibleBaseNodes = baseNodes.filter(candidate => graphView?.nodeIds.has(candidate.id) === true);
    const boxes = visibleBaseNodes.map(candidate => ({
      id: candidate.id,
      position: baselinePositions.current.get(candidate.id) ?? candidate.position,
      size: effectiveNodeSize(
        candidate,
        candidate.data.dto.kind === 'function' && candidate.data.dto.source !== undefined,
        measuredSizes.current.get(candidate.id)
      )
    }));
    const committedRecent = reorderRecentTargetsInGrid(boxes, recentRelationships);
    const initialPositions = new Map(baselinePositions.current);
    for (const [id, position] of committedRecent) {
      initialPositions.set(id, position);
    }
    replacePositions(baselinePositions.current, initialPositions);
    setBaseNodes(current => current.map(candidate => ({
      ...candidate,
      position: initialPositions.get(candidate.id) ?? candidate.position
    })));
    setRecentRelationships([]);
    completedGridDrag.current = undefined;
    gridDragSession.current = {
      nodeId: node.id,
      renderedStart: node.position,
      initialPositions,
      renderedPosition: node.position
    };
  }, [baseNodes, graphView?.nodeIds, recentRelationships]);

  const onNodeDragStop: OnNodeDrag<RustFlowNode> = useCallback(() => {
    const session = gridDragSession.current;
    if (session === undefined) {
      return;
    }
    const completed = finishGridDrag(
      session.initialPositions,
      session.nodeId,
      session.renderedStart,
      session.renderedPosition
    );
    replacePositions(baselinePositions.current, completed);
    const pendingCompletion = { nodeId: session.nodeId, positions: completed };
    completedGridDrag.current = pendingCompletion;
    gridDragSession.current = undefined;
    window.setTimeout(() => {
      if (completedGridDrag.current === pendingCompletion) {
        completedGridDrag.current = undefined;
      }
    }, 0);
    setBaseNodes(current => {
      return current.map(node => ({
        ...node,
        position: completed.get(node.id) ?? node.position
      }));
    });
  }, []);

  const onNodeClick: NodeMouseHandler<RustFlowNode> = useCallback((event, node) => {
    if ((event.target as HTMLElement).closest('button,[role="menuitem"]') !== null) {
      return;
    }
    setPinnedRelationship(undefined);
    setPinnedNodeId(current => current === node.id ? undefined : node.id);
  }, []);

  const onNodeDoubleClick: NodeMouseHandler<RustFlowNode> = useCallback((event, node) => {
    if ((event.target as HTMLElement).closest('button,[role="menuitem"]') !== null) {
      return;
    }
    focusGraphNode(node.id);
  }, [focusGraphNode]);

  const clearPaths = useCallback(() => {
    setPinnedRelationship(undefined);
    setPinnedNodeId(undefined);
    setAnnouncement('Pinned relationships cleared.');
  }, []);

  if (snapshot === undefined) {
    return (
      <main className="graph-loading" aria-live="polite">
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>Resolving Rust relationships</h1>
        <p>Waiting for the active language provider.</p>
      </main>
    );
  }

  return (
    <main className="graph-app" id="graph-canvas">
      <GraphToolbar
        snapshot={snapshot}
        visibleNodeIds={graphView?.nodeIds ?? new Set([snapshot.rootId])}
        loading={loadingLabel}
        onRefresh={() => bridge.postMessage({ type: 'refresh' })}
        onFit={() => void flow.fitView({ padding: 0.25, duration: reducedMotion ? 0 : 220, maxZoom: 1.2 })}
        onClear={clearPaths}
      />
      <ReactFlow<RustFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(nodeHoverEdgeTarget(node.data.dto))}
        onNodeMouseLeave={() => setHoveredNodeId(undefined)}
        onMoveEnd={(_, viewport) => persistView(baseNodes, baselinePositions.current, viewport)}
        minZoom={0.18}
        maxZoom={2}
        fitViewOptions={{ padding: 0.25, minZoom: INITIAL_READABLE_ZOOM }}
        nodesFocusable
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        aria-label="Interactive Rust call graph. Use Tab to reach nodes and controls."
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--graph-grid)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <div className={`sr-status sr-status-${announcementTone}`} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {snapshot.limits.limitReached && (
        <div className="limit-notice" role="status">
          <CircleAlert aria-hidden="true" /> Node limit reached ({snapshot.limits.maxNodes}).
        </div>
      )}
    </main>
  );
}

function GraphToolbar({
  snapshot,
  visibleNodeIds,
  loading,
  onRefresh,
  onFit,
  onClear
}: {
  readonly snapshot: GraphSnapshotDto;
  readonly visibleNodeIds: ReadonlySet<string>;
  readonly loading: string;
  readonly onRefresh: () => void;
  readonly onFit: () => void;
  readonly onClear: () => void;
}) {
  const visibleNodes = snapshot.nodes.filter(node => visibleNodeIds.has(node.id));
  const functionCount = visibleNodes.filter(node => node.kind === 'function').length;
  const typeCount = visibleNodes.length - functionCount;
  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph controls">
      <div className="toolbar-brand">
        <span className="toolbar-mark" aria-hidden="true"><Network /></span>
        <div>
          <strong>Rust Call Graph</strong>
          <span>{functionCount} functions · {typeCount} types</span>
        </div>
      </div>
      <div className="toolbar-divider" />
      <button type="button" className="toolbar-button" onClick={onFit} title="Fit graph to view">
        <Focus aria-hidden="true" /> <span>Fit</span>
      </button>
      <button type="button" className="toolbar-button" onClick={onClear} title="Clear pinned relationships">
        <Eraser aria-hidden="true" /> <span>Clear paths</span>
      </button>
      <button type="button" className="toolbar-button" onClick={onRefresh} disabled={loading !== ''} title="Refresh analysis">
        <RefreshCw className={loading === '' ? '' : 'spin'} aria-hidden="true" /> <span>{loading || 'Refresh'}</span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={snapshot.includeDependencies}
        className="dependency-switch"
        onClick={() => bridge.postMessage({ type: 'setIncludeDependencies', value: !snapshot.includeDependencies })}
      >
        <span className="switch-track"><span className="switch-thumb">{snapshot.includeDependencies && <Check aria-hidden="true" />}</span></span>
        Dependencies
      </button>
    </div>
  );
}

function reconcileNodes(
  snapshot: GraphSnapshotDto,
  setNodes: (update: (current: BaseFlowNode[]) => BaseFlowNode[]) => void,
  baselinePositions: Map<string, Point>
): void {
  setNodes(current => {
    const previous = new Map<string, Point>();
    for (const node of current) {
      previous.set(node.id, baselinePositions.get(node.id) ?? node.position);
    }
    if (previous.size === 0) {
      const saved = bridge.getState()?.positions ?? {};
      for (const [id, position] of Object.entries(saved)) {
        previous.set(id, position);
      }
    }
    const positions = layoutGraph(snapshot, previous);
    baselinePositions.clear();
    for (const node of snapshot.nodes) {
      baselinePositions.set(node.id, positions.get(node.id) ?? { x: 0, y: 0 });
    }
    const nodes: BaseFlowNode[] = snapshot.nodes.map(dto => ({
      id: dto.id,
      type: 'rustNode',
      position: baselinePositions.get(dto.id) ?? { x: 0, y: 0 },
      data: { dto },
      ...NODE_INTERACTION,
      className: dto.kind === 'function' && dto.external ? 'flow-node-external' : ''
    }));
    return nodes;
  });
}

function effectiveNodeSize(node: BaseFlowNode, expanded: boolean, measured: Size | undefined): Size {
  if (expanded) {
    if (measured !== undefined && measured.width >= 500) {
      return measured;
    }
    const dto = node.data.dto;
    const lineCount = dto.kind === 'function' && dto.source !== undefined
      ? dto.source.text.split('\n').length
      : 1;
    const baseHeight = 112;
    const sourceHeight = Math.min(440, 45 + lineCount * 22.5) + 10;
    return { width: 660, height: baseHeight + sourceHeight };
  }
  if (measured !== undefined && measured.width < 500) {
    return measured;
  }
  return { width: 338, height: node.data.dto.kind === 'type' ? 142 : 120 };
}

function persistView(
  nodes: readonly BaseFlowNode[],
  baselinePositions: ReadonlyMap<string, Point>,
  viewport: Viewport
): void {
  bridge.setState({
    positions: Object.fromEntries(nodes.map(node => [node.id, baselinePositions.get(node.id) ?? node.position])),
    viewport
  });
}

function replacePositions(
  target: Map<string, Point>,
  source: ReadonlyMap<string, Point>
): void {
  target.clear();
  for (const [id, position] of source) {
    target.set(id, position);
  }
}

function sourceHasRelationship(snapshot: GraphSnapshotDto, edge: GraphEdgeDto): boolean {
  const source = snapshot.nodes.find(node => node.id === edge.source);
  return source?.kind === 'function'
    && source.source?.relationships.some(relationship => relationship.edgeId === edge.id) === true;
}

function nodeLabel(snapshot: GraphSnapshotDto, nodeId: string): string {
  return snapshot.nodes.find(node => node.id === nodeId)?.label ?? nodeId;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (): void => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
