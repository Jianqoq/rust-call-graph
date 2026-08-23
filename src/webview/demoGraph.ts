import type { GraphSnapshotDto } from '../shared/protocol.js';

const range = (line: number, start: number, end: number) => ({
  start: { line, character: start },
  end: { line, character: end }
});

const sourceText = `pub fn execute_order(order: &Order) -> Result<Receipt> {
    validate_order(order)?;
    let mapper = audit_order;
    let receipt = crate::gateway::submit_order(order)?;
    mapper(&receipt);
    Ok(receipt)
}`;

const validateOffset = sourceText.indexOf('validate_order');
const auditReferenceOffset = sourceText.indexOf('audit_order');
const submitOffset = sourceText.indexOf('submit_order');
const auditCallOffset = sourceText.indexOf('mapper(&');

function semanticToken(
  tokenType: string,
  text: string,
  startOffset: number,
  modifiers: readonly string[] = []
) {
  return { startOffset, endOffset: startOffset + text.length, tokenType, modifiers };
}

export const demoSnapshot: GraphSnapshotDto = {
  revision: 1,
  rootId: 'fn:execute_order',
  includeDependencies: false,
  limits: {
    nodeCount: 6,
    maxNodes: 250,
    expansionBatchSize: 50,
    limitReached: false
  },
  nodes: [
    {
      kind: 'type',
      id: 'type:order',
      typeKind: 'struct',
      label: 'Order',
      detail: 'struct · 3 associated functions',
      uri: 'file:///demo/src/lib.rs',
      range: range(1, 0, 30),
      selectionRange: range(1, 11, 16),
      variants: [],
      methodCount: 3,
      expanded: false,
      hasMoreMethods: true
    },
    {
      kind: 'function',
      id: 'fn:route_order',
      label: 'route_order',
      detail: 'fn route_order(order: Order)',
      symbolKind: 11,
      uri: 'file:///demo/src/lib.rs',
      range: range(8, 0, 70),
      selectionRange: range(8, 7, 18),
      external: false,
      sourceAvailable: true,
      incoming: 'complete',
      outgoing: 'complete',
      hasMoreIncoming: false,
      hasMoreOutgoing: false
    },
    {
      kind: 'function',
      id: 'fn:execute_order',
      label: 'execute_order',
      detail: 'pub fn execute_order(order: &Order) -> Result<Receipt>',
      symbolKind: 11,
      uri: 'file:///demo/src/lib.rs',
      range: { start: { line: 12, character: 0 }, end: { line: 18, character: 1 } },
      selectionRange: range(12, 7, 20),
      external: false,
      sourceAvailable: true,
      incoming: 'complete',
      outgoing: 'complete',
      hasMoreIncoming: false,
      hasMoreOutgoing: false,
      source: {
        text: sourceText,
        startLine: 12,
        startCharacter: 0,
        semanticTokens: [
          semanticToken('function', 'execute_order', sourceText.indexOf('execute_order'), ['declaration']),
          semanticToken('parameter', 'order', sourceText.indexOf('order', sourceText.indexOf('execute_order') + 'execute_order'.length), ['declaration']),
          semanticToken('struct', 'Order', sourceText.indexOf('Order')),
          semanticToken('enum', 'Result', sourceText.indexOf('Result')),
          semanticToken('struct', 'Receipt', sourceText.indexOf('Receipt')),
          semanticToken('function', 'validate_order', validateOffset),
          semanticToken('variable', 'mapper', sourceText.indexOf('mapper'), ['declaration']),
          semanticToken('function', 'audit_order', auditReferenceOffset),
          semanticToken('function', 'submit_order', submitOffset),
          semanticToken('variable', 'mapper', auditCallOffset),
          semanticToken('enumMember', 'Ok', sourceText.indexOf('Ok'))
        ],
        relationships: [
          { id: 'source:validate', edgeId: 'edge:validate', kind: 'call', startOffset: validateOffset, endOffset: validateOffset + 'validate_order'.length, targetNodeId: 'fn:validate_order', label: 'validate_order' },
          { id: 'source:audit', edgeId: 'edge:audit', kind: 'reference', startOffset: auditReferenceOffset, endOffset: auditReferenceOffset + 'audit_order'.length, targetNodeId: 'fn:audit_order', label: 'audit_order' },
          { id: 'source:submit', edgeId: 'edge:submit', kind: 'call', startOffset: submitOffset, endOffset: submitOffset + 'submit_order'.length, targetNodeId: 'fn:submit_order', label: 'submit_order' },
          { id: 'source:audit-call', edgeId: 'edge:audit-call', kind: 'call', startOffset: auditCallOffset, endOffset: auditCallOffset + 'mapper'.length, targetNodeId: 'fn:audit_order', label: 'audit_order' }
        ]
      }
    },
    {
      kind: 'function',
      id: 'fn:validate_order',
      label: 'validate_order',
      detail: 'fn validate_order(order: &Order) -> Result<()>',
      symbolKind: 11,
      uri: 'file:///demo/src/validation.rs',
      range: range(3, 0, 72),
      selectionRange: range(3, 3, 17),
      external: false,
      sourceAvailable: true,
      incoming: 'idle',
      outgoing: 'idle',
      hasMoreIncoming: false,
      hasMoreOutgoing: false
    },
    {
      kind: 'function',
      id: 'fn:submit_order',
      label: 'submit_order',
      detail: 'async fn submit_order(order: &Order) -> Result<Receipt>',
      symbolKind: 11,
      uri: 'file:///demo/src/gateway.rs',
      range: range(22, 0, 80),
      selectionRange: range(22, 9, 21),
      external: false,
      sourceAvailable: true,
      incoming: 'idle',
      outgoing: 'truncated',
      hasMoreIncoming: false,
      hasMoreOutgoing: true
    },
    {
      kind: 'function',
      id: 'fn:audit_order',
      label: 'audit_order',
      detail: 'fn audit_order(receipt: &Receipt)',
      symbolKind: 11,
      uri: 'file:///demo/src/audit.rs',
      range: range(5, 0, 54),
      selectionRange: range(5, 3, 14),
      external: false,
      sourceAvailable: true,
      incoming: 'idle',
      outgoing: 'idle',
      hasMoreIncoming: false,
      hasMoreOutgoing: false
    }
  ],
  edges: [
    { id: 'edge:member', source: 'type:order', target: 'fn:execute_order', kind: 'membership', label: 'associated function' },
    { id: 'edge:route', source: 'fn:route_order', target: 'fn:execute_order', kind: 'call' },
    { id: 'edge:validate', source: 'fn:execute_order', target: 'fn:validate_order', kind: 'call', sourceRange: range(13, 4, 18) },
    { id: 'edge:audit', source: 'fn:execute_order', target: 'fn:audit_order', kind: 'reference', sourceRange: range(14, 17, 28) },
    { id: 'edge:submit', source: 'fn:execute_order', target: 'fn:submit_order', kind: 'call', sourceRange: range(15, 18, 30) },
    { id: 'edge:audit-call', source: 'fn:execute_order', target: 'fn:audit_order', kind: 'call', sourceRange: range(16, 4, 10) }
  ]
};
