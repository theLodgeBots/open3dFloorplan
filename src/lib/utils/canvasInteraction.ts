/**
 * Canvas interaction utilities: coordinate conversion, snap logic, and shared types.
 * Extracted from FloorPlanCanvas.svelte.
 */
import type { Point, Wall } from '$lib/models/types';

/** Shared canvas state passed to rendering / hit-test functions */
export interface CanvasState {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  zoom: number;
  camX: number;
  camY: number;
}

export const GRID = 20;
export const SNAP = 10;
export const MAGNETIC_SNAP = 15;
export const WALL_SNAP_DIST = 30;

export function screenToWorld(cs: CanvasState, sx: number, sy: number): Point {
  return { x: (sx - cs.width / 2) / cs.zoom + cs.camX, y: (sy - cs.height / 2) / cs.zoom + cs.camY };
}

export function worldToScreen(cs: CanvasState, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - cs.camX) * cs.zoom + cs.width / 2, y: (wy - cs.camY) * cs.zoom + cs.height / 2 };
}

export function snap(v: number, enabled: boolean, snapToGrid: boolean, gridSize: number): number {
  if (!enabled) return v;
  const step = snapToGrid ? gridSize : SNAP;
  return Math.round(v / step) * step;
}

export function magneticSnap(
  p: Point,
  walls: Wall[],
  snapFn: (v: number) => number,
  zoom: number,
  excludeWallIds?: Set<string>
): Point & { snappedToEndpoint?: boolean } {
  let best: Point & { snappedToEndpoint?: boolean } = { x: snapFn(p.x), y: snapFn(p.y) };
  let bestDist = MAGNETIC_SNAP / zoom;
  for (const w of walls) {
    if (excludeWallIds && excludeWallIds.has(w.id)) continue;
    for (const ep of [w.start, w.end]) {
      const d = Math.hypot(p.x - ep.x, p.y - ep.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: ep.x, y: ep.y, snappedToEndpoint: true };
      }
    }
  }
  return best;
}

export function angleSnap(start: Point, end: Point, enabled: boolean): Point {
  if (!enabled) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 5) return end;
  const angle = Math.atan2(dy, dx);
  const snapAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
  const ANGLE_THRESHOLD = Math.PI / 18;
  for (const sa of snapAngles) {
    if (Math.abs(angle - sa) < ANGLE_THRESHOLD) {
      return { x: start.x + len * Math.cos(sa), y: start.y + len * Math.sin(sa) };
    }
  }
  return end;
}

export function findConnectedEndpoints(pt: Point, excludeWallId: string, walls: Wall[]): { wallId: string; endpoint: 'start' | 'end' }[] {
  const tolerance = 2;
  const results: { wallId: string; endpoint: 'start' | 'end' }[] = [];
  for (const w of walls) {
    if (w.id === excludeWallId) continue;
    if (Math.hypot(w.start.x - pt.x, w.start.y - pt.y) < tolerance) {
      results.push({ wallId: w.id, endpoint: 'start' });
    }
    if (Math.hypot(w.end.x - pt.x, w.end.y - pt.y) < tolerance) {
      results.push({ wallId: w.id, endpoint: 'end' });
    }
  }
  return results;
}

/** Resize handle types for furniture */
export type HandleType = 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'rotate';
