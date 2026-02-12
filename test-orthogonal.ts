/**
 * Test script: import roomplan JSON with orthogonal=true, verify all walls are axis-aligned.
 * Run with: npx tsx test-orthogonal.ts
 */
import { importRoomPlan, ORTHO_VERSION } from './src/lib/utils/roomplanImport.js';
import { readFileSync } from 'fs';

const files = [
  'static/test-roomplan.json',
  'static/test-roomplan-multiroom.json',
];

console.log(`Orthogonal version: ${ORTHO_VERSION}\n`);

let allPassed = true;

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const floor = importRoomPlan(data, { orthogonal: true, mergeDistance: 15 });

  console.log(`=== ${file} (${floor.walls.length} walls) ===`);

  let fail = 0;
  for (const wall of floor.walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const angle = Math.atan2(dy, dx);
    const angleDeg = (angle * 180) / Math.PI;
    // Should be 0, 90, 180, -90 (±0.1°)
    const nearest90 = Math.round(angleDeg / 90) * 90;
    const off = Math.abs(angleDeg - nearest90);

    const ok = off < 0.5;
    if (!ok) {
      console.log(`  ❌ Wall ${wall.id}: angle=${angleDeg.toFixed(2)}° (off by ${off.toFixed(2)}° from ${nearest90}°) len=${len.toFixed(1)}`);
      fail++;
    }
  }

  if (fail === 0) {
    console.log(`  ✅ All ${floor.walls.length} walls are orthogonal`);
  } else {
    console.log(`  ❌ ${fail}/${floor.walls.length} walls NOT orthogonal`);
    allPassed = false;
  }

  // Check corner connectivity: find endpoints within 2px that should be identical
  const eps: { x: number; y: number; wallId: string; which: string }[] = [];
  for (const w of floor.walls) {
    eps.push({ x: w.start.x, y: w.start.y, wallId: w.id, which: 'start' });
    eps.push({ x: w.end.x, y: w.end.y, wallId: w.id, which: 'end' });
  }
  let gapCount = 0;
  for (let i = 0; i < eps.length; i++) {
    for (let j = i + 1; j < eps.length; j++) {
      const d = Math.hypot(eps[i].x - eps[j].x, eps[i].y - eps[j].y);
      if (d > 0.5 && d < 15) {
        console.log(`    gap: ${eps[i].wallId}.${eps[i].which} ↔ ${eps[j].wallId}.${eps[j].which} = ${d.toFixed(1)}cm (${eps[i].x},${eps[i].y}) vs (${eps[j].x},${eps[j].y})`);
        gapCount++;
      }
    }
  }
  if (gapCount > 0) {
    console.log(`  ⚠️  ${gapCount} near-miss corner pairs (0.5-15cm gap)`);
  } else {
    console.log(`  ✅ No corner gaps detected`);
  }
  console.log();
}

process.exit(allPassed ? 0 : 1);
