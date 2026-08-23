import type { GraphEdgeDto, GraphSnapshotDto } from '../shared/protocol.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface LayoutBox {
  readonly id: string;
  readonly position: Point;
  readonly size: Size;
}

export interface InspectionRelationship {
  readonly originNodeId: string;
  readonly targetNodeId: string;
}

// A collapsed Function Node is 338px wide and about 120px high. These steps
// leave half of the original visible whitespace: 211px horizontally and about
// 47px vertically for measured Function Nodes. Expanded source temporarily
// pushes right-hand columns aside.
const COLUMN_GAP = 549;
const ROW_GAP = 183;
const SOURCE_HORIZONTAL_CLEARANCE = 50;
const SOURCE_VERTICAL_CLEARANCE = 24;
const HOVER_TARGET_GAP = 60;
const HOVER_TARGET_MAX_Y_OFFSET = 96;

export function layoutGraph(
  snapshot: GraphSnapshotDto,
  previous: ReadonlyMap<string, Point>
): ReadonlyMap<string, Point> {
  const positions = new Map(previous);
  const ranks = discoverRanks(snapshot.rootId, snapshot.edges);
  const groups = new Map<number, string[]>();

  for (const node of snapshot.nodes) {
    if (positions.has(node.id)) {
      continue;
    }
    const rank = node.kind === 'type'
      ? typeRank(node.id, snapshot.edges, ranks)
      : ranks.get(node.id) ?? connectedRank(node.id, snapshot.edges, ranks);
    const group = groups.get(rank) ?? [];
    group.push(node.id);
    groups.set(rank, group);
  }

  for (const [rank, ids] of groups) {
    const occupied = [...positions.entries()]
      .filter(([, point]) => Math.abs(point.x - rank * COLUMN_GAP) < COLUMN_GAP / 2)
      .map(([, point]) => point.y);
    let slot = 0;
    for (const id of ids) {
      let y = centeredSlot(slot, ids.length);
      while (occupied.some(existing => Math.abs(existing - y) < ROW_GAP * 0.8)) {
        slot += 1;
        y = centeredSlot(slot, ids.length);
      }
      positions.set(id, { x: rank * COLUMN_GAP, y });
      occupied.push(y);
      slot += 1;
    }
  }

  if (!positions.has(snapshot.rootId)) {
    positions.set(snapshot.rootId, { x: 0, y: 0 });
  }
  return positions;
}

/**
 * Temporarily makes vertical room for expanded source nodes without changing
 * the graph's baseline/manual positions. Starting from the baseline on every
 * pass also means collapsing source naturally restores the vacated space.
 */
export function makeRoomForExpandedSources(
  nodes: readonly LayoutBox[],
  expandedNodeIds: ReadonlySet<string>
): ReadonlyMap<string, Point> {
  if (expandedNodeIds.size === 0) {
    return new Map(nodes.map(node => [node.id, node.position]));
  }

  const horizontallyArranged = makeHorizontalRoom(nodes, expandedNodeIds);
  const positions = new Map(horizontallyArranged.map(node => [node.id, node.position]));
  const ordered = [...horizontallyArranged].sort((left, right) =>
    left.position.y - right.position.y
    || Number(expandedNodeIds.has(right.id)) - Number(expandedNodeIds.has(left.id))
    || left.position.x - right.position.x
    || left.id.localeCompare(right.id)
  );
  const placed: Array<LayoutBox & { affected: boolean }> = [];

  for (const node of ordered) {
    let y = node.position.y;
    let affected = expandedNodeIds.has(node.id);

    for (const previous of placed) {
      if (!horizontalBandsOverlap(node, previous)) {
        continue;
      }
      const minimumY = previous.position.y + previous.size.height + SOURCE_VERTICAL_CLEARANCE;
      if (y < minimumY && (affected || previous.affected)) {
        y = minimumY;
        affected = true;
      }
    }

    const position = { x: node.position.x, y };
    positions.set(node.id, position);
    placed.push({ ...node, position, affected });
  }

  return positions;
}

function makeHorizontalRoom(
  nodes: readonly LayoutBox[],
  expandedNodeIds: ReadonlySet<string>
): LayoutBox[] {
  let arranged = nodes.map(node => ({ ...node, position: { ...node.position } }));
  const expanded = arranged
    .filter(node => expandedNodeIds.has(node.id))
    .sort((left, right) => left.position.x - right.position.x || left.id.localeCompare(right.id));

  for (const source of expanded) {
    const currentSource = arranged.find(node => node.id === source.id);
    if (currentSource === undefined) {
      continue;
    }
    const nearestRight = arranged
      .filter(node => node.id !== currentSource.id && node.position.x > currentSource.position.x)
      .reduce<number | undefined>((nearest, node) =>
        nearest === undefined ? node.position.x : Math.min(nearest, node.position.x), undefined);
    if (nearestRight === undefined) {
      continue;
    }
    const requiredRight = currentSource.position.x + currentSource.size.width + SOURCE_HORIZONTAL_CLEARANCE;
    const shift = Math.max(0, requiredRight - nearestRight);
    if (shift === 0) {
      continue;
    }
    arranged = arranged.map(node => node.position.x >= nearestRight
      ? { ...node, position: { x: node.position.x + shift, y: node.position.y } }
      : node);
  }
  return arranged;
}

/** Temporarily reserves a readable inspection slot beside a source node. */
export function moveHoveredTargetNearOrigin(
  nodes: readonly LayoutBox[],
  originNodeId: string,
  targetNodeId: string
): ReadonlyMap<string, Point> {
  return moveInspectionTargetsNearOrigins(nodes, [{ originNodeId, targetNodeId }]);
}

/** Keeps pinned targets near their source and adds hovered targets as a second inspection slot. */
export function moveInspectionTargetsNearOrigins(
  nodes: readonly LayoutBox[],
  relationships: readonly InspectionRelationship[]
): ReadonlyMap<string, Point> {
  let arranged = nodes.map(node => ({ ...node, position: { ...node.position } }));
  const grouped = new Map<string, string[]>();
  for (const relationship of relationships) {
    const targets = grouped.get(relationship.originNodeId) ?? [];
    if (!targets.includes(relationship.targetNodeId) && relationship.originNodeId !== relationship.targetNodeId) {
      targets.push(relationship.targetNodeId);
      grouped.set(relationship.originNodeId, targets);
    }
  }

  const inspectionTargetIds = new Set<string>();
  for (const [originNodeId, targetNodeIds] of grouped) {
    const origin = arranged.find(node => node.id === originNodeId);
    const targets = targetNodeIds
      .map(targetId => arranged.find(node => node.id === targetId))
      .filter((target): target is LayoutBox => target !== undefined);
    if (origin === undefined || targets.length === 0) {
      continue;
    }

    const targetX = origin.position.x + origin.size.width + HOVER_TARGET_GAP;
    const firstTarget = targets[0];
    const verticalRoom = firstTarget === undefined ? 0 : Math.max(0, (origin.size.height - firstTarget.size.height) / 2);
    let targetY = origin.position.y + Math.min(HOVER_TARGET_MAX_Y_OFFSET, verticalRoom);
    for (const target of targets) {
      inspectionTargetIds.add(target.id);
      const position = { x: targetX, y: targetY };
      arranged = arranged.map(node => node.id === target.id ? { ...node, position } : node);
      targetY += target.size.height + SOURCE_VERTICAL_CLEARANCE;
    }

    const inspectionRight = targetX + Math.max(...targets.map(target => target.size.width)) + SOURCE_HORIZONTAL_CLEARANCE;
    const nearestObstructingColumn = arranged
      .filter(node => !inspectionTargetIds.has(node.id)
        && node.position.x > origin.position.x
        && node.position.x < inspectionRight)
      .reduce<number | undefined>((nearest, node) =>
        nearest === undefined ? node.position.x : Math.min(nearest, node.position.x), undefined);
    if (nearestObstructingColumn !== undefined) {
      const shift = inspectionRight - nearestObstructingColumn;
      arranged = arranged.map(node => !inspectionTargetIds.has(node.id) && node.position.x >= nearestObstructingColumn
        ? { ...node, position: { x: node.position.x + shift, y: node.position.y } }
        : node);
    }
  }

  return makeRoomForExpandedSources(arranged, inspectionTargetIds);
}

function horizontalBandsOverlap(left: LayoutBox, right: LayoutBox): boolean {
  return left.position.x < right.position.x + right.size.width + SOURCE_HORIZONTAL_CLEARANCE
    && left.position.x + left.size.width + SOURCE_HORIZONTAL_CLEARANCE > right.position.x;
}

function centeredSlot(index: number, total: number): number {
  return (index - (total - 1) / 2) * ROW_GAP;
}

function discoverRanks(rootId: string, edges: readonly GraphEdgeDto[]): Map<string, number> {
  const ranks = new Map<string, number>([[rootId, 0]]);
  for (let pass = 0; pass < Math.max(2, edges.length); pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (edge.kind === 'membership') {
        continue;
      }
      const source = ranks.get(edge.source);
      const target = ranks.get(edge.target);
      if (source !== undefined && target === undefined) {
        ranks.set(edge.target, source + 1);
        changed = true;
      } else if (target !== undefined && source === undefined) {
        ranks.set(edge.source, target - 1);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return ranks;
}

function typeRank(typeId: string, edges: readonly GraphEdgeDto[], ranks: ReadonlyMap<string, number>): number {
  const membership = edges.find(edge => edge.kind === 'membership' && edge.source === typeId);
  return membership === undefined ? 0 : ranks.get(membership.target) ?? 0;
}

function connectedRank(nodeId: string, edges: readonly GraphEdgeDto[], ranks: ReadonlyMap<string, number>): number {
  for (const edge of edges) {
    if (edge.source === nodeId && ranks.has(edge.target)) {
      return (ranks.get(edge.target) ?? 0) - 1;
    }
    if (edge.target === nodeId && ranks.has(edge.source)) {
      return (ranks.get(edge.source) ?? 0) + 1;
    }
  }
  return 0;
}
