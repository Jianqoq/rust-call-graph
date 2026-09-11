import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { viewportCullFields } from '../src/webview/nodeGeometry.js';

describe('viewportCullFields', () => {
  it('places source and target handles on the panel endpoints', () => {
    expect(viewportCullFields({ width: 338, height: 120 })).toEqual({
      width: 338,
      height: 120,
      handles: [
        { id: 'target', type: 'target', position: Position.Left, x: 0, y: 60 },
        { id: 'source', type: 'source', position: Position.Right, x: 338, y: 60 }
      ],
      style: { width: 338, height: 120 }
    });
  });
});
