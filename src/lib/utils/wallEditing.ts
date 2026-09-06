import type { Point, Wall } from '$lib/models/types';

export type WallEndpoint = 'start' | 'end';
export const WALL_JOIN_TOLERANCE = 2; // cm; same joined-corner rule as pointer dragging
export const MIN_WALL_LENGTH = 1; // cm

export function wallLength(wall: Wall): number {
  if (!wall.curvePoint) return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  let length = 0, previous = wall.start;
  for (let i = 1; i <= 20; i++) {
    const t = i / 20, u = 1 - t;
    const point = { x: u * u * wall.start.x + 2 * u * t * wall.curvePoint.x + t * t * wall.end.x,
      y: u * u * wall.start.y + 2 * u * t * wall.curvePoint.y + t * t * wall.end.y };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

export function connectedWallEndpoints(walls: Wall[], point: Point, excludeWallId: string): { wallId: string; endpoint: WallEndpoint }[] {
  const results: { wallId: string; endpoint: WallEndpoint }[] = [];
  for (const wall of walls) {
    if (wall.id === excludeWallId) continue;
    for (const endpoint of ['start', 'end'] as const) {
      if (Math.hypot(wall[endpoint].x - point.x, wall[endpoint].y - point.y) < WALL_JOIN_TOLERANCE) {
        results.push({ wallId: wall.id, endpoint });
      }
    }
  }
  return results;
}

export function finitePoint(point: unknown): point is Point {
  return !!point && typeof point === 'object' && 'x' in point && 'y' in point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** Plan all corner updates first, so a rejected resize cannot partly modify the floor. */
export function planWallResize(walls: Wall[], id: string, length: number, fixed: WallEndpoint = 'start'): Map<string, Partial<Wall>> {
  if (!Number.isFinite(length) || length < MIN_WALL_LENGTH) throw new Error('Wall length must be at least 1 cm.');
  if (fixed !== 'start' && fixed !== 'end') throw new Error('Choose a fixed wall endpoint.');
  const wall = walls.find(w => w.id === id);
  if (!wall) throw new Error('Select a wall to resize.');
  const currentLength = wallLength(wall);
  if (!Number.isFinite(currentLength) || currentLength < MIN_WALL_LENGTH) throw new Error('This wall is too short to resize. Move its endpoint first.');
  const changes = new Map<string, Partial<Wall>>();
  if (Math.abs(length - currentLength) < 1e-6) return changes;
  const moving: WallEndpoint = fixed === 'start' ? 'end' : 'start';
  const origin = wall[fixed], scale = length / currentLength;
  const transform = (p: Point): Point => ({ x: origin.x + (p.x - origin.x) * scale, y: origin.y + (p.y - origin.y) * scale });
  const target = transform(wall[moving]);
  changes.set(id, { [moving]: target, ...(wall.curvePoint ? { curvePoint: transform(wall.curvePoint) } : {}) });
  for (const connection of connectedWallEndpoints(walls, wall[moving], id)) {
    changes.set(connection.wallId, { ...changes.get(connection.wallId), [connection.endpoint]: { ...target } });
  }
  for (const [wallId, updates] of changes) {
    const changed = { ...walls.find(w => w.id === wallId)!, ...updates };
    if (!finitePoint(changed.start) || !finitePoint(changed.end) || (changed.curvePoint && !finitePoint(changed.curvePoint)) || !Number.isFinite(wallLength(changed))) {
      throw new Error('This length would create invalid wall coordinates.');
    }
    if (Math.hypot(changed.end.x - changed.start.x, changed.end.y - changed.start.y) < MIN_WALL_LENGTH) {
      throw new Error('This length would collapse a joined wall. Choose another length or fixed endpoint.');
    }
  }
  return changes;
}

export function validPositiveDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export function validOpeningPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
