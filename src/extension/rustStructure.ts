export interface RustMethodDefinition {
  readonly name: string;
  readonly nameStart: number;
}

export interface RustTypeDefinition {
  readonly kind: 'struct' | 'enum';
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly nameStart: number;
  readonly nameEnd: number;
  readonly variants: readonly string[];
  readonly methods: readonly RustMethodDefinition[];
}

interface MutableRustTypeDefinition {
  kind: 'struct' | 'enum';
  name: string;
  start: number;
  end: number;
  nameStart: number;
  nameEnd: number;
  variants: string[];
  methods: RustMethodDefinition[];
}

export function scanRustStructure(source: string): readonly RustTypeDefinition[] {
  const code = maskNonCode(source);
  const types = discoverTypes(code);
  attachImplMethods(code, types);
  return types;
}

function discoverTypes(code: string): MutableRustTypeDefinition[] {
  const result: MutableRustTypeDefinition[] = [];
  const declaration = /\b(struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  for (let match = declaration.exec(code); match !== null; match = declaration.exec(code)) {
    const kind = match[1] as 'struct' | 'enum';
    const name = match[2];
    if (name === undefined) {
      continue;
    }

    const nameStart = match.index + match[0].lastIndexOf(name);
    const bodyStart = findDeclarationBodyStart(code, declaration.lastIndex);
    if (bodyStart < 0) {
      continue;
    }

    let end = bodyStart + 1;
    let variants: string[] = [];
    if (code[bodyStart] === '{') {
      const bodyEnd = matchingBrace(code, bodyStart);
      if (bodyEnd < 0) {
        continue;
      }
      end = bodyEnd + 1;
      if (kind === 'enum') {
        variants = discoverEnumVariants(code, bodyStart + 1, bodyEnd);
      }
    } else {
      const semicolon = code.indexOf(';', bodyStart);
      end = semicolon < 0 ? bodyStart + 1 : semicolon + 1;
    }

    result.push({
      kind,
      name,
      start: match.index,
      end,
      nameStart,
      nameEnd: nameStart + name.length,
      variants,
      methods: []
    });
  }

  return result;
}

function findDeclarationBodyStart(code: string, from: number): number {
  for (let index = from; index < code.length; index += 1) {
    const character = code[index];
    if (character === '{' || character === '(' || character === ';') {
      return index;
    }
    if (character === '=') {
      return -1;
    }
  }
  return -1;
}

function discoverEnumVariants(code: string, start: number, end: number): string[] {
  const variants: string[] = [];
  let segmentStart = start;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  const admitSegment = (segmentEnd: number): void => {
    let segment = code.slice(segmentStart, segmentEnd);
    segment = segment.replace(/#\s*\[[^\]]*\]/g, ' ');
    const name = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(segment)?.[1];
    if (name !== undefined && name !== 'where') {
      variants.push(name);
    }
  };

  for (let index = start; index < end; index += 1) {
    switch (code[index]) {
      case '{': braceDepth += 1; break;
      case '}': braceDepth -= 1; break;
      case '(': parenDepth += 1; break;
      case ')': parenDepth -= 1; break;
      case '[': bracketDepth += 1; break;
      case ']': bracketDepth -= 1; break;
      case ',':
        if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
          admitSegment(index);
          segmentStart = index + 1;
        }
        break;
    }
  }
  admitSegment(end);
  return variants;
}

function attachImplMethods(code: string, types: MutableRustTypeDefinition[]): void {
  const byName = new Map(types.map(type => [type.name, type]));
  const implementation = /\bimpl(?:\s*<[^{};]*?>)?\s+([^{};]+)\{/g;

  for (let match = implementation.exec(code); match !== null; match = implementation.exec(code)) {
    const previous = code.slice(Math.max(0, match.index - 8), match.index).trimEnd();
    if (previous.endsWith('->')) {
      continue;
    }

    const header = match[1];
    if (header === undefined) {
      continue;
    }
    const targetName = implTargetName(header);
    const type = targetName === undefined ? undefined : byName.get(targetName);
    if (type === undefined) {
      continue;
    }

    const bodyStart = match.index + match[0].lastIndexOf('{');
    const bodyEnd = matchingBrace(code, bodyStart);
    if (bodyEnd < 0) {
      continue;
    }

    const methodPattern = /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    methodPattern.lastIndex = bodyStart + 1;
    for (let method = methodPattern.exec(code); method !== null && method.index < bodyEnd; method = methodPattern.exec(code)) {
      if (braceDepthBetween(code, bodyStart + 1, method.index) !== 0) {
        continue;
      }
      const name = method[1];
      if (name === undefined) {
        continue;
      }
      const nameStart = method.index + method[0].lastIndexOf(name);
      type.methods.push({ name, nameStart });
    }

    implementation.lastIndex = bodyEnd + 1;
  }
}

function implTargetName(header: string): string | undefined {
  const withoutWhere = header.split(/\bwhere\b/, 1)[0]?.trim();
  if (!withoutWhere) {
    return undefined;
  }
  const target = withoutWhere.split(/\bfor\b/).at(-1)?.trim();
  if (!target) {
    return undefined;
  }
  const path = /^((?:[A-Za-z_][A-Za-z0-9_]*::)*[A-Za-z_][A-Za-z0-9_]*)/.exec(target)?.[1];
  return path?.split('::').at(-1);
}

function matchingBrace(code: string, open: number): number {
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === '{') {
      depth += 1;
    } else if (code[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function braceDepthBetween(code: string, start: number, end: number): number {
  let depth = 0;
  for (let index = start; index < end; index += 1) {
    if (code[index] === '{') {
      depth += 1;
    } else if (code[index] === '}') {
      depth -= 1;
    }
  }
  return depth;
}

function maskNonCode(source: string): string {
  const masked = source.split('');
  const blank = (index: number): void => {
    if (masked[index] !== '\n' && masked[index] !== '\r') {
      masked[index] = ' ';
    }
  };

  for (let index = 0; index < source.length;) {
    if (source.startsWith('//', index)) {
      while (index < source.length && source[index] !== '\n') {
        blank(index);
        index += 1;
      }
      continue;
    }

    if (source.startsWith('/*', index)) {
      let depth = 0;
      while (index < source.length) {
        if (source.startsWith('/*', index)) {
          depth += 1;
          blank(index);
          blank(index + 1);
          index += 2;
        } else if (source.startsWith('*/', index)) {
          depth -= 1;
          blank(index);
          blank(index + 1);
          index += 2;
          if (depth === 0) {
            break;
          }
        } else {
          blank(index);
          index += 1;
        }
      }
      continue;
    }

    const raw = /^(?:br|r)(#{0,16})"/.exec(source.slice(index));
    if (raw !== null) {
      const hashes = raw[1] ?? '';
      const terminator = `"${hashes}`;
      let cursor = index + raw[0].length;
      while (cursor < source.length && !source.startsWith(terminator, cursor)) {
        cursor += 1;
      }
      const end = Math.min(source.length, cursor + terminator.length);
      while (index < end) {
        blank(index);
        index += 1;
      }
      continue;
    }

    if (source[index] === '"' || (source[index] === 'b' && source[index + 1] === '"')) {
      const quote = source[index] === '"' ? index : index + 1;
      let cursor = quote + 1;
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2;
        } else if (source[cursor] === '"') {
          cursor += 1;
          break;
        } else {
          cursor += 1;
        }
      }
      while (index < cursor) {
        blank(index);
        index += 1;
      }
      continue;
    }

    if (source[index] === '\'' && isCharLiteral(source, index)) {
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2;
        } else if (source[cursor] === '\'') {
          cursor += 1;
          break;
        } else {
          cursor += 1;
        }
      }
      while (index < cursor) {
        blank(index);
        index += 1;
      }
      continue;
    }

    index += 1;
  }

  return masked.join('');
}

function isCharLiteral(source: string, start: number): boolean {
  const lineEnd = source.indexOf('\n', start + 1);
  const limit = lineEnd < 0 ? source.length : lineEnd;
  const closing = source.indexOf('\'', start + 1);
  return closing >= 0 && closing < limit && closing - start <= 8;
}
