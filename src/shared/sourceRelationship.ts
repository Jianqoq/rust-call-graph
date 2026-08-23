export interface SourceOffsetRange {
  readonly startOffset: number;
  readonly endOffset: number;
}

/** Maps a provider relationship range into the source range highlighted by the graph. */
export function sourceRelationshipNameRange(
  sourceText: string,
  startOffset: number,
  endOffset: number,
  targetLabel: string
): SourceOffsetRange {
  const safeStart = Math.max(0, Math.min(sourceText.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(sourceText.length, endOffset));
  const providerText = sourceText.slice(safeStart, safeEnd);
  const callHead = providerText.slice(0, firstCallDelimiter(providerText));
  const identifiers = [...callHead.matchAll(/(?:r#)?[\p{ID_Start}_][\p{ID_Continue}]*/gu)];
  if (identifiers.length === 0) {
    return { startOffset: safeStart, endOffset: safeEnd };
  }

  const expectedName = terminalName(targetLabel).replace(/^r#/, '');
  const exact = [...identifiers].reverse().find(match => match[0].replace(/^r#/, '') === expectedName);
  const identifier = exact ?? identifiers.at(-1);
  if (identifier === undefined || identifier.index === undefined) {
    return { startOffset: safeStart, endOffset: safeEnd };
  }
  const identifierStart = safeStart + identifier.index;
  return {
    startOffset: identifierStart,
    endOffset: identifierStart + identifier[0].length
  };
}

function firstCallDelimiter(text: string): number {
  const candidates = [text.indexOf('('), text.indexOf('!')].filter(index => index >= 0);
  return candidates.length === 0 ? text.length : Math.min(...candidates);
}

function terminalName(label: string): string {
  return label.split('::').at(-1) ?? label;
}
