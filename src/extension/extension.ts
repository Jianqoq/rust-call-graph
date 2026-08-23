import * as vscode from 'vscode';
import { GraphPanel } from './graphPanel.js';
import { VscodeRustLanguageService } from './languageService.js';

export function activate(context: vscode.ExtensionContext): void {
  const language = new VscodeRustLanguageService();
  const panels = new Set<GraphPanel>();

  context.subscriptions.push(
    vscode.commands.registerCommand('rustCallGraph.show', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || editor.document.languageId !== 'rust') {
        void vscode.window.showInformationMessage('Open a Rust file and place the cursor on a function or method first.');
        return;
      }
      try {
        const panel = await GraphPanel.create(context.extensionUri, language, editor);
        if (panel !== undefined) {
          panels.add(panel);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Rust Call Graph could not be opened: ${detail}`);
      }
    }),
    {
      dispose: () => {
        for (const panel of panels) {
          panel.dispose();
        }
        panels.clear();
      }
    }
  );
}

export function deactivate(): void {}
