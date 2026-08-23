import * as vscode from 'vscode';
import type { PositionDto, RangeDto } from '../shared/protocol.js';

export function toPositionDto(position: vscode.Position): PositionDto {
  return { line: position.line, character: position.character };
}
export function toRangeDto(range: vscode.Range): RangeDto {
  return { start: toPositionDto(range.start), end: toPositionDto(range.end) };
}

export function fromRangeDto(range: RangeDto): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character
  );
}

export function stableRangeKey(range: vscode.Range): string {
  return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

export function rangesOverlap(left: vscode.Range, right: vscode.Range): boolean {
  return left.intersection(right) !== undefined;
}

export function relativeOffsets(
  document: vscode.TextDocument,
  container: vscode.Range,
  range: vscode.Range
): { startOffset: number; endOffset: number } | undefined {
  const intersection = container.intersection(range);
  if (intersection === undefined || !container.contains(range)) {
    return undefined;
  }

  const containerStart = document.offsetAt(container.start);
  return {
    startOffset: document.offsetAt(range.start) - containerStart,
    endOffset: document.offsetAt(range.end) - containerStart
  };
}
