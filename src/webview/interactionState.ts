import type { HoveredRelationship } from './graphTypes.js';

/** Returns the relationship focus that remains pinned after a source click. */
export function nextPinnedRelationship(
  current: HoveredRelationship | undefined,
  relationship: HoveredRelationship
): HoveredRelationship | undefined {
  if (current?.edgeId === relationship.edgeId) {
    return undefined;
  }
  return relationship;
}

/** Keeps target inspection focus while clearing relationships hidden with their source node. */
export function pinnedRelationshipAfterSourceToggle(
  current: HoveredRelationship | undefined,
  toggledNodeId: string
): HoveredRelationship | undefined {
  return current?.originNodeId === toggledNodeId ? undefined : current;
}

export function clearNodeSelection<T extends { readonly selected?: boolean }>(nodes: readonly T[]): T[] {
  return nodes.map(node => node.selected ? { ...node, selected: false } : node);
}

/** Relationships whose target nodes currently occupy temporary inspection slots. */
export function activeInspectionRelationships(
  pinned: HoveredRelationship | undefined,
  hovered: HoveredRelationship | undefined
): readonly HoveredRelationship[] {
  if (pinned === undefined) {
    return hovered === undefined ? [] : [hovered];
  }
  if (hovered === undefined || hovered.edgeId === pinned.edgeId) {
    return [pinned];
  }
  return [pinned, hovered];
}
