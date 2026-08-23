import {
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps
} from '@xyflow/react';
import type { FanOutBundle } from './edgeBundling.js';

export interface BundledEdgeData extends Record<string, unknown> {
  readonly bundle?: FanOutBundle;
}

export type BundledFlowEdge = Edge<BundledEdgeData, 'bundled'>;

export function BundledEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  interactionWidth,
  data
}: EdgeProps<BundledFlowEdge>) {
  const bundle = data?.bundle;
  if (bundle === undefined) {
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 5
    });
    return (
      <BaseEdge
        path={path}
        style={style}
        {...(markerEnd === undefined ? {} : { markerEnd })}
        {...(interactionWidth === undefined ? {} : { interactionWidth })}
      />
    );
  }

  const branchPath = `M${bundle.laneX} ${targetY}H${targetX}`;
  const trunkPath = [
    `M${sourceX} ${sourceY}H${bundle.laneX}`,
    `M${bundle.laneX} ${bundle.trunkMinY}V${bundle.trunkMaxY}`
  ].join('');

  return (
    <>
      {bundle.drawTrunk && (
        <path
          className="react-flow__edge-path edge-bundle-trunk"
          d={trunkPath}
          style={style}
          fill="none"
          aria-hidden="true"
        />
      )}
      <BaseEdge
        path={branchPath}
        style={style}
        {...(markerEnd === undefined ? {} : { markerEnd })}
        {...(interactionWidth === undefined ? {} : { interactionWidth })}
      />
    </>
  );
}
