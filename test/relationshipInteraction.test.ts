import { describe, expect, it } from 'vitest';
import { sourceRelationshipNameRange } from '../src/shared/sourceRelationship.js';
import { activeInspectionRelationships, clearNodeSelection, nextPinnedRelationship, pinnedRelationshipAfterSourceToggle } from '../src/webview/interactionState.js';

describe('source relationship selection', () => {
  it('replaces the previously pinned relationship when another function is clicked', () => {
    const first = { edgeId: 'edge:first', originNodeId: 'root', targetNodeId: 'first' };
    const second = { edgeId: 'edge:second', originNodeId: 'root', targetNodeId: 'second' };
    expect(nextPinnedRelationship(first, second)).toEqual(second);
  });

  it('clears the relationship when the selected function is clicked again', () => {
    const selected = { edgeId: 'edge:selected', originNodeId: 'root', targetNodeId: 'selected' };
    expect(nextPinnedRelationship(selected, selected)).toBeUndefined();
  });

  it('clears the previously selected graph node when a source function is clicked', () => {
    const nodes = clearNodeSelection([
      { id: 'previous', selected: true },
      { id: 'other', selected: false }
    ]);
    expect(nodes).toEqual([
      { id: 'previous', selected: false },
      { id: 'other', selected: false }
    ]);
  });

  it('keeps a pinned target in an inspection slot after source hover ends', () => {
    const pinned = { edgeId: 'edge:selected', originNodeId: 'root', targetNodeId: 'selected' };
    expect(activeInspectionRelationships(pinned, undefined)).toEqual([pinned]);
  });

  it('adds a distinct hovered target after the pinned inspection target', () => {
    const pinned = { edgeId: 'edge:selected', originNodeId: 'root', targetNodeId: 'selected' };
    const hovered = { edgeId: 'edge:hovered', originNodeId: 'root', targetNodeId: 'hovered' };
    expect(activeInspectionRelationships(pinned, hovered)).toEqual([pinned, hovered]);
  });

  it('keeps relationship focus when Source is toggled on its target node', () => {
    const pinned = { edgeId: 'edge:selected', originNodeId: 'root', targetNodeId: 'selected' };
    expect(pinnedRelationshipAfterSourceToggle(pinned, 'selected')).toEqual(pinned);
  });

  it('clears relationship focus when Source is toggled on its origin node', () => {
    const pinned = { edgeId: 'edge:selected', originNodeId: 'root', targetNodeId: 'selected' };
    expect(pinnedRelationshipAfterSourceToggle(pinned, 'root')).toBeUndefined();
  });
});

describe('source relationship highlight range', () => {
  it('highlights only the terminal function name in a Rust path', () => {
    const text = 'let value = std::fs::read_to_string(path)?;';
    const pathStart = text.indexOf('std::fs::read_to_string');
    const range = sourceRelationshipNameRange(
      text,
      pathStart,
      pathStart + 'std::fs::read_to_string'.length,
      'read_to_string'
    );
    expect(text.slice(range.startOffset, range.endOffset)).toBe('read_to_string');
  });

  it('falls back to the terminal identifier when the target was imported with an alias', () => {
    const text = 'crate::worker::renamed_call();';
    const range = sourceRelationshipNameRange(text, 0, text.indexOf('('), 'original_name');
    expect(text.slice(range.startOffset, range.endOffset)).toBe('renamed_call');
  });
});
