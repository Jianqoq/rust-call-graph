import assert from 'node:assert/strict';
import path from 'node:path';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  const fixtureRoot = process.env.RUST_CALL_GRAPH_FIXTURE;
  assert.ok(fixtureRoot, 'RUST_CALL_GRAPH_FIXTURE must be set');

  const rustAnalyzer = vscode.extensions.getExtension('rust-lang.rust-analyzer');
  assert.ok(rustAnalyzer, 'The integration test requires the installed rust-analyzer extension');
  await rustAnalyzer.activate();

  const extension = vscode.extensions.getExtension('rust-call-graph.rust-call-graph');
  assert.ok(extension, 'Rust Call Graph extension was not discovered');
  await extension.activate();

  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(path.join(fixtureRoot, 'src', 'lib.rs'))
  );
  const source = document.getText();
  const functionOffset = source.indexOf('execute<G: Gateway>');
  assert.notEqual(functionOffset, -1, 'Fixture execute method is missing');
  const position = document.positionAt(functionOffset);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(position, position);

  const items = await waitFor(async () => {
    const result = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      document.uri,
      position
    );
    return result && result.length > 0 ? result : undefined;
  }, 45_000, 'rust-analyzer call hierarchy');

  assert.equal(items[0]?.name, 'execute');
  const outgoing = await waitFor(async () => {
    const result = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
      'vscode.provideOutgoingCalls',
      items[0]
    ) ?? [];
    return result.some(call => call.to.name === 'validate_order') ? result : undefined;
  }, 45_000, 'rust-analyzer outgoing calls');
  assert.ok(outgoing.some(call => call.to.name === 'validate_order'), 'Expected validate_order outgoing call');
  assert.ok(outgoing.some(call => call.to.name === 'submit'), 'Expected trait submit outgoing call');

  const hoverOffset = source.indexOf('validate_order(self)');
  assert.notEqual(hoverOffset, -1, 'Fixture validate_order call is missing');
  const hoverPosition = document.positionAt(hoverOffset + 2);
  const hovers = await waitFor(async () => {
    const result = await vscode.commands.executeCommand<readonly vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      hoverPosition
    ) ?? [];
    return result.some(hover => hover.contents.length > 0) ? result : undefined;
  }, 45_000, 'rust-analyzer hover provider');
  const hoverText = hovers.flatMap(hover => hover.contents).map(content =>
    typeof content === 'string' ? content : content.value
  ).join('\n');
  assert.match(hoverText, /validate_order/, 'Expected rust-analyzer hover for validate_order');

  await vscode.commands.executeCommand('rustCallGraph.show');
  const graphTab = await waitFor(async () => vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .find(tab => tab.input instanceof vscode.TabInputWebview && tab.label.startsWith('Rust Call Graph —')),
  15_000,
  'Rust Call Graph webview tab');
  assert.ok(graphTab);

  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

async function waitFor<T>(
  operation: () => Promise<T | undefined>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value !== undefined) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}${lastError === undefined ? '' : `: ${String(lastError)}`}`);
}
