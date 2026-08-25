/**
 * Test script: exercise detectOuterWalls() on hand-built layouts — a plain
 * rectangle, a rectangle split by a partition, an L-shaped footprint, and the
 * degenerate cases (no walls, an unclosed sketch) — plus the RoomPlan fixtures
 * the other tests use.
 * Run with: npx tsx test-outer-walls.ts
 */
import { detectOuterWalls } from './src/lib/utils/outerWalls.js';
import { createProjectFromRoomPlan, DEFAULT_ROOMPLAN_OPTIONS } from './src/lib/utils/roomplanImport.js';
import type { Wall, Point } from './src/lib/models/types.js';
import { readFileSync, existsSync } from 'fs';

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = '') {
  checks++;
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

let wallSeq = 0;
function wall(name: string, start: Point, end: Point): Wall {
  wallSeq++;
  return { id: name, start, end, thickness: 20, height: 280, color: '#ffffff' };
}

/** Walls of a closed rectangle, ids prefixed so tests can name them. */
function rect(prefix: string, x: number, y: number, w: number, h: number): Wall[] {
  return [
    wall(`${prefix}-top`, { x, y }, { x: x + w, y }),
    wall(`${prefix}-right`, { x: x + w, y }, { x: x + w, y: y + h }),
    wall(`${prefix}-bottom`, { x: x + w, y: y + h }, { x, y: y + h }),
    wall(`${prefix}-left`, { x, y: y + h }, { x, y }),
  ];
}

function sorted(ids: Iterable<string>): string[] {
  return [...ids].sort();
}

// ── 1. A plain rectangle: every wall is on the envelope ──────────────
{
  console.log('\nSingle rectangle (600×500):');
  const walls = rect('r', 0, 0, 600, 500);
  const outer = detectOuterWalls(walls);
  check('all four walls are outer', outer.size === 4, `got ${outer.size}: ${sorted(outer)}`);
}

// ── 2. Rectangle split by an interior partition ──────────────────────
{
  console.log('\nRectangle with a central partition:');
  const walls = [
    ...rect('r', 0, 0, 600, 500),
    // Vertical partition splitting the box into two rooms
    wall('partition', { x: 300, y: 0 }, { x: 300, y: 500 }),
  ];
  const outer = detectOuterWalls(walls);
  check('partition is not outer', !outer.has('partition'));
  check('the four perimeter walls are outer', outer.size === 4, `got ${sorted(outer)}`);
}

// ── 3. Two partitions, three rooms ───────────────────────────────────
{
  console.log('\nRectangle with two partitions (3 rooms):');
  const walls = [
    ...rect('r', 0, 0, 900, 500),
    wall('p1', { x: 300, y: 0 }, { x: 300, y: 500 }),
    wall('p2', { x: 600, y: 0 }, { x: 600, y: 500 }),
  ];
  const outer = detectOuterWalls(walls);
  check('neither partition is outer', !outer.has('p1') && !outer.has('p2'));
  check('exactly four outer walls', outer.size === 4, `got ${sorted(outer)}`);
}

// ── 4. T-junction: a partition meeting a perimeter wall mid-span ─────
{
  console.log('\nT-junction partition (stops halfway):');
  const walls = [
    ...rect('r', 0, 0, 600, 500),
    // Runs from the top wall down to the middle, then across to the right wall
    wall('stem', { x: 300, y: 0 }, { x: 300, y: 250 }),
    wall('arm', { x: 300, y: 250 }, { x: 600, y: 250 }),
  ];
  const outer = detectOuterWalls(walls);
  check('stem is not outer', !outer.has('stem'));
  check('arm is not outer', !outer.has('arm'));
  check('perimeter walls are all outer', ['r-top', 'r-right', 'r-bottom', 'r-left'].every(id => outer.has(id)),
    `got ${sorted(outer)}`);
}

// ── 5. L-shaped footprint ────────────────────────────────────────────
{
  console.log('\nL-shaped footprint:');
  //  (0,0) ────────── (600,0)
  //    │                 │
  //    │            (600,300)
  //    │                 │
  //    │        (300,300)─┘
  //    │            │
  //  (0,600)──(300,600)
  const pts: Point[] = [
    { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 },
    { x: 300, y: 300 }, { x: 300, y: 600 }, { x: 0, y: 600 },
  ];
  const walls = pts.map((p, i) => wall(`l${i}`, p, pts[(i + 1) % pts.length]));
  const outer = detectOuterWalls(walls);
  check('all six walls are outer', outer.size === 6, `got ${outer.size}: ${sorted(outer)}`);
}

// ── 6. L-shape with an interior partition ────────────────────────────
{
  console.log('\nL-shape with an interior partition:');
  const pts: Point[] = [
    { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 },
    { x: 300, y: 300 }, { x: 300, y: 600 }, { x: 0, y: 600 },
  ];
  const walls = [
    ...pts.map((p, i) => wall(`l${i}`, p, pts[(i + 1) % pts.length])),
    // Splits the upper arm off from the rest
    wall('partition', { x: 300, y: 0 }, { x: 300, y: 300 }),
  ];
  const outer = detectOuterWalls(walls);
  check('partition is not outer', !outer.has('partition'));
  check('six outer walls remain', outer.size === 6, `got ${sorted(outer)}`);
}

// ── 7. Degenerate inputs fall back to "everything" ───────────────────
{
  console.log('\nDegenerate inputs:');
  check('no walls → empty set', detectOuterWalls([]).size === 0);

  const two = [wall('a', { x: 0, y: 0 }, { x: 100, y: 0 }), wall('b', { x: 100, y: 0 }, { x: 100, y: 100 })];
  check('fewer than 3 walls → all returned', detectOuterWalls(two).size === 2);

  // An unclosed sketch: nothing encloses, so nothing can be judged exposed.
  const open = [
    wall('o1', { x: 0, y: 0 }, { x: 600, y: 0 }),
    wall('o2', { x: 600, y: 0 }, { x: 600, y: 500 }),
    wall('o3', { x: 600, y: 500 }, { x: 100, y: 500 }),
  ];
  const openOuter = detectOuterWalls(open);
  check('unclosed sketch → all walls returned (no silent drop)', openOuter.size === 3,
    `got ${sorted(openOuter)}`);
}

// ── 8. Stray wall standing off the building is excluded ──────────────
{
  console.log('\nStray wall outside the footprint:');
  const walls = [
    ...rect('r', 0, 0, 600, 500),
    wall('stray', { x: 900, y: 100 }, { x: 900, y: 400 }),
  ];
  const outer = detectOuterWalls(walls);
  check('stray wall is not part of the envelope', !outer.has('stray'), `got ${sorted(outer)}`);
  check('the rectangle is still the envelope', outer.size === 4, `got ${sorted(outer)}`);
}

// ── 9. Real RoomPlan captures ────────────────────────────────────────
{
  const files = ['test-roomplan.json', 'static/test-roomplan-multiroom.json'].filter(f => existsSync(f));
  for (const file of files) {
    console.log(`\n${file}:`);
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    const project = createProjectFromRoomPlan(json, DEFAULT_ROOMPLAN_OPTIONS);
    for (const floor of project.floors) {
      if (floor.walls.length === 0) continue;
      const outer = detectOuterWalls(floor.walls);
      console.log(`  ${floor.name}: ${outer.size}/${floor.walls.length} walls on the envelope`);
      check(`${floor.name}: envelope is non-empty`, outer.size > 0);
      check(`${floor.name}: envelope is a subset of the floor`, outer.size <= floor.walls.length);
      check(
        `${floor.name}: envelope ids all resolve`,
        [...outer].every(id => floor.walls.some(w => w.id === id)),
      );
    }
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
