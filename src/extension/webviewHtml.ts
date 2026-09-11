import * as vscode from 'vscode';
import type { SyntaxPaletteDto } from '../shared/protocol.js';
import { isSafeCssColor, SYNTAX_PALETTE_KEYS, syntaxCssVariable } from '../shared/syntaxPalette.js';

export function webviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  palette: SyntaxPaletteDto
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'app.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.css'));
  const nonce = createNonce();
  const syntaxVars = SYNTAX_PALETTE_KEYS
    .filter(key => isSafeCssColor(palette[key]))
    .map(key => `${syntaxCssVariable(key)}: ${palette[key]};`)
    .join(' ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
    <link rel="stylesheet" href="${styleUri}" />
    <style nonce="${nonce}">:root { ${syntaxVars} }</style>
    <title>Rust Call Graph</title>
  </head>
  <body>
    <a class="skip-link" href="#graph-canvas">Skip to graph</a>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}
