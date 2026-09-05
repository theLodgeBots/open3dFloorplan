import { describe, expect, it } from 'vitest';
import { findDoorAt, findWindowAt } from '$lib/utils/hitTesting';
import { wallPointAt, wallTangentAt } from '$lib/utils/canvasRenderer';
import type { Wall, Door, Window as Win } from '$lib/models/types';

const wall = { id: 'wall', start: { x: 0, y: 0 }, end: { x: 600, y: 0 }, thickness: 20, height: 250 } as Wall;
const door = { id: 'door', wallId: 'wall', position: 0.5, width: 300, type: 'opening' } as Door;
const window = { ...door, id: 'window', type: 'standard', sillHeight: 90 } as Win;

describe.each([0.25, 0.5, 1, 2, 4])('opening picking at zoom %s', zoom => {
  it('does not capture empty space far from a wide opening (#18)', () => {
    expect(findDoorAt({ x: 300, y: 140 }, [door], [wall], zoom)).toBeNull();
    expect(findWindowAt({ x: 300, y: 140 }, [window], [wall], zoom)).toBeNull();
  });
  it('keeps the full physical width selectable and uses a screen-space edge tolerance', () => {
    expect(findDoorAt({ x: 440, y: 0 }, [door], [wall], zoom)).toBe(door);
    expect(findWindowAt({ x: 450 + 4 / zoom, y: 10 + 4 / zoom }, [window], [wall], zoom)).toBe(window);
    expect(findDoorAt({ x: 450 + 6 / zoom, y: 0 }, [door], [wall], zoom)).toBeNull();
    expect(findDoorAt({ x: 300, y: 10 + 6 / zoom }, [door], [wall], zoom)).toBeNull();
  });
});

it.each([
  { ...wall, end: { x: 0, y: 600 } },
  { ...wall, end: { x: 400, y: 400 } },
  { ...wall, curvePoint: { x: 100, y: 250 } },
])('uses the rendered tangent for rotated and curved walls', w => {
  const center = wallPointAt(w, 0.5), t = wallTangentAt(w, 0.5);
  expect(findDoorAt({ x: center.x + t.x * 140, y: center.y + t.y * 140 }, [door], [w], 2)).toBe(door);
  expect(findDoorAt({ x: center.x - t.y * 50, y: center.y + t.x * 50 }, [door], [w], 2)).toBeNull();
});

it('selects the last drawn opening and ignores missing or degenerate walls', () => {
  const top = { ...door, id: 'top' };
  expect(findDoorAt({ x: 300, y: 0 }, [door, top], [wall], 1)).toBe(top);
  expect(findDoorAt({ x: 300, y: 0 }, [door], [], 1)).toBeNull();
  expect(findDoorAt({ x: 0, y: 0 }, [door], [{ ...wall, end: wall.start }], 1)).toBeNull();
  expect(findDoorAt({ x: 300, y: 0 }, [door], [wall], 0)).toBeNull();
});
