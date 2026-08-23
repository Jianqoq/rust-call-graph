import * as ContextMenu from '@radix-ui/react-context-menu';
import { Handle, Position } from '@xyflow/react';
import {
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  CornerUpLeft,
  ExternalLink,
  Focus,
  GitBranch,
  ListTree,
  MoreHorizontal
} from 'lucide-react';
import type { FunctionNodeDto, FunctionExpansionState, TypeNodeDto } from '../shared/protocol.js';
import type { RustNodeData } from './graphTypes.js';
import { SourceCode } from './SourceCode.js';

export function RustNode({ data, selected }: { readonly data: RustNodeData; readonly selected?: boolean }) {
  const { dto, actions } = data;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <article
          className={`rust-node rust-node-${dto.kind}${data.root ? ' is-root' : ''}${data.focused ? ' is-focused' : ''}${data.proximityTarget ? ' is-proximity-target' : ''}${selected ? ' is-selected' : ''}`}
          aria-label={`${dto.kind === 'function' ? 'Function' : dto.typeKind} ${dto.label}`}
          tabIndex={0}
        >
          <Handle type="target" id="target" position={Position.Left} isConnectable={false} className="node-handle node-handle-target" />
          <NodeHeader data={data} />
          {dto.kind === 'function'
            ? <FunctionBody node={dto} data={data} />
            : <TypeBody node={dto} data={data} />}
          <Handle type="source" id="source" position={Position.Right} isConnectable={false} className="node-handle node-handle-source" />
        </article>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="node-context-menu" collisionPadding={12}>
          <ContextMenu.Label className="context-label">{dto.label}</ContextMenu.Label>
          <ContextMenu.Item className="context-item" onSelect={() => actions.focusNode(dto.id)}>
            <Focus aria-hidden="true" /> Focus in graph
          </ContextMenu.Item>
          <ContextMenu.Item className="context-item" onSelect={() => actions.openSource(dto.id)}>
            <ExternalLink aria-hidden="true" /> Open Source in VS Code
          </ContextMenu.Item>
          {dto.kind === 'function' && (
            <ContextMenu.Item className="context-item" onSelect={() => actions.toggleSource(dto.id)}>
              <Code2 aria-hidden="true" /> {dto.source === undefined ? 'Expand source' : 'Collapse source'}
            </ContextMenu.Item>
          )}
          <ContextMenu.Separator className="context-separator" />
          <ContextMenu.Item className="context-item context-muted" disabled>
            <MoreHorizontal aria-hidden="true" /> {shortLocation(dto.uri, dto.selectionRange.start.line)}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function NodeHeader({ data }: { readonly data: RustNodeData }) {
  const { dto } = data;
  return (
    <header className="node-header">
      <div className={`node-kind-icon node-kind-${dto.kind}`} aria-hidden="true">
        {dto.kind === 'function' ? <GitBranch /> : <Braces />}
      </div>
      <div className="node-title-block">
        <div className="node-kicker">
          {dto.kind === 'function' ? 'function' : dto.typeKind}
          {data.root && <span className="node-root-badge">entry</span>}
          {dto.kind === 'function' && dto.external && <span className="node-external-badge">dependency</span>}
        </div>
        <h2 className="node-title">{dto.label}</h2>
      </div>
      {data.canGoBack && (
        <button type="button" className="node-back nodrag" onClick={data.actions.goBack} aria-label="Return to previous graph focus">
          <CornerUpLeft aria-hidden="true" /> Back
        </button>
      )}
    </header>
  );
}

function FunctionBody({ node, data }: { readonly node: FunctionNodeDto; readonly data: RustNodeData }) {
  return (
    <>
      {node.detail && <div className="node-signature" title={node.detail}>{node.detail}</div>}
      <div className="node-actions">
        <ExpansionButton
          side="incoming"
          state={node.incoming}
          active={data.incomingActive}
          onClick={() => data.actions.toggleFunctionDirection(node.id, 'incoming', node.incoming, data.incomingActive)}
        />
        <button
          type="button"
          className="node-source-toggle nodrag"
          onClick={() => data.actions.toggleSource(node.id)}
          disabled={!node.sourceAvailable}
          aria-expanded={node.source !== undefined}
        >
          <Code2 aria-hidden="true" />
          {node.source === undefined ? 'Source' : 'Hide source'}
          {node.source === undefined ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
        <ExpansionButton
          side="outgoing"
          state={node.outgoing}
          active={data.outgoingActive}
          onClick={() => data.actions.toggleFunctionDirection(node.id, 'outgoing', node.outgoing, data.outgoingActive)}
        />
      </div>
      {node.source !== undefined && (
        <SourceCode
          nodeId={node.id}
          source={node.source}
          {...(data.sourceHover === undefined ? {} : { sourceHover: data.sourceHover })}
          actions={data.actions}
        />
      )}
    </>
  );
}

function TypeBody({ node, data }: { readonly node: TypeNodeDto; readonly data: RustNodeData }) {
  return (
    <div className="type-body">
      <p className="type-detail">{node.detail}</p>
      {node.typeKind === 'enum' && node.variants.length > 0 && (
        <div className="variant-list" aria-label="Enum variants">
          {node.variants.slice(0, 8).map(variant => <span key={variant}>{variant}</span>)}
          {node.variants.length > 8 && <span>+{node.variants.length - 8}</span>}
        </div>
      )}
      <button
        type="button"
        className="type-expand nodrag"
        onClick={() => data.actions.expandType(node.id, node.hasMoreMethods && node.expanded)}
        disabled={node.methodCount === 0 || (node.expanded && !node.hasMoreMethods)}
      >
        <ListTree aria-hidden="true" />
        {!node.expanded ? `Reveal ${node.methodCount} associated` : node.hasMoreMethods ? 'Load more associated' : 'Associated functions revealed'}
        {node.expanded && !node.hasMoreMethods && <Check aria-hidden="true" />}
      </button>
    </div>
  );
}

function ExpansionButton({
  side,
  state,
  active,
  onClick
}: {
  readonly side: 'incoming' | 'outgoing';
  readonly state: FunctionExpansionState;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  const incoming = side === 'incoming';
  const unavailable = state === 'unavailable';
  const loading = state === 'loading';
  const relationship = incoming ? 'callers' : 'callees';
  const label = unavailable
    ? `${relationship} unavailable`
    : loading
      ? `Loading all ${relationship}`
      : active
        ? `Hide all ${relationship}`
        : state === 'idle'
          ? `Load and show all ${relationship}`
          : `Show all ${relationship}`;
  return (
    <button
      type="button"
      className={`edge-expand edge-expand-${side}${active ? ' is-active' : ''} nodrag`}
      onClick={onClick}
      disabled={unavailable || loading}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <span>{incoming ? 'in' : 'out'}</span>
    </button>
  );
}

function shortLocation(uri: string, zeroBasedLine: number): string {
  const path = decodeURIComponent(uri).replace(/^file:\/\//, '').replace(/\\/g, '/');
  const segments = path.split('/').filter(Boolean);
  return `${segments.slice(-2).join('/')}:${zeroBasedLine + 1}`;
}
