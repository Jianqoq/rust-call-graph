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

export type GridExtent = [[number, number], [number, number]];

// A collapsed Function Node is 338px wide and about 112px high. Nodes occupy
// fixed rank columns and bounded row cells; interaction may permute which node
// owns a cell but never invents a free-form inspection coordinate.
const COLUMN_GAP = 549;
const ROW_GAP = 183;
const SOURCE_HORIZONTAL_CLEARANCE = 50;
const SOURCE_VERTICAL_CLEARANCE = 24;

export function layoutGraph(
  snapshot: GraphSnapshotDto,
  previous: ReadonlyMap<string, Point>
): ReadonlyMap<string, Point> {
  const ranks = discoverRanks(snapshot.rootId, snapshot.edges);
  const groups = new Map<number, string[]>();

  for (const node of snapshot.nodes) {
    const rank = node.kind === 'type'
      ? typeRank(node.id, snapshot.edges, ranks)
      : ranks.get(node.id) ?? connectedRank(node.id, snapshot.edges, ranks);
    const group = groups.get(rank) ?? [];
    group.push(node.id);
    groups.set(rank, group);
  }

  const positions = new Map<string, Point>();
  for (const [rank, ids] of groups) {
    const availableRows = gridRows(ids.length);
    const rootIndex = ids.indexOf(snapshot.rootId);
    if (rootIndex !== -1) {
      positions.set(snapshot.rootId, { x: rank * COLUMN_GAP, y: 0 });
      availableRows.splice(availableRows.indexOf(0), 1);
    }

    const ordered = ids
      .filter(id => id !== snapshot.rootId)
      .sort((left, right) => compareByPreviousPosition(left, right, previous));
    for (const id of ordered) {
      const desiredY = previous.get(id)?.y ?? 0;
      const rowIndex = nearestRowIndex(availableRows, desiredY);
      const [y = 0] = availableRows.splice(rowIndex, 1);
      positions.set(id, { x: rank * COLUMN_GAP, y });
    }
  }
  return positions;
}

/**
 * Temporarily makes vertical room for expanded source nodes without changing
 * the graph's baseline grid cells. Starting from the baseline on every
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

/**
 * Reassigns existing cells within each target column by visit recency. The
 * newest target receives the cell vertically closest to the source node, and
 * older targets take progressively farther cells. X coordinates and the set
 * of Y coordinates are invariant, so the result cannot escape the grid.
 */
export function reorderRecentTargetsInGrid(
  nodes: readonly LayoutBox[],
  relationships: readonly InspectionRelationship[]
): ReadonlyMap<string, Point> {
  const positions = new Map(nodes.map(node => [node.id, { ...node.position }]));
  const newest = relationships[0];
  if (newest === undefined) {
    return positions;
  }
  const origin = nodes.find(node => node.id === newest.originNodeId);
  if (origin === undefined) {
    return positions;
  }

  const recentTargetIds = relationships
    .filter(relationship => relationship.originNodeId === origin.id && relationship.targetNodeId !== origin.id)
    .map(relationship => relationship.targetNodeId)
    .filter((id, index, ids) => ids.indexOf(id) === index && nodes.some(node => node.id === id));
  const targetColumns = [...new Set(recentTargetIds.map(id =>
    nodes.find(node => node.id === id)?.position.x
  ).filter((x): x is number => x !== undefined))];

  for (const columnX of targetColumns) {
    const columnNodes = nodes.filter(node => sameColumn(node.position.x, columnX));
    const columnTargetIds = recentTargetIds.filter(id => {
      const target = nodes.find(node => node.id === id);
      return target !== undefined && sameColumn(target.position.x, columnX);
    });
    const nearestCells = columnNodes
      .map(node => ({ ...node.position }))
      .sort((left, right) =>
        Math.abs(left.y - origin.position.y) - Math.abs(right.y - origin.position.y)
        || left.y - right.y
      );
    const assignedCellKeys = new Set<string>();
    for (const [index, targetId] of columnTargetIds.entries()) {
      const cell = nearestCells[index];
      if (cell === undefined) {
        break;
      }
      positions.set(targetId, cell);
      assignedCellKeys.add(pointKey(cell));
    }

    const remainingCells = columnNodes
      .map(node => ({ ...node.position }))
      .filter(cell => !assignedCellKeys.has(pointKey(cell)))
      .sort((left, right) => left.y - right.y);
    const remainingNodes = columnNodes
      .filter(node => !columnTargetIds.includes(node.id))
      .sort((left, right) => left.position.y - right.position.y || left.id.localeCompare(right.id));
    for (const [index, node] of remainingNodes.entries()) {
      const cell = remainingCells[index];
      if (cell !== undefined) {
        positions.set(node.id, cell);
      }
    }
  }

  return positions;
}

/**
 * React Flow constrains the entire node rectangle, so the maximum boundary
 * includes the node's own width and height. This locks its top-left x to the
 * current column while allowing y only inside that column's rendered rows.
 */
export function gridColumnExtent(
  positions: ReadonlyMap<string, Point>,
  position: Point,
  size: Size
): GridExtent {
  const rows = [...positions.values()]
    .filter(point => sameColumn(point.x, position.x))
    .map(point => point.y);
  return [
    [position.x, Math.min(...rows, position.y)],
    [position.x + size.width, Math.max(...rows, position.y) + size.height]
  ];
}

function horizontalBandsOverlap(left: LayoutBox, right: LayoutBox): boolean {
  return left.position.x < right.position.x + right.size.width + SOURCE_HORIZONTAL_CLEARANCE
    && left.position.x + left.size.width + SOURCE_HORIZONTAL_CLEARANCE > right.position.x;
}

function gridRows(count: number): number[] {
  const rows = [0];
  for (let distance = 1; rows.length < count; distance += 1) {
    rows.push(distance * ROW_GAP);
    if (rows.length < count) {
      rows.push(-distance * ROW_GAP);
    }
  }
  return rows;
}

function compareByPreviousPosition(left: string, right: string, previous: ReadonlyMap<string, Point>): number {
  const leftPosition = previous.get(left);
  const rightPosition = previous.get(right);
  if (leftPosition !== undefined && rightPosition !== undefined) {
    return leftPosition.y - rightPosition.y || left.localeCompare(right);
  }
  if (leftPosition !== undefined) {
    return -1;
  }
  if (rightPosition !== undefined) {
    return 1;
  }
  return left.localeCompare(right);
}

function nearestRowIndex(rows: readonly number[], desiredY: number): number {
  let nearest = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const candidate = rows[index] ?? 0;
    const current = rows[nearest] ?? 0;
    if (Math.abs(candidate - desiredY) < Math.abs(current - desiredY)
      || (Math.abs(candidate - desiredY) === Math.abs(current - desiredY) && candidate < current)) {
      nearest = index;
    }
  }
  return nearest;
}

function sameColumn(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.5;
}

function pointKey(point: Point): string {
  return `${point.x}:${point.y}`;
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
