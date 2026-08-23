import { ReactFlowProvider } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FunctionNodeDto } from '../src/shared/protocol.js';
import type { NodeActions, RustNodeData } from '../src/webview/graphTypes.js';
import { RustNode } from '../src/webview/RustNode.js';

const actions: NodeActions = {
  toggleSource: vi.fn(),
  toggleFunctionDirection: vi.fn(),
  expandType: vi.fn(),
  openSource: vi.fn(),
  focusNode: vi.fn(),
  goBack: vi.fn(),
  hoverRelationship: vi.fn(),
  pinRelationship: vi.fn(),
  followRelationship: vi.fn(),
  requestSourceHover: vi.fn(),
  clearSourceHover: vi.fn()
};

describe('Function Node rendering', () => {
  it('omits the redundant signature summary between its header and actions', () => {
    const dto: FunctionNodeDto = {
      kind: 'function',
      id: 'fn:handle',
      label: 'handle',
      detail: 'pub(crate) fn handle(&mut self, command: WorkerCommand)',
      symbolKind: 11,
      uri: 'file:///workspace/src/lib.rs',
      range: { start: { line: 4, character: 0 }, end: { line: 8, character: 1 } },
      selectionRange: { start: { line: 4, character: 14 }, end: { line: 4, character: 20 } },
      external: false,
      sourceAvailable: true,
      incoming: 'idle',
      outgoing: 'idle',
      hasMoreIncoming: false,
      hasMoreOutgoing: false
    };
    const data: RustNodeData = {
      dto,
      root: false,
      focused: true,
      canGoBack: true,
      incomingActive: false,
      outgoingActive: false,
      proximityTarget: false,
      actions
    };

    const { container } = render(
      <ReactFlowProvider>
        <RustNode data={data} />
      </ReactFlowProvider>
    );

    expect(screen.getByRole('heading', { name: 'handle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Return to previous graph focus' })).toBeTruthy();
    expect(container.querySelector('.node-signature')).toBeNull();
    expect(screen.queryByText(dto.detail)).toBeNull();
  });
});
