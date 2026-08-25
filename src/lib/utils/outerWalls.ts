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
const PROBE_DISTANCE = 12;

/** Fractions along the wall to probe; the ends are skipped so junctions don't decide the vote. */
const SAMPLE_TS = [0.15, 0.3, 0.5, 0.7, 0.85];

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

/**
 * Ids of the walls that form the building envelope.
 *
 * Falls back to every wall when the plan has no enclosed rooms — with nothing
 * marked as inside there is no exposure to measure, and treating an unclosed
 * sketch as "no exterior at all" would silently drop the whole layout.
 */
export function detectOuterWalls(walls: Wall[]): Set<string> {
  const all = new Set(walls.map(w => w.id));
  if (walls.length < 3) return all;

  const polygons = detectRooms(walls)
    .map(room => getRoomPolygon(room, walls))
    .filter(poly => poly.length >= 3);
  if (polygons.length === 0) return all;

  const outer = new Set<string>();

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    // Perpendicular to the chord. Curved walls are probed along their chord
    // because detectRooms traces chords too — matching it keeps the two in step.
    const nx = -dy / len;
    const ny = dx / len;

    let leftInside = 0;
    let rightInside = 0;
    for (const t of SAMPLE_TS) {
      const cx = wall.start.x + dx * t;
      const cy = wall.start.y + dy * t;
      if (pointInAnyPolygon({ x: cx + nx * PROBE_DISTANCE, y: cy + ny * PROBE_DISTANCE }, polygons)) leftInside++;
      if (pointInAnyPolygon({ x: cx - nx * PROBE_DISTANCE, y: cy - ny * PROBE_DISTANCE }, polygons)) rightInside++;
    }

    const half = SAMPLE_TS.length / 2;
    const leftEnclosed = leftInside >= half;
    const rightEnclosed = rightInside >= half;
    // Exactly one side enclosed: the wall separates inside from outside.
    // Both sides enclosed is a partition; neither is a stray wall standing
    // off the building, and seeding a storey with those would just be litter.
    if (leftEnclosed !== rightEnclosed) outer.add(wall.id);
  }

  // A plan whose walls all read as partitions has no usable envelope — fall
  // back rather than hand back an empty footprint.
  return outer.size > 0 ? outer : all;
}

/** The envelope walls themselves, in the order they appear on the floor. */
export function getOuterWalls(walls: Wall[]): Wall[] {
  const outer = detectOuterWalls(walls);
  return walls.filter(w => outer.has(w.id));
}
