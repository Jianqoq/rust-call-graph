import type { GraphSnapshotDto, HostToWebviewMessage, WebviewToHostMessage } from '../shared/protocol.js';
import { demoSnapshot } from './demoGraph.js';

interface WebviewState {
  readonly positions?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number };
}

interface VscodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState(): WebviewState | undefined;
  setState(state: WebviewState): void;
}

declare global {
  function acquireVsCodeApi(): VscodeApi;
}

function createBrowserBridge(): VscodeApi {
  let state: WebviewState | undefined;
  let currentSnapshot: GraphSnapshotDto = {
    ...demoSnapshot,
    nodes: [...demoSnapshot.nodes].sort((left, right) =>
      Number(right.id === demoSnapshot.rootId) - Number(left.id === demoSnapshot.rootId)
    )
  };
  return {
    postMessage(message) {
      if (message.type === 'ready') {
        dispatchHostMessage({ type: 'graphSnapshot', snapshot: currentSnapshot, reason: 'initial' });
      } else if (message.type === 'refresh') {
        dispatchHostMessage({ type: 'announce', tone: 'info', message: 'Demo graph refreshed.' });
      } else if (message.type === 'setIncludeDependencies') {
        currentSnapshot = { ...currentSnapshot, includeDependencies: message.value };
        dispatchHostMessage({
          type: 'graphSnapshot',
          snapshot: currentSnapshot,
          reason: 'settings'
        });
      } else if (message.type === 'toggleSource') {
        const sourceTemplate = demoSnapshot.nodes.find(node =>
          node.kind === 'function' && node.id === message.nodeId
        );
        if (sourceTemplate?.kind === 'function' && sourceTemplate.source !== undefined) {
          const source = sourceTemplate.source;
          currentSnapshot = {
            ...currentSnapshot,
            revision: currentSnapshot.revision + 1,
            nodes: currentSnapshot.nodes.map(node => {
              if (node.kind !== 'function' || node.id !== message.nodeId) {
                return node;
              }
              if (node.source === undefined) {
                return { ...node, source };
              }
              const { source: _source, ...collapsed } = node;
              return collapsed;
            })
          };
          dispatchHostMessage({ type: 'graphSnapshot', snapshot: currentSnapshot, reason: 'source' });
        }
      } else if (message.type === 'openSource') {
        dispatchHostMessage({ type: 'announce', tone: 'info', message: 'VS Code source navigation is available in the packaged extension.' });
      } else if (message.type === 'requestSourceHover') {
        const node = currentSnapshot.nodes.find(candidate => candidate.id === message.nodeId);
        const token = node?.kind === 'function' && node.source !== undefined
          ? identifierAt(node.source.text, message.sourceOffset)
          : 'symbol';
        dispatchHostMessage({
          type: 'sourceHover',
          requestId: message.requestId,
          nodeId: message.nodeId,
          sourceOffset: message.sourceOffset,
          blocks: demoHoverBlocks(token)
        });
      }
    },
    getState: () => state,
    setState(value) {
      state = value;
    }
  };
}

export const bridge: VscodeApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : createBrowserBridge();

export function dispatchHostMessage(message: HostToWebviewMessage): void {
  window.dispatchEvent(new MessageEvent<HostToWebviewMessage>('message', { data: message }));
}

function identifierAt(text: string, offset: number): string {
  let start = Math.max(0, Math.min(offset, text.length));
  let end = start;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1] ?? '')) {
    start -= 1;
  }
  while (end < text.length && /[A-Za-z0-9_]/.test(text[end] ?? '')) {
    end += 1;
  }
  return text.slice(start, end) || 'symbol';
}

function demoHoverBlocks(token: string) {
  const signatures: Readonly<Record<string, string>> = {
    validate_order: 'fn validate_order(order: &Order) -> Result<()>',
    submit_order: 'async fn submit_order(order: &Order) -> Result<Receipt>',
    audit_order: 'fn audit_order(receipt: &Receipt)',
    execute_order: 'pub fn execute_order(order: &Order) -> Result<Receipt>',
    order: 'parameter order: &Order',
    Order: 'struct Order'
  };
  return [
    { kind: 'code' as const, language: 'rust', value: signatures[token] ?? token },
    { kind: 'markdown' as const, value: `Semantic information for **${token}** supplied by the active Rust language provider.` }
  ];
}

export type { WebviewState };
