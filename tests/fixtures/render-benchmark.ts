import type { Floor, Project } from '../../src/lib/models/types';

export const benchmarkSizes = {
  small: { side: 2, floors: 1 },
  medium: { side: 3, floors: 2 },
  large: { side: 4, floors: 3 },
} as const;
export type BenchmarkSize = keyof typeof benchmarkSizes;

/** Fixed IDs, dates and connected grid topology make runs and imports repeatable.
 * Six catalog objects per room share three bundled model files. No photo payloads. */
export function benchmarkProject(size: BenchmarkSize): Project {
  const spec = benchmarkSizes[size], roomSize = 450;
  const floors: Floor[] = [];
  for (let level = 0; level < spec.floors; level++) {
    const prefix = `bench-${size}-${level}`;
    const floor: Floor = { id: prefix, name: `Level ${level + 1}`, level, elevation: level * 300,
      walls: [], doors: [], windows: [], rooms: [], furniture: [], stairs: [], columns: [],
      guides: [], measurements: [], annotations: [], textAnnotations: [], groups: [] };
    const horizontal = (x: number, y: number) => `${prefix}-h-${x}-${y}`;
    const vertical = (x: number, y: number) => `${prefix}-v-${x}-${y}`;
    for (let edge = 0; edge <= spec.side; edge++) for (let cell = 0; cell < spec.side; cell++) {
      floor.walls.push({ id: horizontal(cell, edge), start: { x: cell * roomSize, y: edge * roomSize }, end: { x: (cell + 1) * roomSize, y: edge * roomSize }, thickness: 15, height: 280, color: '#dddddd' });
      floor.walls.push({ id: vertical(edge, cell), start: { x: edge * roomSize, y: cell * roomSize }, end: { x: edge * roomSize, y: (cell + 1) * roomSize }, thickness: 15, height: 280, color: '#dddddd' });
      floor.doors.push({ id: `${prefix}-door-${edge}-${cell}`, wallId: horizontal(cell, edge), position: 0.5, width: 90, height: 210, type: 'single', swingDirection: 'left', flipSide: false });
      if (edge === 0 || edge === spec.side) floor.windows.push({ id: `${prefix}-window-${edge}-${cell}`, wallId: vertical(edge, cell), position: 0.5, width: 120, height: 120, sillHeight: 90, type: 'standard' });
    }
    for (let y = 0; y < spec.side; y++) for (let x = 0; x < spec.side; x++) {
      const roomId = `${prefix}-room-${x}-${y}`;
      floor.rooms.push({ id: roomId, name: `Room ${x + 1},${y + 1}`, walls: [horizontal(x, y), vertical(x + 1, y), horizontal(x, y + 1), vertical(x, y)], area: roomSize * roomSize / 10000, floorTexture: (x + y) % 2 ? 'light-oak' : 'none', color: '#ddd8d0' });
      for (let item = 0; item < 6; item++) floor.furniture.push({ id: `${roomId}-item-${item}`, catalogId: ['chair', 'coffee_table', 'sofa'][item % 3], position: { x: x * roomSize + 100 + item % 3 * 110, y: y * roomSize + 120 + Math.floor(item / 3) * 190 }, rotation: item % 2 * 90, scale: { x: 1, y: 1, z: 1 } });
    }
    floors.push(floor);
  }
  return { id: `benchmark-${size}`, name: `Rendering benchmark — ${size}`, floors, activeFloorId: floors[0].id, createdAt: new Date('2026-09-07T00:00:00Z'), updatedAt: new Date('2026-09-07T00:00:00Z') };
}
