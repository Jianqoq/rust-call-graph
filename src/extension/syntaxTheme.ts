import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import type { SyntaxPaletteDto } from '../shared/protocol.js';
import { FALLBACK_SYNTAX_PALETTE } from '../shared/syntaxPalette.js';
import {
  overlayEditorColorCustomizations,
  paletteFromResolvedTheme,
  resolveThemeTokens,
  type ResolvedThemeTokens
} from './themeTokenColors.js';

export function readActiveSyntaxPalette(): SyntaxPaletteDto {
  try {
    const themeName = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '';
    const themePath = findThemePath(themeName);
    const semanticHighlighting = vscode.workspace.getConfiguration('editor').get('semanticHighlighting.enabled');
    const useSemantic = semanticHighlighting !== false;
    const loaded = themePath === undefined
      ? emptyTheme()
      : resolveThemeTokens(themePath, readFileSyncPath, path.dirname, path.join);
    const theme: ResolvedThemeTokens = {
      rules: loaded.rules,
      semantic: useSemantic ? loaded.semantic : {}
    };
    const palette = paletteFromResolvedTheme(theme);
    return overlayEditorColorCustomizations(
      palette,
      themeName,
      vscode.workspace.getConfiguration('editor').get('tokenColorCustomizations'),
      vscode.workspace.getConfiguration('editor').get('semanticTokenColorCustomizations')
    );
  } catch {
    return FALLBACK_SYNTAX_PALETTE;
  }
}

function emptyTheme(): ResolvedThemeTokens {
  return { rules: [], semantic: {} };
}

function readFileSyncPath(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function findThemePath(themeName: string): string | undefined {
  if (themeName.length === 0) {
    return undefined;
  }
  for (const extension of vscode.extensions.all) {
    const themes = extension.packageJSON?.contributes?.themes;
    if (!Array.isArray(themes)) {
      continue;
    }
    for (const theme of themes) {
      if (typeof theme !== 'object' || theme === null) {
        continue;
      }
      const record = theme as { label?: unknown; id?: unknown; path?: unknown };
      const label = typeof record.label === 'string' ? record.label : undefined;
      const id = typeof record.id === 'string' ? record.id : undefined;
      if (label !== themeName && id !== themeName) {
        continue;
      }
      if (typeof record.path !== 'string') {
        return undefined;
      }
      return path.join(extension.extensionPath, record.path);
    }
  }
  return undefined;
}
