/**
 * Focused geometry tests for furniture resize handles.
 * Run with: npx tsx test-furniture-resize.ts
 */
import assert from 'node:assert/strict';
import { resizeFurnitureFromHandle, WALL_SNAP_DIST } from './src/lib/utils/canvasInteraction.ts';

const close = (actual: number, expected: number, message: string) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
};

const resize = (handle: Parameters<typeof resizeFurnitureFromHandle>[0]['handle'], pointer: { x: number; y: number }, options: Partial<Parameters<typeof resizeFurnitureFromHandle>[0]> = {}) =>
  resizeFurnitureFromHandle({
    position: { x: 0, y: 0 },
    rotation: 0,
    width: 100,
    depth: 60,
    scale: { x: 1, y: 1 },
    handle,
    pointer,
    preserveAspectRatio: false,
    ...options,
  });

// The reduced attraction distance is intentionally much smaller than the old 30 cm.
assert.equal(WALL_SNAP_DIST, 12);

// Horizontal side handles keep the opposite vertical edge fixed.
{
  const right = resize('resize-r', { x: 150, y: 0 });
  close(right.position.x, 50, 'right resize center');
  close(right.scale.x, 2, 'right resize width scale');

  const left = resize('resize-l', { x: -150, y: 0 });
  close(left.position.x, -50, 'left resize center');
  close(left.scale.x, 2, 'left resize width scale');
}

// Vertical side handles resize only depth and keep the opposite horizontal edge fixed.
{
  const top = resize('resize-t', { x: 0, y: -70 });
  close(top.position.y, -20, 'top resize center');
  close(top.scale.y, 100 / 60, 'top resize depth scale');
  close(top.scale.x, 1, 'top resize leaves width unchanged');

  const bottom = resize('resize-b', { x: 0, y: 70 });
  close(bottom.position.y, 20, 'bottom resize center');
  close(bottom.scale.y, 100 / 60, 'bottom resize depth scale');
}

// The same opposite-edge rule is evaluated in local coordinates for rotated items.
{
  const rotated = resize('resize-r', { x: 0, y: 100 }, { rotation: 90 });
  close(rotated.position.x, 0, 'rotated resize center x');
  close(rotated.position.y, 25, 'rotated resize center y');
  close(rotated.scale.x, 1.5, 'rotated resize width scale');
}

// Corner resizing with Shift preserves aspect ratio while keeping the opposite corner fixed.
{
  const corner = resize('resize-br', { x: 80, y: 60 }, { preserveAspectRatio: true });
  close(corner.position.x, 25, 'corner resize center x');
  close(corner.position.y, 15, 'corner resize center y');
  close(corner.scale.x, 1.5, 'corner resize width scale');
  close(corner.scale.y, 1.5, 'corner resize depth scale');
}

console.log('Furniture resize geometry: PASS');
