import type { SyntaxPaletteDto } from '../shared/protocol.js';
import {
  FALLBACK_SYNTAX_PALETTE,
  isVisibleHighlightColor,
  SYNTAX_BRACKET_KEYS,
  SYNTAX_TOKEN_KEYS,
  type SyntaxTokenKey
} from '../shared/syntaxPalette.js';

export interface TokenColorRule {
  readonly scopes: readonly string[];
  readonly foreground: string;
}

export interface ResolvedThemeTokens {
  readonly rules: readonly TokenColorRule[];
  readonly semantic: Readonly<Record<string, string>>;
  readonly colors: Readonly<Record<string, string>>;
}

const PALETTE_SCOPES: Readonly<Record<SyntaxTokenKey, readonly string[]>> = {
  keyword: ['keyword.control.rust', 'keyword.control', 'storage', 'keyword'],
  function: ['entity.name.function.rust', 'entity.name.function', 'support.function.any-method'],
  type: ['entity.name.type.rust', 'storage.type.core.rust', 'entity.name.type', 'entity.name.class', 'support.type'],
  builtinType: ['entity.name.type.primitive.rust', 'entity.name.type.numeric.rust', 'entity.name.type'],
  constant: ['constant.other.caps.rust', 'variable.other.constant.rust', 'constant.other', 'constant'],
  variable: ['variable.other.rust', 'meta.definition.variable', 'variable'],
  parameter: ['variable.other.rust', 'variable.other', 'variable', 'variable.parameter.rust', 'variable.parameter'],
  string: ['string.quoted.double.rust', 'string'],
  number: ['constant.numeric.rust', 'constant.numeric', 'constant'],
  comment: ['comment.line.double-slash.rust', 'comment'],
  attribute: ['meta.attribute.rust', 'entity.other.attribute-name'],
  lifetime: ['entity.name.lifetime.rust', 'storage.modifier.lifetime.rust'],
  operator: ['keyword.operator.rust', 'keyword.operator'],
  macro: ['entity.name.function.macro.rust', 'entity.name.function.macro', 'entity.name.function'],
  namespace: ['entity.name.namespace.rust', 'entity.name.module.rust', 'entity.name.namespace'],
  enumMember: ['entity.name.type.result.rust', 'entity.name.type.option.rust', 'entity.name.type']
};

const SEMANTIC_TYPES: Readonly<Record<SyntaxTokenKey, readonly string[]>> = {
  keyword: ['keyword'],
  function: ['function', 'method'],
  type: ['type', 'struct', 'class', 'enum', 'interface'],
  builtinType: ['builtinType'],
  constant: ['const'],
  variable: ['variable', 'property'],
  parameter: ['parameter', 'variable'],
  string: ['string'],
  number: ['number'],
  comment: ['comment'],
  attribute: ['decorator'],
  lifetime: ['lifetime'],
  operator: ['operator'],
  macro: ['macro'],
  namespace: ['namespace', 'module'],
  enumMember: ['enumMember']
};

export function parseJsonc(text: string): unknown {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return JSON.parse(withoutComments.replace(/,\s*([}\]])/g, '$1'));
}

export function collectTokenRules(tokenColors: unknown): TokenColorRule[] {
  if (!Array.isArray(tokenColors)) {
    return [];
  }
  const rules: TokenColorRule[] = [];
  for (const entry of tokenColors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const settings = (entry as { settings?: unknown }).settings;
    const foreground = foregroundOf(settings);
    if (foreground === undefined) {
      continue;
    }
    const scopes = normalizeScopes((entry as { scope?: unknown }).scope);
    if (scopes.length === 0) {
      continue;
    }
    rules.push({ scopes, foreground });
  }
  return rules;
}

export function collectSemanticForegrounds(semanticTokenColors: unknown): Record<string, string> {
  if (typeof semanticTokenColors !== 'object' || semanticTokenColors === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(semanticTokenColors)) {
    const foreground = typeof value === 'string' ? value : foregroundOf(value);
    if (foreground !== undefined) {
      result[key] = foreground;
    }
  }
  return result;
}

export function matchScopeColor(rules: readonly TokenColorRule[], targetScope: string): string | undefined {
  let best: { readonly score: number; readonly index: number; readonly color: string } | undefined;
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (rule === undefined) {
      continue;
    }
    for (const scope of rule.scopes) {
      if (/\s/u.test(scope) || !scopeMatches(targetScope, scope)) {
        continue;
      }
      const score = scope.length;
      if (best === undefined || score > best.score || (score === best.score && index >= best.index)) {
        best = { score, index, color: rule.foreground };
      }
    }
  }
  return best?.color;
}

export function paletteFromResolvedTheme(theme: ResolvedThemeTokens): SyntaxPaletteDto {
  const next: Record<keyof SyntaxPaletteDto, string> = { ...FALLBACK_SYNTAX_PALETTE };
  for (const key of SYNTAX_TOKEN_KEYS) {
    const semantic = SEMANTIC_TYPES[key]
      .map(type => theme.semantic[type])
      .find((color): color is string => color !== undefined);
    const scoped = PALETTE_SCOPES[key]
      .map(scope => matchScopeColor(theme.rules, scope))
      .find((color): color is string => color !== undefined);
    const unstyled = theme.colors['editor.foreground'];
    const fallback = key === 'namespace' && unstyled !== undefined && isVisibleHighlightColor(unstyled)
      ? unstyled
      : next[key];
    next[key] = semantic ?? scoped ?? fallback;
  }
  for (const [index, key] of SYNTAX_BRACKET_KEYS.entries()) {
    const color = theme.colors[`editorBracketHighlight.foreground${index + 1}`];
    if (color !== undefined && isVisibleHighlightColor(color)) {
      next[key] = color;
    }
  }
  return next;
}

const SIMPLE_TOKEN_CUSTOM_KEYS = {
  comments: 'comment',
  functions: 'function',
  keywords: 'keyword',
  numbers: 'number',
  strings: 'string',
  types: 'type',
  variables: 'variable'
} as const;

export function overlayEditorColorCustomizations(
  palette: SyntaxPaletteDto,
  themeName: string,
  tokenColorCustomizations: unknown,
  semanticTokenColorCustomizations: unknown,
  workbenchColorCustomizations?: unknown
): SyntaxPaletteDto {
  const next: Record<keyof SyntaxPaletteDto, string> = { ...palette };
  const tokenBlock = customizationSection(tokenColorCustomizations, themeName);
  const extraRules = collectTokenRules(tokenBlock.textMateRules);
  for (const key of SYNTAX_TOKEN_KEYS) {
    const scoped = PALETTE_SCOPES[key]
      .map(scope => matchScopeColor(extraRules, scope))
      .find((color): color is string => color !== undefined);
    if (scoped !== undefined) {
      next[key] = scoped;
    }
  }
  for (const [customKey, paletteKey] of Object.entries(SIMPLE_TOKEN_CUSTOM_KEYS)) {
    const value = tokenBlock[customKey];
    if (typeof value === 'string' && value.length > 0) {
      next[paletteKey] = value;
    }
  }

  const semanticBlock = customizationSection(semanticTokenColorCustomizations, themeName);
  const semanticRules = collectSemanticForegrounds(
    semanticBlock.rules === undefined ? semanticBlock : semanticBlock.rules
  );
  for (const key of SYNTAX_TOKEN_KEYS) {
    const semantic = SEMANTIC_TYPES[key]
      .map(type => semanticRules[type])
      .find((color): color is string => color !== undefined);
    if (semantic !== undefined) {
      next[key] = semantic;
    }
  }

  const workbenchColors = collectStringColors(customizationSection(workbenchColorCustomizations, themeName));
  for (const [index, key] of SYNTAX_BRACKET_KEYS.entries()) {
    const color = workbenchColors[`editorBracketHighlight.foreground${index + 1}`];
    if (color !== undefined && isVisibleHighlightColor(color)) {
      next[key] = color;
    }
  }
  return next;
}

function customizationSection(
  customizations: unknown,
  themeName: string
): Record<string, unknown> {
  if (typeof customizations !== 'object' || customizations === null || Array.isArray(customizations)) {
    return {};
  }
  const record = customizations as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('[') && key.endsWith(']')) {
      continue;
    }
    merged[key] = value;
  }
  const specific = record[`[${themeName}]`];
  if (typeof specific === 'object' && specific !== null && !Array.isArray(specific)) {
    Object.assign(merged, specific);
  }
  return merged;
}

export function resolveThemeTokens(
  filePath: string,
  readFile: (path: string) => string,
  dirname: (path: string) => string,
  join: (...parts: string[]) => string,
  depth = 0
): ResolvedThemeTokens {
  if (depth > 8) {
    return { rules: [], semantic: {}, colors: {} };
  }
  const document = parseThemeDocument(readFile(filePath));
  const included = document.include === undefined
    ? { rules: [] as TokenColorRule[], semantic: {} as Record<string, string>, colors: {} as Record<string, string> }
    : resolveThemeTokens(join(dirname(filePath), document.include), readFile, dirname, join, depth + 1);
  return {
    rules: [...included.rules, ...collectTokenRules(document.tokenColors)],
    semantic: {
      ...included.semantic,
      ...collectSemanticForegrounds(document.semanticTokenColors)
    },
    colors: {
      ...included.colors,
      ...document.colors
    }
  };
}

function normalizeScopes(scope: unknown): string[] {
  const entries = typeof scope === 'string'
    ? [scope]
    : Array.isArray(scope)
      ? scope.filter((item): item is string => typeof item === 'string')
      : [];
  return entries.flatMap(entry => entry.split(',')).map(item => item.trim()).filter(item => item.length > 0);
}

function parseThemeDocument(text: string): {
  readonly include?: string;
  readonly tokenColors?: unknown;
  readonly semanticTokenColors?: unknown;
  readonly colors: Readonly<Record<string, string>>;
} {
  const value = parseJsonc(text);
  if (typeof value !== 'object' || value === null) {
    return { colors: {} };
  }
  const record = value as {
    include?: unknown;
    tokenColors?: unknown;
    semanticTokenColors?: unknown;
    colors?: unknown;
  };
  return {
    ...(typeof record.include === 'string' ? { include: record.include } : {}),
    ...(record.tokenColors === undefined ? {} : { tokenColors: record.tokenColors }),
    ...(record.semanticTokenColors === undefined ? {} : { semanticTokenColors: record.semanticTokenColors }),
    colors: collectStringColors(record.colors)
  };
}

function collectStringColors(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const colors: Record<string, string> = {};
  for (const [key, color] of Object.entries(value)) {
    if (typeof color === 'string' && color.length > 0) {
      colors[key] = color;
    }
  }
  return colors;
}

function scopeMatches(target: string, selector: string): boolean {
  return target === selector || target.startsWith(`${selector}.`);
}

function foregroundOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const foreground = (value as { foreground?: unknown }).foreground;
  return typeof foreground === 'string' && foreground.length > 0 ? foreground : undefined;
}
