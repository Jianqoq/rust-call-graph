import * as vscode from 'vscode';

export interface GraphConfiguration {
  readonly maxNodes: number;
  readonly expansionBatchSize: number;
  readonly includeDependencies: boolean;
  readonly refreshDebounceMs: number;
}

function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function readGraphConfiguration(): GraphConfiguration {
  const config = vscode.workspace.getConfiguration('rustCallGraph');
  return {
    maxNodes: boundedInteger(config.get<number>('maxNodes', 250), 25, 2000),
    expansionBatchSize: boundedInteger(config.get<number>('expansionBatchSize', 50), 10, 200),
    includeDependencies: config.get<boolean>('includeDependencies', false),
    refreshDebounceMs: boundedInteger(config.get<number>('refreshDebounceMs', 600), 100, 5000)
  };
}
