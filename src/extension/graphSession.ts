import * as vscode from 'vscode';
import type {
  FunctionNodeDto,
  FunctionSourceDto,
  GraphEdgeDto,
  GraphNodeDto,
  GraphSnapshotDto,
  RelationshipKind,
  SourceSemanticTokenDto,
  SourceRelationshipDto,
  TypeNodeDto
} from '../shared/protocol.js';
import { sourceRelationshipNameRange } from '../shared/sourceRelationship.js';
import type { GraphConfiguration } from './config.js';
import type { RustLanguageService } from './languageService.js';
import { relativeOffsets, rangesOverlap, stableRangeKey, toRangeDto } from './range.js';
import { scanRustStructure, type RustTypeDefinition } from './rustStructure.js';

interface FunctionRecord {
  node: FunctionNodeDto;
  readonly item: vscode.CallHierarchyItem;
}

interface TypeRecord {
  node: TypeNodeDto;
  readonly definition: RustTypeDefinition;
  readonly document: vscode.TextDocument;
  cursor: number;
}

interface PendingRelation {
  readonly kind: Exclude<RelationshipKind, 'membership'>;
  readonly sourceItem: vscode.CallHierarchyItem;
  readonly targetItem: vscode.CallHierarchyItem;
  readonly sourceRange?: vscode.Range;
}

type ReplayAction =
  | { readonly kind: 'function'; readonly nodeId: string; readonly direction: 'incoming' | 'outgoing' }
  | { readonly kind: 'type'; readonly nodeId: string; readonly loadMore: boolean };

interface StructureCatalog {
  readonly document: vscode.TextDocument;
  readonly definitions: readonly RustTypeDefinition[];
}

export interface SourceLocation {
  readonly uri: vscode.Uri;
  readonly range: vscode.Range;
}

export interface SourcePosition {
  readonly uri: vscode.Uri;
  readonly position: vscode.Position;
}

export class GraphSession {
  private readonly functions = new Map<string, FunctionRecord>();
  private readonly types = new Map<string, TypeRecord>();
  private readonly edges = new Map<string, GraphEdgeDto>();
  private readonly structureCatalogs = new Map<string, Promise<StructureCatalog>>();
  private readonly replayActions: ReplayAction[] = [];
  private readonly expandedSources = new Set<string>();
  private revision = 0;
  private limitReached = false;
  private includeDependencies: boolean;

  private constructor(
    private readonly language: RustLanguageService,
    private readonly configuration: GraphConfiguration,
    readonly rootItem: vscode.CallHierarchyItem,
    readonly rootId: string
  ) {
    this.includeDependencies = configuration.includeDependencies;
  }

  static async create(
    language: RustLanguageService,
    rootItem: vscode.CallHierarchyItem,
    configuration: GraphConfiguration
  ): Promise<GraphSession> {
    const rootId = functionId(rootItem);
    const session = new GraphSession(language, configuration, rootItem, rootId);
    await session.addFunction(rootItem);
    await Promise.all([
      session.expandFunctionInternal(rootId, 'incoming', false),
      session.expandFunctionInternal(rootId, 'outgoing', false)
    ]);
    session.touch();
    return session;
  }

  get snapshot(): GraphSnapshotDto {
    return {
      revision: this.revision,
      rootId: this.rootId,
      nodes: [
        ...[...this.types.values()].map(record => record.node),
        ...[...this.functions.values()].map(record => record.node)
      ] as GraphNodeDto[],
      edges: [...this.edges.values()],
      includeDependencies: this.includeDependencies,
      limits: {
        nodeCount: this.nodeCount,
        maxNodes: this.configuration.maxNodes,
        expansionBatchSize: this.configuration.expansionBatchSize,
        limitReached: this.limitReached
      }
    };
  }

  get representedUris(): readonly string[] {
    return [...new Set(
      [...this.functions.values()].map(record => record.item.uri.toString())
        .concat([...this.types.values()].map(record => record.node.uri))
    )];
  }

  get rootPosition(): vscode.Position {
    return this.rootItem.selectionRange.start;
  }

  get rootLabel(): string {
    return this.rootItem.name;
  }

  async expandFunction(nodeId: string, direction: 'incoming' | 'outgoing'): Promise<void> {
    await this.expandFunctionInternal(nodeId, direction, true);
  }

  async expandType(nodeId: string, loadMore: boolean): Promise<void> {
    await this.expandTypeInternal(nodeId, loadMore, true);
  }

  async toggleSource(nodeId: string): Promise<void> {
    const record = this.functions.get(nodeId);
    if (record === undefined) {
      return;
    }

    if (record.node.source !== undefined) {
      record.node = withoutSource(record.node);
      this.expandedSources.delete(nodeId);
      this.touch();
      return;
    }

    const source = await this.buildFunctionSource(record);
    record.node = { ...record.node, source };
    this.expandedSources.add(nodeId);
    this.touch();
  }

  setIncludeDependencies(value: boolean): void {
    if (this.includeDependencies === value) {
      return;
    }
    this.includeDependencies = value;
    for (const [id, record] of this.functions) {
      if (record.node.external && record.node.incoming === 'unavailable') {
        record.node = { ...record.node, incoming: 'idle' };
      }
      if (record.node.external && record.node.outgoing === 'unavailable') {
        record.node = { ...record.node, outgoing: 'idle' };
      }
      this.functions.set(id, record);
    }
    this.touch();
  }

  sourceLocation(nodeId: string): SourceLocation | undefined {
    const functionRecord = this.functions.get(nodeId);
    if (functionRecord !== undefined) {
      return {
        uri: functionRecord.item.uri,
        range: functionRecord.item.selectionRange
      };
    }
    const typeRecord = this.types.get(nodeId);
    if (typeRecord !== undefined) {
      return {
        uri: vscode.Uri.parse(typeRecord.node.uri),
        range: new vscode.Range(
          typeRecord.node.selectionRange.start.line,
          typeRecord.node.selectionRange.start.character,
          typeRecord.node.selectionRange.end.line,
          typeRecord.node.selectionRange.end.character
        )
      };
    }
    return undefined;
  }

  async sourcePosition(nodeId: string, sourceOffset: number): Promise<SourcePosition | undefined> {
    const record = this.functions.get(nodeId);
    if (record === undefined || record.node.source === undefined) {
      return undefined;
    }
    const document = await vscode.workspace.openTextDocument(record.item.uri);
    const startOffset = document.offsetAt(record.item.range.start);
    const endOffset = document.offsetAt(record.item.range.end);
    const boundedOffset = Math.max(0, Math.min(Math.trunc(sourceOffset), endOffset - startOffset));
    return {
      uri: record.item.uri,
      position: document.positionAt(startOffset + boundedOffset)
    };
  }

  async replayInto(target: GraphSession): Promise<void> {
    for (const action of this.replayActions) {
      if (action.kind === 'function' && target.functions.has(action.nodeId)) {
        await target.expandFunctionInternal(action.nodeId, action.direction, true);
      } else if (action.kind === 'type' && target.types.has(action.nodeId)) {
        await target.expandTypeInternal(action.nodeId, action.loadMore, true);
      }
    }
    for (const nodeId of this.expandedSources) {
      if (target.functions.has(nodeId)) {
        await target.toggleSource(nodeId);
      }
    }
    target.touch();
  }

  private get nodeCount(): number {
    return this.functions.size + this.types.size;
  }

  private async expandFunctionInternal(
    nodeId: string,
    direction: 'incoming' | 'outgoing',
    recordReplay: boolean
  ): Promise<void> {
    const record = this.functions.get(nodeId);
    if (record === undefined) {
      return;
    }
    if (record.node.external && !this.includeDependencies) {
      record.node = { ...record.node, [direction]: 'unavailable' };
      this.touch();
      return;
    }

    if (recordReplay) {
      const alreadyRecorded = this.replayActions.some(action =>
        action.kind === 'function' && action.nodeId === nodeId && action.direction === direction
      );
      if (!alreadyRecorded) {
        this.replayActions.push({ kind: 'function', nodeId, direction });
      }
    }
    record.node = { ...record.node, [direction]: 'loading' };
    this.touch();

    const relations = direction === 'incoming'
      ? await this.queryIncoming(record.item)
      : await this.queryOutgoing(record.item);
    let cursor = 0;
    while (cursor < relations.length) {
      const relation = relations[cursor];
      if (relation === undefined) {
        break;
      }
      const admitted = await this.addRelation(relation);
      if (!admitted && this.limitReached) {
        break;
      }
      cursor += 1;
    }

    const hasMore = cursor < relations.length;
    record.node = {
      ...record.node,
      [direction]: hasMore ? 'truncated' : 'complete',
      [direction === 'incoming' ? 'hasMoreIncoming' : 'hasMoreOutgoing']: hasMore
    };
    if (record.node.source !== undefined) {
      record.node = { ...record.node, source: await this.buildFunctionSource(record) };
    }
    this.touch();
  }

  private async expandTypeInternal(nodeId: string, loadMore: boolean, recordReplay: boolean): Promise<void> {
    const record = this.types.get(nodeId);
    if (record === undefined) {
      return;
    }
    if (recordReplay) {
      this.replayActions.push({ kind: 'type', nodeId, loadMore });
    }
    if (!loadMore) {
      record.cursor = 0;
    }

    let admittedNodes = 0;
    while (record.cursor < record.definition.methods.length) {
      const method = record.definition.methods[record.cursor];
      record.cursor += 1;
      if (method === undefined) {
        continue;
      }
      const items = await this.language.prepareCallHierarchy(
        record.document.uri,
        record.document.positionAt(method.nameStart)
      );
      const item = items.find(candidate => candidate.name === method.name) ?? items[0];
      if (item === undefined) {
        continue;
      }
      const before = this.nodeCount;
      const functionNode = await this.addFunction(item);
      if (functionNode === undefined) {
        break;
      }
      this.addMembershipEdge(nodeId, functionNode);
      admittedNodes += Math.max(0, this.nodeCount - before);
      if (admittedNodes >= this.configuration.expansionBatchSize) {
        break;
      }
    }

    const hasMore = record.cursor < record.definition.methods.length;
    record.node = { ...record.node, expanded: true, hasMoreMethods: hasMore };
    this.touch();
  }

  private async queryIncoming(item: vscode.CallHierarchyItem): Promise<readonly PendingRelation[]> {
    const calls = await this.language.incomingCalls(item);
    const relations: PendingRelation[] = [];
    for (const call of calls) {
      if (call.fromRanges.length === 0) {
        relations.push({ kind: 'call', sourceItem: call.from, targetItem: item });
      } else {
        for (const range of call.fromRanges) {
          relations.push({ kind: 'call', sourceItem: call.from, targetItem: item, sourceRange: range });
        }
      }
    }
    return relations;
  }

  private async queryOutgoing(item: vscode.CallHierarchyItem): Promise<readonly PendingRelation[]> {
    const calls = await this.language.outgoingCalls(item);
    const relations: PendingRelation[] = [];
    const callRanges: vscode.Range[] = [];
    for (const call of calls) {
      if (call.fromRanges.length === 0) {
        relations.push({ kind: 'call', sourceItem: item, targetItem: call.to });
      } else {
        for (const range of call.fromRanges) {
          callRanges.push(range);
          relations.push({ kind: 'call', sourceItem: item, targetItem: call.to, sourceRange: range });
        }
      }
    }
    relations.push(...await this.queryFunctionReferences(item, callRanges));
    return relations;
  }

  private async queryFunctionReferences(
    item: vscode.CallHierarchyItem,
    callRanges: readonly vscode.Range[]
  ): Promise<readonly PendingRelation[]> {
    const document = await vscode.workspace.openTextDocument(item.uri);
    const semanticRanges = await this.language.semanticFunctionRanges(item.uri, item.range);
    const candidates = semanticRanges.filter(range => {
      if (rangesOverlap(range, item.selectionRange)) {
        return false;
      }
      if (callRanges.some(callRange => rangesOverlap(range, callRange))) {
        return false;
      }
      const tokenEnd = document.offsetAt(range.end);
      return !/^\s*\(/.test(document.getText().slice(tokenEnd, tokenEnd + 16));
    }).slice(0, 80);

    const relations: PendingRelation[] = [];
    for (let start = 0; start < candidates.length; start += 8) {
      const batch = candidates.slice(start, start + 8);
      const resolved = await Promise.all(batch.map(async range => {
        const definitions = await this.language.definitions(item.uri, range.start);
        for (const definition of definitions) {
          const targets = await this.language.prepareCallHierarchy(definition.uri, definition.range.start);
          const target = targets[0];
          if (target !== undefined) {
            return { kind: 'reference' as const, sourceItem: item, targetItem: target, sourceRange: range };
          }
        }
        return undefined;
      }));
      for (const relation of resolved) {
        if (relation !== undefined) {
          relations.push(relation);
        }
      }
    }
    return deduplicateRelations(relations);
  }

  private async addRelation(relation: PendingRelation): Promise<boolean> {
    const sourceId = await this.addFunction(relation.sourceItem);
    const targetId = await this.addFunction(relation.targetItem);
    if (sourceId === undefined || targetId === undefined) {
      return false;
    }

    const rangeKey = relation.sourceRange === undefined ? 'unknown' : stableRangeKey(relation.sourceRange);
    const id = `edge:${relation.kind}:${sourceId}>${targetId}@${rangeKey}`;
    if (!this.edges.has(id)) {
      const edge: GraphEdgeDto = {
        id,
        source: sourceId,
        target: targetId,
        kind: relation.kind,
        ...(relation.sourceRange === undefined ? {} : { sourceRange: toRangeDto(relation.sourceRange) })
      };
      this.edges.set(id, edge);
    }
    return true;
  }

  private async addFunction(item: vscode.CallHierarchyItem): Promise<string | undefined> {
    const id = functionId(item);
    if (this.functions.has(id)) {
      return id;
    }
    if (!this.canAddNode()) {
      return undefined;
    }

    const external = isExternalUri(item.uri);
    const node: FunctionNodeDto = {
      kind: 'function',
      id,
      label: item.name,
      detail: item.detail ?? '',
      symbolKind: item.kind,
      uri: item.uri.toString(),
      range: toRangeDto(item.range),
      selectionRange: toRangeDto(item.selectionRange),
      external,
      sourceAvailable: item.uri.scheme === 'file' || item.uri.scheme === 'vscode-remote',
      incoming: external && !this.includeDependencies ? 'unavailable' : 'idle',
      outgoing: external && !this.includeDependencies ? 'unavailable' : 'idle',
      hasMoreIncoming: false,
      hasMoreOutgoing: false
    };
    const record: FunctionRecord = { node, item };
    this.functions.set(id, record);

    if (!external || this.includeDependencies) {
      const owner = await this.findOwnerType(item);
      if (owner !== undefined) {
        const typeId = await this.addType(owner.catalog, owner.definition);
        if (typeId !== undefined) {
          record.node = { ...record.node, ownerTypeId: typeId };
          this.addMembershipEdge(typeId, id);
        }
      }
    }
    return id;
  }

  private async addType(catalog: StructureCatalog, definition: RustTypeDefinition): Promise<string | undefined> {
    const id = typeId(catalog.document.uri, definition);
    if (this.types.has(id)) {
      return id;
    }
    if (!this.canAddNode()) {
      return undefined;
    }
    const range = new vscode.Range(
      catalog.document.positionAt(definition.start),
      catalog.document.positionAt(definition.end)
    );
    const selectionRange = new vscode.Range(
      catalog.document.positionAt(definition.nameStart),
      catalog.document.positionAt(definition.nameEnd)
    );
    const node: TypeNodeDto = {
      kind: 'type',
      id,
      typeKind: definition.kind,
      label: definition.name,
      detail: `${definition.kind} · ${definition.methods.length} associated ${definition.methods.length === 1 ? 'function' : 'functions'}`,
      uri: catalog.document.uri.toString(),
      range: toRangeDto(range),
      selectionRange: toRangeDto(selectionRange),
      variants: definition.variants,
      methodCount: definition.methods.length,
      expanded: false,
      hasMoreMethods: definition.methods.length > 0
    };
    this.types.set(id, { node, definition, document: catalog.document, cursor: 0 });
    return id;
  }

  private addMembershipEdge(typeNodeId: string, functionNodeId: string): void {
    const id = `edge:membership:${typeNodeId}>${functionNodeId}`;
    if (!this.edges.has(id)) {
      this.edges.set(id, {
        id,
        source: typeNodeId,
        target: functionNodeId,
        kind: 'membership',
        label: 'associated function'
      });
    }
  }

  private async findOwnerType(item: vscode.CallHierarchyItem): Promise<{
    readonly catalog: StructureCatalog;
    readonly definition: RustTypeDefinition;
  } | undefined> {
    const catalog = await this.structureCatalog(item.uri);
    const methodOffset = catalog.document.offsetAt(item.selectionRange.start);
    const definition = catalog.definitions.find(candidate => candidate.methods.some(method =>
      method.name === item.name && Math.abs(method.nameStart - methodOffset) <= 2
    ));
    return definition === undefined ? undefined : { catalog, definition };
  }

  private structureCatalog(uri: vscode.Uri): Promise<StructureCatalog> {
    const key = uri.toString();
    let catalog = this.structureCatalogs.get(key);
    if (catalog === undefined) {
      catalog = Promise.resolve(vscode.workspace.openTextDocument(uri)).then(document => ({
        document,
        definitions: scanRustStructure(document.getText())
      }));
      this.structureCatalogs.set(key, catalog);
    }
    return catalog;
  }

  private async buildFunctionSource(record: FunctionRecord): Promise<FunctionSourceDto> {
    const document = await vscode.workspace.openTextDocument(record.item.uri);
    const sourceText = document.getText(record.item.range);
    const relationships: SourceRelationshipDto[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source !== record.node.id || edge.kind === 'membership' || edge.sourceRange === undefined) {
        continue;
      }
      const range = new vscode.Range(
        edge.sourceRange.start.line,
        edge.sourceRange.start.character,
        edge.sourceRange.end.line,
        edge.sourceRange.end.character
      );
      const offsets = relativeOffsets(document, record.item.range, range);
      const target = this.functions.get(edge.target)?.node ?? this.types.get(edge.target)?.node;
      if (offsets === undefined || target === undefined) {
        continue;
      }
      const relationshipRange = sourceRelationshipNameRange(
        sourceText,
        offsets.startOffset,
        offsets.endOffset,
        target.label
      );
      relationships.push({
        id: `source:${edge.id}`,
        edgeId: edge.id,
        kind: edge.kind,
        startOffset: relationshipRange.startOffset,
        endOffset: relationshipRange.endOffset,
        targetNodeId: edge.target,
        label: target.label
      });
    }
    relationships.sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
    const semanticTokens: SourceSemanticTokenDto[] = [];
    for (const token of await this.language.semanticTokens(record.item.uri, record.item.range)) {
      const offsets = relativeOffsets(document, record.item.range, token.range);
      if (offsets === undefined || offsets.endOffset <= offsets.startOffset) {
        continue;
      }
      semanticTokens.push({
        startOffset: offsets.startOffset,
        endOffset: offsets.endOffset,
        tokenType: token.tokenType,
        modifiers: token.modifiers
      });
    }
    semanticTokens.sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
    return {
      text: sourceText,
      startLine: record.item.range.start.line,
      startCharacter: record.item.range.start.character,
      relationships,
      semanticTokens
    };
  }

  private canAddNode(): boolean {
    if (this.nodeCount < this.configuration.maxNodes) {
      return true;
    }
    this.limitReached = true;
    return false;
  }

  private touch(): void {
    this.revision += 1;
  }
}

function functionId(item: vscode.CallHierarchyItem): string {
  return `fn:${item.uri.toString()}@${item.selectionRange.start.line}:${item.selectionRange.start.character}`;
}

function typeId(uri: vscode.Uri, definition: RustTypeDefinition): string {
  return `type:${uri.toString()}@${definition.nameStart}`;
}

function isExternalUri(uri: vscode.Uri): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (folders === undefined || folders.length === 0) {
    return false;
  }
  return vscode.workspace.getWorkspaceFolder(uri) === undefined;
}

function withoutSource(node: FunctionNodeDto): FunctionNodeDto {
  const {
    source: _source,
    ...rest
  } = node;
  return rest;
}

function deduplicateRelations(relations: readonly PendingRelation[]): readonly PendingRelation[] {
  const seen = new Set<string>();
  return relations.filter(relation => {
    const range = relation.sourceRange === undefined ? 'unknown' : stableRangeKey(relation.sourceRange);
    const key = `${functionId(relation.sourceItem)}>${functionId(relation.targetItem)}@${range}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
