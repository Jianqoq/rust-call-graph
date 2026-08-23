import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type {
  FunctionSourceDto,
  SourceRelationshipDto,
  SourceSemanticTokenDto
} from '../shared/protocol.js';
import type { NodeActions, SourceHoverData } from './graphTypes.js';
import { SourceHoverCard, type SourceHoverAnchor } from './SourceHoverCard.js';
import { withRustSyntaxFallbacks } from './rustSyntaxFallback.js';

interface SourceCodeProps {
  readonly nodeId: string;
  readonly source: FunctionSourceDto;
  readonly sourceHover?: SourceHoverData;
  readonly actions: NodeActions;
}

interface SourceSegment {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly relationship?: SourceRelationshipDto;
  readonly semanticToken?: SourceSemanticTokenDto;
}

interface SourceLine {
  readonly number: number;
  readonly segments: readonly SourceSegment[];
}

export function clampedSourceHandleRightInset(
  defaultInset: number,
  handleCenterX: number,
  sourceViewportRight: number,
  renderedScale: number
): number {
  if (renderedScale <= 0) {
    return defaultInset;
  }
  const overflow = handleCenterX - sourceViewportRight;
  return overflow <= 0 ? defaultInset : defaultInset + overflow / renderedScale;
}

export function SourceCode({ nodeId, source, sourceHover, actions }: SourceCodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const updateFrame = useRef<number | undefined>(undefined);
  const sourceShell = useRef<HTMLDivElement>(null);
  const hoverRequestTimer = useRef<number | undefined>(undefined);
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  const [hoverAnchor, setHoverAnchor] = useState<SourceHoverAnchor>();
  const lines = buildSourceLines(source);

  const cancelHoverTimers = useCallback(() => {
    if (hoverRequestTimer.current !== undefined) {
      window.clearTimeout(hoverRequestTimer.current);
      hoverRequestTimer.current = undefined;
    }
    if (hoverCloseTimer.current !== undefined) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    }
  }, []);

  const dismissLanguageHover = useCallback(() => {
    cancelHoverTimers();
    setHoverAnchor(undefined);
    actions.clearSourceHover();
  }, [actions, cancelHoverTimers]);

  const scheduleLanguageHoverClose = useCallback(() => {
    if (hoverRequestTimer.current !== undefined) {
      window.clearTimeout(hoverRequestTimer.current);
      hoverRequestTimer.current = undefined;
    }
    if (hoverCloseTimer.current !== undefined) {
      window.clearTimeout(hoverCloseTimer.current);
    }
    hoverCloseTimer.current = window.setTimeout(() => {
      hoverCloseTimer.current = undefined;
      setHoverAnchor(undefined);
      actions.clearSourceHover();
    }, 140);
  }, [actions]);

  const keepLanguageHoverOpen = useCallback(() => {
    if (hoverCloseTimer.current !== undefined) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    }
  }, []);

  const beginLanguageHover = useCallback((sourceOffset: number, element: HTMLElement) => {
    cancelHoverTimers();
    const rect = element.getBoundingClientRect();
    const estimatedCardWidth = 430;
    const estimatedCardHeight = 230;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - estimatedCardWidth - 8));
    const below = rect.bottom + 8;
    const top = below + estimatedCardHeight <= window.innerHeight
      ? below
      : Math.max(8, rect.top - estimatedCardHeight - 8);
    setHoverAnchor({ sourceOffset, left, top });
    hoverRequestTimer.current = window.setTimeout(() => {
      hoverRequestTimer.current = undefined;
      actions.requestSourceHover(nodeId, sourceOffset);
    }, 320);
  }, [actions, cancelHoverTimers, nodeId]);

  const refreshHandles = useCallback(() => {
    if (updateFrame.current !== undefined) {
      window.cancelAnimationFrame(updateFrame.current);
    }
    updateFrame.current = window.requestAnimationFrame(() => {
      updateFrame.current = undefined;
      if (sourceShell.current !== null) {
        clampRelationshipHandles(sourceShell.current);
      }
      updateNodeInternals(nodeId);
    });
  }, [nodeId, updateNodeInternals]);

  useEffect(() => {
    refreshHandles();
    return () => {
      if (updateFrame.current !== undefined) {
        window.cancelAnimationFrame(updateFrame.current);
      }
      cancelHoverTimers();
    };
  }, [cancelHoverTimers, refreshHandles, source]);

  useEffect(() => {
    if (sourceShell.current === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(refreshHandles);
    observer.observe(sourceShell.current);
    const code = sourceShell.current.querySelector('.source-code');
    if (code !== null) {
      observer.observe(code);
    }
    return () => observer.disconnect();
  }, [refreshHandles]);

  return (
    <div
      ref={sourceShell}
      className="source-shell nodrag nowheel"
      aria-label={`Source for function, starting at line ${source.startLine + 1}`}
      onScroll={() => {
        refreshHandles();
        dismissLanguageHover();
      }}
      onKeyDownCapture={event => {
        if (event.key === 'Escape') {
          dismissLanguageHover();
        }
      }}
    >
      <div className="source-legend" aria-hidden="true">
        <span><i className="legend-call" /> call</span>
        <span><i className="legend-reference" /> reference</span>
        <span className="source-hint">Double-click to follow</span>
      </div>
      <pre className="source-code">
        {lines.map(line => (
          <span className="source-line" key={line.number}>
            <span className="source-line-number" aria-hidden="true">{line.number}</span>
            <span className="source-line-content">
              {line.segments.map((segment, index) => {
                const content = segment.semanticToken === undefined
                  ? segment.text
                  : (
                    <span className={semanticTokenClassName(segment.semanticToken)}>
                      {segment.text}
                    </span>
                  );
                const active = hoverAnchor?.sourceOffset === segment.startOffset;
                const hoverDescriptionId = active
                  && sourceHover?.sourceOffset === segment.startOffset
                  && sourceHover.blocks.length > 0
                  ? 'source-language-hover'
                  : undefined;
                const token = segment.relationship === undefined
                  ? <Fragment key={index}>{content}</Fragment>
                  : (
                  <RelationshipToken
                    key={`${segment.relationship.id}:${index}`}
                    nodeId={nodeId}
                    relationship={segment.relationship}
                    actions={actions}
                    {...(hoverDescriptionId === undefined ? {} : { describedBy: hoverDescriptionId })}
                  >
                    {content}
                  </RelationshipToken>
                  );
                if (segment.semanticToken === undefined && segment.relationship === undefined) {
                  return token;
                }
                return (
                  <span
                    className={`source-hover-anchor${active ? ' is-language-hovered' : ''}`}
                    key={`hover:${segment.startOffset}:${index}`}
                    onMouseEnter={event => beginLanguageHover(segment.startOffset, event.currentTarget)}
                    onMouseLeave={scheduleLanguageHoverClose}
                    onFocus={event => beginLanguageHover(segment.startOffset, event.currentTarget)}
                    onBlur={scheduleLanguageHoverClose}
                  >
                    {token}
                  </span>
                );
              })}
            </span>
          </span>
        ))}
      </pre>
      {hoverAnchor !== undefined
        && sourceHover?.sourceOffset === hoverAnchor.sourceOffset
        && sourceHover.blocks.length > 0
        && (
          <SourceHoverCard
            anchor={hoverAnchor}
            blocks={sourceHover.blocks}
            onMouseEnter={keepLanguageHoverOpen}
            onMouseLeave={scheduleLanguageHoverClose}
          />
        )}
    </div>
  );
}

function clampRelationshipHandles(sourceShell: HTMLDivElement): void {
  const handles = [...sourceShell.querySelectorAll<HTMLElement>('.source-edge-handle')];
  for (const handle of handles) {
    handle.style.removeProperty('--source-edge-handle-right');
  }

  const shellRect = sourceShell.getBoundingClientRect();
  const renderedScale = sourceShell.offsetWidth === 0 ? 1 : shellRect.width / sourceShell.offsetWidth;
  const viewportRight = shellRect.left + sourceShell.clientWidth * renderedScale;
  for (const handle of handles) {
    const handleRect = handle.getBoundingClientRect();
    const rightInset = clampedSourceHandleRightInset(
      -5,
      handleRect.left + handleRect.width / 2,
      viewportRight,
      renderedScale
    );
    if (rightInset !== -5) {
      handle.style.setProperty('--source-edge-handle-right', `${rightInset}px`);
    }
  }
}

function RelationshipToken({
  nodeId,
  relationship,
  children,
  actions,
  describedBy
}: {
  readonly nodeId: string;
  readonly relationship: SourceRelationshipDto;
  readonly children: ReactNode;
  readonly actions: NodeActions;
  readonly describedBy?: string;
}) {
  const graphRelationship = {
    edgeId: relationship.edgeId,
    originNodeId: nodeId,
    targetNodeId: relationship.targetNodeId
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      actions.followRelationship(nodeId, relationship.targetNodeId);
    } else if (event.key === ' ') {
      event.preventDefault();
      actions.pinRelationship(graphRelationship);
    }
  };

  return (
    <button
      type="button"
      className={`source-relationship source-relationship-${relationship.kind} nodrag`}
      title={`${relationship.kind === 'call' ? 'Calls' : 'References'} ${relationship.label}. Double-click to focus target.`}
      aria-label={`${relationship.kind === 'call' ? 'Call' : 'Function reference'} to ${relationship.label}. Press Enter to focus; Space to pin relationship.`}
      aria-describedby={describedBy}
      onMouseEnter={() => actions.hoverRelationship(graphRelationship)}
      onMouseLeave={() => actions.hoverRelationship(undefined)}
      onClick={event => {
        event.stopPropagation();
        actions.pinRelationship(graphRelationship);
      }}
      onDoubleClick={event => {
        event.stopPropagation();
        actions.followRelationship(nodeId, relationship.targetNodeId);
      }}
      onKeyDown={onKeyDown}
    >
      {children}
      <Handle
        type="source"
        id={`source-${relationship.edgeId}`}
        position={Position.Right}
        isConnectable={false}
        className="source-edge-handle"
      />
    </button>
  );
}

export function buildSourceLines(source: FunctionSourceDto): readonly SourceLine[] {
  const relationships = [...source.relationships]
    .filter(item => item.endOffset > item.startOffset)
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  const semanticTokens = [...withRustSyntaxFallbacks(source.text, source.semanticTokens)]
    .filter(item => item.endOffset > item.startOffset)
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  const lines: SourceLine[] = [];
  const lineStarts = [0];
  for (let index = 0; index < source.text.length; index += 1) {
    if (source.text[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }

  for (let lineIndex = 0; lineIndex < lineStarts.length; lineIndex += 1) {
    const start = lineStarts[lineIndex] ?? 0;
    const next = lineStarts[lineIndex + 1] ?? source.text.length;
    const end = next > start && source.text[next - 1] === '\n' ? next - 1 : next;
    const boundaries = new Set<number>([start, end]);
    for (const range of [...relationships, ...semanticTokens]) {
      if (range.endOffset <= start || range.startOffset >= end) {
        continue;
      }
      boundaries.add(Math.max(start, range.startOffset));
      boundaries.add(Math.min(end, range.endOffset));
    }
    const offsets = [...boundaries].sort((left, right) => left - right);
    const segments: SourceSegment[] = [];
    for (let index = 0; index + 1 < offsets.length; index += 1) {
      const segmentStart = offsets[index] ?? start;
      const segmentEnd = offsets[index + 1] ?? end;
      if (segmentEnd <= segmentStart) {
        continue;
      }
      const relationship = relationships.find(item =>
        item.startOffset <= segmentStart && item.endOffset >= segmentEnd
      );
      const semanticToken = semanticTokens.find(item =>
        item.startOffset <= segmentStart && item.endOffset >= segmentEnd
      );
      segments.push({
        text: source.text.slice(segmentStart, segmentEnd),
        startOffset: segmentStart,
        endOffset: segmentEnd,
        ...(relationship === undefined ? {} : { relationship }),
        ...(semanticToken === undefined ? {} : { semanticToken })
      });
    }
    if (segments.length === 0) {
      segments.push({ text: '', startOffset: start, endOffset: end });
    }
    lines.push({ number: source.startLine + lineIndex + 1, segments });
  }
  return lines;
}

function semanticTokenClassName(token: SourceSemanticTokenDto): string {
  const tokenType = token.tokenType.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const modifiers = token.modifiers.map(modifier =>
    `source-semantic-${modifier.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
  );
  return ['source-semantic', `source-semantic-${tokenType}`, ...modifiers].join(' ');
}
