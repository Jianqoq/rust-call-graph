export type DefinitionClickModifier = 'ctrlCmd' | 'alt';

export function definitionClickModifierFromMultiCursor(
  multiCursorModifier: string | undefined
): DefinitionClickModifier {
  return multiCursorModifier === 'ctrlCmd' ? 'alt' : 'ctrlCmd';
}

export function isDefinitionModifierClick(
  event: { readonly altKey: boolean; readonly ctrlKey: boolean; readonly metaKey: boolean },
  modifier: DefinitionClickModifier
): boolean {
  if (modifier === 'alt') {
    return event.altKey && !event.ctrlKey && !event.metaKey;
  }
  return (event.ctrlKey || event.metaKey) && !event.altKey;
}

export function definitionModifierHint(modifier: DefinitionClickModifier, platform: string): string {
  if (modifier === 'alt') {
    return 'Alt+click to go to definition';
  }
  return /mac|iphone|ipad/i.test(platform)
    ? '⌘+click to go to definition'
    : 'Ctrl+click to go to definition';
}
