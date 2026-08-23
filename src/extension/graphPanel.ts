import * as vscode from 'vscode';
import type { HostToWebviewMessage, SourceHoverBlockDto, WebviewToHostMessage } from '../shared/protocol.js';
import { isWebviewToHostMessage } from '../shared/protocol.js';
import { readGraphConfiguration } from './config.js';
import { GraphSession } from './graphSession.js';
import type { RustLanguageService } from './languageService.js';
import { webviewHtml } from './webviewHtml.js';

export class GraphPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private disposed = false;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly language: RustLanguageService,
    private session: GraphSession
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')]
    };
    panel.webview.html = webviewHtml(panel.webview, extensionUri);
    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage(value => this.onMessage(value)),
      vscode.workspace.onDidChangeTextDocument(event => this.onDocumentChanged(event)),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('rustCallGraph')) {
          void this.refresh('settings');
        }
      })
    );
  }

  static async create(
    extensionUri: vscode.Uri,
    language: RustLanguageService,
    editor: vscode.TextEditor
  ): Promise<GraphPanel | undefined> {
    const rootItem = await resolveEntryItem(language, editor.document, editor.selection.active);
    if (rootItem === undefined) {
      void vscode.window.showWarningMessage(
        'Rust Call Graph could not resolve a function at the cursor. Wait for the Rust language provider to finish loading, then place the cursor on a function or method and try again.'
      );
      return undefined;
    }

    const session = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Building Rust call graph for ${rootItem.name}`,
        cancellable: false
      },
      async () => GraphSession.create(language, rootItem, readGraphConfiguration())
    );

    const panel = vscode.window.createWebviewPanel(
      'rustCallGraph.graph',
      `Rust Call Graph — ${rootItem.name}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    return new GraphPanel(panel, extensionUri, language, session);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.refreshTimer !== undefined) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async onMessage(value: unknown): Promise<void> {
    if (!isWebviewToHostMessage(value) || this.disposed) {
      return;
    }
    const message = value as WebviewToHostMessage;
    try {
      switch (message.type) {
        case 'ready':
          await this.postSnapshot('initial');
          break;
        case 'expandFunction':
          await this.withOperation('Expanding function relationships', async () => {
            await this.session.expandFunction(message.nodeId, message.direction);
            await this.postSnapshot('expand');
          });
          break;
        case 'expandType':
          await this.withOperation('Resolving associated functions', async () => {
            await this.session.expandType(message.nodeId, message.loadMore);
            await this.postSnapshot('expand');
          });
          break;
        case 'toggleSource':
          await this.withOperation('Loading function source', async () => {
            await this.session.toggleSource(message.nodeId);
            await this.postSnapshot('source');
          });
          break;
        case 'openSource':
          await this.openSource(message.nodeId);
          break;
        case 'requestSourceHover':
          await this.provideSourceHover(message.requestId, message.nodeId, message.sourceOffset);
          break;
        case 'refresh':
          await this.refresh('refresh');
          break;
        case 'setIncludeDependencies':
          this.session.setIncludeDependencies(message.value);
          await vscode.workspace.getConfiguration('rustCallGraph').update(
            'includeDependencies',
            message.value,
            vscode.workspace.workspaceFile === undefined && vscode.workspace.workspaceFolders === undefined
              ? vscode.ConfigurationTarget.Global
              : vscode.ConfigurationTarget.Workspace
          );
          await this.postSnapshot('settings');
          break;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.post({
        type: 'announce',
        tone: 'error',
        message: `Rust Call Graph: ${detail}`
      });
    }
  }

  private async withOperation(label: string, action: () => Promise<void>): Promise<void> {
    await this.post({ type: 'operation', state: 'loading', label });
    try {
      await action();
    } finally {
      await this.post({ type: 'operation', state: 'idle', label: '' });
    }
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (event.document.languageId !== 'rust' || !this.session.representedUris.includes(event.document.uri.toString())) {
      return;
    }
    if (this.refreshTimer !== undefined) {
      clearTimeout(this.refreshTimer);
    }
    const delay = readGraphConfiguration().refreshDebounceMs;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh('refresh');
    }, delay);
  }

  private async refresh(reason: 'refresh' | 'settings'): Promise<void> {
    await this.withOperation('Refreshing Rust call graph', async () => {
      const uri = this.session.rootItem.uri;
      let root = (await this.language.prepareCallHierarchy(uri, this.session.rootPosition))[0];
      if (root === undefined) {
        const document = await vscode.workspace.openTextDocument(uri);
        const fallback = await findNamedFunctionPosition(document, this.session.rootLabel, this.session.rootPosition);
        if (fallback !== undefined) {
          root = (await this.language.prepareCallHierarchy(uri, fallback))[0];
        }
      }
      if (root === undefined) {
        await this.post({
          type: 'announce',
          tone: 'warning',
          message: `The entry function ${this.session.rootLabel} is no longer resolvable.`
        });
        return;
      }
      const next = await GraphSession.create(this.language, root, readGraphConfiguration());
      await this.session.replayInto(next);
      this.session = next;
      this.panel.title = `Rust Call Graph — ${root.name}`;
      await this.postSnapshot(reason);
    });
  }

  private async openSource(nodeId: string): Promise<void> {
    const location = this.session.sourceLocation(nodeId);
    if (location === undefined) {
      await this.post({ type: 'announce', tone: 'warning', message: 'Source is unavailable for this node.' });
      return;
    }
    const document = await vscode.workspace.openTextDocument(location.uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
      selection: location.range,
      viewColumn: vscode.ViewColumn.One
    });
  }

  private async provideSourceHover(requestId: number, nodeId: string, sourceOffset: number): Promise<void> {
    const source = await this.session.sourcePosition(nodeId, sourceOffset);
    const blocks = source === undefined
      ? []
      : serializeHoverBlocks(await this.language.hover(source.uri, source.position));
    await this.post({ type: 'sourceHover', requestId, nodeId, sourceOffset, blocks });
  }

  private async postSnapshot(reason: 'initial' | 'expand' | 'source' | 'refresh' | 'settings'): Promise<void> {
    await this.post({ type: 'graphSnapshot', snapshot: this.session.snapshot, reason });
  }

  private async post(message: HostToWebviewMessage): Promise<void> {
    if (!this.disposed) {
      await this.panel.webview.postMessage(message);
    }
  }
}

function serializeHoverBlocks(hovers: readonly vscode.Hover[]): SourceHoverBlockDto[] {
  const blocks: SourceHoverBlockDto[] = [];
  for (const hover of hovers) {
    for (const content of hover.contents) {
      if (typeof content === 'string') {
        if (content.trim().length > 0) {
          blocks.push({ kind: 'markdown', value: content });
        }
      } else if ('language' in content) {
        if (content.value.trim().length > 0) {
          blocks.push({ kind: 'code', language: content.language, value: content.value });
        }
      } else if (content.value.trim().length > 0) {
        blocks.push({ kind: 'markdown', value: content.value });
      }
    }
  }
  return blocks;
}

async function resolveEntryItem(
  language: RustLanguageService,
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.CallHierarchyItem | undefined> {
  const direct = await language.prepareCallHierarchy(document.uri, position);
  if (direct[0] !== undefined) {
    return direct[0];
  }

  const symbols = await vscode.commands.executeCommand<readonly vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    document.uri
  ) ?? [];
  const symbol = smallestFunctionContaining(symbols, position);
  if (symbol === undefined) {
    return undefined;
  }
  return (await language.prepareCallHierarchy(document.uri, symbol.selectionRange.start))[0];
}

function smallestFunctionContaining(
  symbols: readonly vscode.DocumentSymbol[],
  position: vscode.Position
): vscode.DocumentSymbol | undefined {
  let best: vscode.DocumentSymbol | undefined;
  const visit = (symbol: vscode.DocumentSymbol): void => {
    if (symbol.range.contains(position)
      && (symbol.kind === vscode.SymbolKind.Function
        || symbol.kind === vscode.SymbolKind.Method
        || symbol.kind === vscode.SymbolKind.Constructor)) {
      if (best === undefined || rangeSize(symbol.range) < rangeSize(best.range)) {
        best = symbol;
      }
    }
    for (const child of symbol.children) {
      visit(child);
    }
  };
  for (const symbol of symbols) {
    visit(symbol);
  }
  return best;
}

function rangeSize(range: vscode.Range): number {
  return (range.end.line - range.start.line) * 100_000 + range.end.character - range.start.character;
}

async function findNamedFunctionPosition(
  document: vscode.TextDocument,
  name: string,
  near: vscode.Position
): Promise<vscode.Position | undefined> {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\bfn\\s+(${escaped})\\b`, 'g');
  const text = document.getText();
  let best: { readonly position: vscode.Position; readonly distance: number } | undefined;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const nameOffset = match.index + match[0].lastIndexOf(name);
    const position = document.positionAt(nameOffset);
    const distance = Math.abs(position.line - near.line);
    if (best === undefined || distance < best.distance) {
      best = { position, distance };
    }
  }
  return best?.position;
}
