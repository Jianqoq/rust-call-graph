import { Position, type NodeHandle } from '@xyflow/react';
import type { Size } from './layout.js';

export interface ViewportCullFields {
  readonly width: number;
  readonly height: number;
  readonly handles: NodeHandle[];
  readonly style: { readonly width: number; readonly height: number };
}

/** Dimensions and handle anchors so off-screen nodes can be culled without mounting. */
export function viewportCullFields(size: Size): ViewportCullFields {
  return {
    width: size.width,
    height: size.height,
    handles: [
      { id: 'target', type: 'target', position: Position.Left, x: 0, y: size.height / 2 },
      { id: 'source', type: 'source', position: Position.Right, x: size.width, y: size.height / 2 }
    ],
    style: { width: size.width, height: size.height }
  };
}
