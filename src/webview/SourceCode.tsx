import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  definitionModifierHint,
  isDefinitionModifierClick,
  type DefinitionClickModifier
} from '../shared/definitionNavigation.js';
import type {
  FunctionSourceDto,
  SourceRelationshipDto,
  SourceSemanticTokenDto
} from '../shared/protocol.js';
import type { NodeActions, SourceHoverData } from './graphTypes.js';
import { SourceHoverCard, type SourceHoverAnchor } from './SourceHoverCard.js';
import { coveringSemanticToken, withRustSyntaxFallbacks } from './rustSyntaxFallback.js';
import { semanticTokenClassName, isDefinitionNavigableToken, showsGotoDefinitionUnderline } from './sourceHighlight.js';

interface SourceCodeProps {
  readonly nodeId: string;
  readonly source: FunctionSourceDto;
  readonly sourceHover?: SourceHoverData;
  readonly definitionClickModifier?: DefinitionClickModifier;
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

export function SourceCode({
  nodeId,
  source,
  sourceHover,
  definitionClickModifier = 'ctrlCmd',
  actions
}: SourceCodeProps) {
  const hoverRequestTimer = useRef<number | undefined>(undefined);
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  const [hoverAnchor, setHoverAnchor] = useState<SourceHoverAnchor>();
  const modifierHeld = useDefinitionModifier(definitionClickModifier);
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

  const openDefinition = useCallback((sourceOffset: number) => {
    dismissLanguageHover();
    actions.openDefinition(nodeId, sourceOffset);
  }, [actions, dismissLanguageHover, nodeId]);

  useEffect(() => cancelHoverTimers, [cancelHoverTimers]);

  return (
    <div
      className="source-shell nodrag nowheel"
      aria-label={`Source for function, starting at line ${source.startLine + 1}`}
      onScroll={() => {
        dismissLanguageHover();
      }}
      onKeyDownCapture={event => {
        if (event.key === 'Escape') {
          dismissLanguageHover();
        }
      }}
    >
      <pre className={`source-code${modifierHeld ? ' is-definition-modifier' : ''}`}>
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
                const relationship = segment.relationship;
                const canOpenDefinition = relationship !== undefined
                  || (segment.semanticToken !== undefined && isDefinitionNavigableToken(segment.semanticToken.tokenType));
                const showDefinitionCue = showsGotoDefinitionUnderline(
                  segment.semanticToken?.tokenType,
                  segment.text,
                  relationship !== undefined
                );
                const token = relationship === undefined
                  ? <Fragment key={index}>{content}</Fragment>
                  : (
                  <RelationshipToken
                    key={`${relationship.id}:${index}`}
                    nodeId={nodeId}
                    relationship={relationship}
                    actions={actions}
                    {...(segment.semanticToken === undefined
                      ? {}
                      : { tokenClassName: semanticTokenClassName(segment.semanticToken) })}
                    {...(hoverDescriptionId === undefined ? {} : { describedBy: hoverDescriptionId })}
                    definitionClickModifier={definitionClickModifier}
                    onOpenDefinition={() => openDefinition(relationship.startOffset)}
                  >
                    {content}
                  </RelationshipToken>
                  );
                if (segment.semanticToken === undefined && segment.relationship === undefined) {
                  return token;
                }
                return (
                  <span
                    className={`source-hover-anchor${active ? ' is-language-hovered' : ''}${showDefinitionCue ? ' is-definition-target' : ''}`}
                    key={`hover:${segment.startOffset}:${index}`}
                    onMouseEnter={event => beginLanguageHover(segment.startOffset, event.currentTarget)}
                    onMouseLeave={scheduleLanguageHoverClose}
                    onFocus={event => beginLanguageHover(segment.startOffset, event.currentTarget)}
                    onBlur={scheduleLanguageHoverClose}
                    onClick={event => {
                      if (!canOpenDefinition || !isDefinitionModifierClick(event, definitionClickModifier)) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      openDefinition(segment.startOffset);
                    }}
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

function useDefinitionModifier(modifier: DefinitionClickModifier): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const sync = (event: { readonly altKey: boolean; readonly ctrlKey: boolean; readonly metaKey: boolean }): void => {
      setHeld(isDefinitionModifierClick(event, modifier));
    };
    const reset = (): void => setHeld(false);
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('mousemove', sync);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('mousemove', sync);
      window.removeEventListener('blur', reset);
    };
  }, [modifier]);

  return held;
}

function RelationshipToken({
  nodeId,
  relationship,
  children,
  actions,
  describedBy,
  tokenClassName,
  definitionClickModifier,
  onOpenDefinition
}: {
  readonly nodeId: string;
  readonly relationship: SourceRelationshipDto;
  readonly children: ReactNode;
  readonly actions: NodeActions;
  readonly describedBy?: string;
  readonly tokenClassName?: string;
  readonly definitionClickModifier: DefinitionClickModifier;
  readonly onOpenDefinition: () => void;
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
      className={`source-relationship source-relationship-${relationship.kind} nodrag${tokenClassName === undefined ? '' : ` ${tokenClassName}`}`}
      title={`${relationship.kind === 'call' ? 'Calls' : 'References'} ${relationship.label}. ${definitionModifierHint(definitionClickModifier, navigator.platform)}. Double-click to focus target.`}
      aria-label={`${relationship.kind === 'call' ? 'Call' : 'Function reference'} to ${relationship.label}. Press Enter to focus; Space to pin relationship.`}
      aria-describedby={describedBy}
      onMouseEnter={() => actions.hoverRelationship(graphRelationship)}
      onMouseLeave={() => actions.hoverRelationship(undefined)}
      onClick={event => {
        event.stopPropagation();
        if (isDefinitionModifierClick(event, definitionClickModifier)) {
          event.preventDefault();
          onOpenDefinition();
          return;
        }
        actions.pinRelationship(graphRelationship);
      }}
      onDoubleClick={event => {
        event.stopPropagation();
        if (isDefinitionModifierClick(event, definitionClickModifier)) {
          return;
        }
        actions.followRelationship(nodeId, relationship.targetNodeId);
      }}
      onKeyDown={onKeyDown}
    >
      {children}
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
      const semanticToken = coveringSemanticToken(semanticTokens, segmentStart, segmentEnd);
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
