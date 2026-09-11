import { describe, expect, it } from 'vitest';
import {
  definitionClickModifierFromMultiCursor,
  definitionModifierHint,
  isDefinitionModifierClick
} from '../src/shared/definitionNavigation.js';

describe('definition modifier click', () => {
  it('uses Ctrl/Cmd by default and Alt when multi-cursor uses Ctrl/Cmd', () => {
    expect(definitionClickModifierFromMultiCursor(undefined)).toBe('ctrlCmd');
    expect(definitionClickModifierFromMultiCursor('alt')).toBe('ctrlCmd');
    expect(definitionClickModifierFromMultiCursor('ctrlCmd')).toBe('alt');
  });

  it('treats Ctrl and Meta as go-to-definition unless Alt is also held', () => {
    expect(isDefinitionModifierClick({ altKey: false, ctrlKey: true, metaKey: false }, 'ctrlCmd')).toBe(true);
    expect(isDefinitionModifierClick({ altKey: false, ctrlKey: false, metaKey: true }, 'ctrlCmd')).toBe(true);
    expect(isDefinitionModifierClick({ altKey: true, ctrlKey: true, metaKey: false }, 'ctrlCmd')).toBe(false);
    expect(isDefinitionModifierClick({ altKey: true, ctrlKey: false, metaKey: false }, 'ctrlCmd')).toBe(false);
  });

  it('uses Alt+click when that is the editor go-to-definition modifier', () => {
    expect(isDefinitionModifierClick({ altKey: true, ctrlKey: false, metaKey: false }, 'alt')).toBe(true);
    expect(isDefinitionModifierClick({ altKey: true, ctrlKey: true, metaKey: false }, 'alt')).toBe(false);
    expect(isDefinitionModifierClick({ altKey: false, ctrlKey: true, metaKey: false }, 'alt')).toBe(false);
  });

  it('describes the current modifier using the host platform', () => {
    expect(definitionModifierHint('ctrlCmd', 'Win32')).toBe('Ctrl+click to go to definition');
    expect(definitionModifierHint('ctrlCmd', 'MacIntel')).toBe('⌘+click to go to definition');
    expect(definitionModifierHint('alt', 'MacIntel')).toBe('Alt+click to go to definition');
  });
});
