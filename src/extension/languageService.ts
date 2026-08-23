import * as vscode from 'vscode';

export interface DefinitionTarget {
  readonly uri: vscode.Uri;
  readonly range: vscode.Range;
}

export interface SemanticTokenSpan {
  readonly range: vscode.Range;
  readonly tokenType: string;
  readonly modifiers: readonly string[];
}

export interface RustLanguageService {
  prepareCallHierarchy(uri: vscode.Uri, position: vscode.Position): Promise<readonly vscode.CallHierarchyItem[]>;
  incomingCalls(item: vscode.CallHierarchyItem): Promise<readonly vscode.CallHierarchyIncomingCall[]>;
  outgoingCalls(item: vscode.CallHierarchyItem): Promise<readonly vscode.CallHierarchyOutgoingCall[]>;
  semanticTokens(uri: vscode.Uri, within: vscode.Range): Promise<readonly SemanticTokenSpan[]>;
  semanticFunctionRanges(uri: vscode.Uri, within: vscode.Range): Promise<readonly vscode.Range[]>;
  definitions(uri: vscode.Uri, position: vscode.Position): Promise<readonly DefinitionTarget[]>;
  hover(uri: vscode.Uri, position: vscode.Position): Promise<readonly vscode.Hover[]>;
}

export class VscodeRustLanguageService implements RustLanguageService {
  async prepareCallHierarchy(uri: vscode.Uri, position: vscode.Position): Promise<readonly vscode.CallHierarchyItem[]> {
    return await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      uri,
      position
    ) ?? [];
  }

  async incomingCalls(item: vscode.CallHierarchyItem): Promise<readonly vscode.CallHierarchyIncomingCall[]> {
    return await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      'vscode.provideIncomingCalls',
      item
    ) ?? [];
  }

  async outgoingCalls(item: vscode.CallHierarchyItem): Promise<readonly vscode.CallHierarchyOutgoingCall[]> {
    return await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
      'vscode.provideOutgoingCalls',
      item
    ) ?? [];
  }

  async semanticTokens(uri: vscode.Uri, within: vscode.Range): Promise<readonly SemanticTokenSpan[]> {
    const [legend, tokens] = await Promise.all([
      vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        'vscode.provideDocumentSemanticTokensLegend',
        uri
      ),
      vscode.commands.executeCommand<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        uri
      )
    ]);

    if (legend === undefined || tokens === undefined) {
      return [];
    }

    const spans: SemanticTokenSpan[] = [];
    let line = 0;
    let character = 0;
    for (let index = 0; index + 4 < tokens.data.length; index += 5) {
      const deltaLine = tokens.data[index] ?? 0;
      const deltaStart = tokens.data[index + 1] ?? 0;
      const length = tokens.data[index + 2] ?? 0;
      const tokenTypeIndex = tokens.data[index + 3] ?? -1;
      const modifierBits = tokens.data[index + 4] ?? 0;
      line += deltaLine;
      character = deltaLine === 0 ? character + deltaStart : deltaStart;
      const tokenType = legend.tokenTypes[tokenTypeIndex];
      if (tokenType === undefined || length <= 0) {
        continue;
      }
      const range = new vscode.Range(line, character, line, character + length);
      if (within.contains(range)) {
        spans.push({
          range,
          tokenType,
          modifiers: legend.tokenModifiers.filter((_, modifierIndex) =>
            Math.floor(modifierBits / (2 ** modifierIndex)) % 2 === 1
          )
        });
      }
    }
    return spans;
  }

  async semanticFunctionRanges(uri: vscode.Uri, within: vscode.Range): Promise<readonly vscode.Range[]> {
    return (await this.semanticTokens(uri, within))
      .filter(token => token.tokenType === 'function' || token.tokenType === 'method')
      .map(token => token.range);
  }

  async definitions(uri: vscode.Uri, position: vscode.Position): Promise<readonly DefinitionTarget[]> {
    const definitions = await vscode.commands.executeCommand<readonly (vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    ) ?? [];

    return definitions.map(definition => {
      if ('targetUri' in definition) {
        return {
          uri: definition.targetUri,
          range: definition.targetSelectionRange ?? definition.targetRange
        };
      }
      return {
        uri: definition.uri,
        range: definition.range
      };
    });
  }

  async hover(uri: vscode.Uri, position: vscode.Position): Promise<readonly vscode.Hover[]> {
    return await vscode.commands.executeCommand<readonly vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position
    ) ?? [];
  }
}
