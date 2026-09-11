import type { Point, Size } from './layout.js';

export interface CenteredViewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export function centeredNodeViewport(
  position: Point,
  size: Size,
  windowSize: Size,
  padding = 64,
  minZoom = 0.18,
  maxZoom = 1.35
): CenteredViewport {
  const availableWidth = Math.max(1, windowSize.width - padding * 2);
  const availableHeight = Math.max(1, windowSize.height - padding * 2);
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const zoom = clamp(
    Math.min(availableWidth / width, availableHeight / height),
    minZoom,
    maxZoom
  );
  const centerX = position.x + width / 2;
  const centerY = position.y + height / 2;
  return {
    x: windowSize.width / 2 - centerX * zoom,
    y: windowSize.height / 2 - centerY * zoom,
    zoom
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
