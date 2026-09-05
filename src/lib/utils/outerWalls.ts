/**
 * Detects a floor's outer walls — the building envelope.
 *
 * The wall graph alone can't tell an exterior wall from a partition: both are
 * just segments. What separates them is exposure. Room detection already gives
 * us the enclosed faces of the plan, so a wall is on the envelope when one of
 * its sides faces enclosed space and the other faces nothing at all.
 *
 * Used to seed a new storey with the footprint below it, and to tint the
 * floor-below ghost so the envelope reads apart from the partitions.
 */
import type { Wall, Point } from '$lib/models/types';
import { detectRooms, getRoomPolygon } from '$lib/utils/roomDetection';

/**
 * How far to each side of the centreline we probe, in cm.
 *
 * Room polygons run along wall centrelines, not wall faces, so this is
 * unrelated to wall thickness — it only has to clear the endpoint-snapping
 * epsilon while staying inside the narrowest room worth detecting.
 */
const PROBE_DISTANCE = 6;


/** Standard ray-casting point-in-polygon test. Points on the edge may go either way. */
function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInAnyPolygon(p: Point, polys: Point[][]): boolean {
  return polys.some(poly => pointInPolygon(p, poly));
}

type Range = [number, number];

/** Split at room junctions before classifying exposure; a single wall can have both uses. */
function exteriorRanges(walls: Wall[]): Map<Wall, Range[]> {
  const all = () => new Map(walls.map(wall => [wall, [[0, 1]] as Range[]]));
  const polygons = detectRooms(walls).map(room => getRoomPolygon(room, walls)).filter(poly => poly.length >= 3);
  if (!polygons.length) return all();
  const result = new Map<Wall, Range[]>();
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const cuts = [0, 1];
    for (const point of polygons.flat()) {
      const t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / (length * length);
      const distance = Math.abs((point.x - wall.start.x) * dy - (point.y - wall.start.y) * dx) / length;
      // Match room detection's endpoint snapping tolerance.
      if (t > 0 && t < 1 && distance < 5) cuts.push(t);
    }
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    const ranges: Range[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1], to = sorted[i];
      if ((to - from) * length < 1e-5) continue;
      const t = (from + to) / 2;
      const x = wall.start.x + dx * t, y = wall.start.y + dy * t;
      // Room detection traces chords, including for curved walls.
      const nx = -dy / length * PROBE_DISTANCE, ny = dx / length * PROBE_DISTANCE;
      const left = pointInAnyPolygon({ x: x + nx, y: y + ny }, polygons);
      const right = pointInAnyPolygon({ x: x - nx, y: y - ny }, polygons);
      if (left === right) continue;
      const previous = ranges.at(-1);
      if (previous && Math.abs(previous[1] - from) < 1e-8) previous[1] = to;
      else ranges.push([from, to]);
    }
    if (ranges.length) result.set(wall, ranges);
  }
  return result.size ? result : all();
}

/** IDs with at least one exposed segment; unclosed sketches retain every wall. */
export function detectOuterWalls(walls: Wall[]): Set<string> {
  return new Set([...exteriorRanges(walls).keys()].map(wall => wall.id));
}

function sliceWall(wall: Wall, from: number, to: number, index: number): Wall {
  if (from === 0 && to === 1) return wall;
  const pointAt = (t: number): Point => {
    const c = wall.curvePoint;
    if (!c) return { x: wall.start.x + (wall.end.x - wall.start.x) * t, y: wall.start.y + (wall.end.y - wall.start.y) * t };
    return { x: (1 - t) ** 2 * wall.start.x + 2 * (1 - t) * t * c.x + t * t * wall.end.x,
      y: (1 - t) ** 2 * wall.start.y + 2 * (1 - t) * t * c.y + t * t * wall.end.y };
  };
  const start = pointAt(from), end = pointAt(to);
  const segment = { ...wall, id: index ? `${wall.id}:outer:${index}` : wall.id, start, end };
  if (wall.curvePoint) {
    // Restricted quadratic Bezier: Q1 = Q0 + (to-from) * B'(from) / 2.
    const c = wall.curvePoint;
    segment.curvePoint = {
      x: start.x + (to - from) * ((1 - from) * (c.x - wall.start.x) + from * (wall.end.x - c.x)),
      y: start.y + (to - from) * ((1 - from) * (c.y - wall.start.y) + from * (wall.end.y - c.y)),
    };
  }
  return segment;
}

/** Copy only exposed wall sections; shared partitions must not open a gap in the new footprint. */
export function getOuterWalls(walls: Wall[]): Wall[] {
  return [...exteriorRanges(walls)].flatMap(([wall, ranges]) => ranges.map(([from, to], index) => sliceWall(wall, from, to, index)));
}
