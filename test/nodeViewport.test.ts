import { describe, expect, it } from 'vitest';
import { centeredNodeViewport } from '../src/webview/nodeViewport.js';

describe('centeredNodeViewport', () => {
  it('centers a compact node and caps its zoom', () => {
    const viewport = centeredNodeViewport(
      { x: 710, y: 183 },
      { width: 338, height: 120 },
      { width: 1280, height: 720 }
    );

    expect(viewport.zoom).toBe(1.35);
    expect(710 * viewport.zoom + viewport.x + 338 * viewport.zoom / 2).toBeCloseTo(640);
    expect(183 * viewport.zoom + viewport.y + 120 * viewport.zoom / 2).toBeCloseTo(360);
  });

  it('fits resized Source content inside the current window before centering it', () => {
    const viewport = centeredNodeViewport(
      { x: 250, y: -100 },
      { width: 1400, height: 1000 },
      { width: 1100, height: 700 }
    );

    expect(viewport.zoom).toBeCloseTo(0.572);
    expect(250 * viewport.zoom + viewport.x).toBeCloseTo(149.6);
    expect((250 + 1400) * viewport.zoom + viewport.x).toBeCloseTo(950.4);
    expect(-100 * viewport.zoom + viewport.y).toBeCloseTo(64);
    expect((-100 + 1000) * viewport.zoom + viewport.y).toBeCloseTo(636);
  });
});
