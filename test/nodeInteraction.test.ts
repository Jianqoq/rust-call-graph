import { describe, expect, it } from 'vitest';
import { NODE_DRAG_HANDLE, NODE_INTERACTION } from '../src/webview/nodeInteraction.js';

describe('graph node interaction', () => {
  it('limits canvas dragging to the node header', () => {
    expect(NODE_DRAG_HANDLE).toBe('.node-header');
    expect(NODE_INTERACTION).toMatchObject({
      draggable: true,
      selectable: true,
      focusable: true,
      dragHandle: '.node-header'
    });
  });
});
