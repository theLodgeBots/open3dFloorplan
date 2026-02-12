/**
 * RoomPlan JSON Importer
 * Converts Apple RoomPlan JSON exports into our Floor data model.
 *
 * RoomPlan coordinate system: Y-up, meters, column-major 4×4 transforms
 * Our coordinate system: 2D XY in centimeters (roomplan X→our X, roomplan Z→our Y)
 */

import type { Floor, Wall, Door, Window, FurnitureItem, Room, Point } from '$lib/models/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface RPTransform extends Array<number> { length: 16; }

function getPosition(t: number[]): { x: number; y: number; z: number } {
  return { x: t[12], y: t[13], z: t[14] };
}

function getYRotation(t: number[]): number {
  return Math.atan2(t[8], t[0]);
}

/** Convert RoomPlan meters (XZ ground plane) to our cm (XY) */
function toOurPoint(rpX: number, rpZ: number): Point {
  return { x: rpX * 100, y: rpZ * 100 };
}

interface RPWall {
  identifier: string;
  dimensions: number[];
  transform: number[];
  category: any;
  parentIdentifier?: string | null;
}

interface RPDoorWindow {
  identifier: string;
  dimensions: number[];
  transform: number[];
  category: any;
  parentIdentifier: string | null;
}

interface RPObject {
  identifier: string;
  dimensions: number[];
  transform: number[];
  category: any;
  attributes?: any;
}

interface RPSection {
  center: number[];
  label: string;
  story: number;
}

function getCategoryKey(cat: any): string {
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object' && cat !== null) return Object.keys(cat)[0] || '';
  return '';
}

function mapDoorType(cat: any): Door['type'] {
  const key = getCategoryKey(cat);
  if (key === 'door') {
    const inner = cat[key];
    if (inner?.isOpen) return 'single';
    return 'single';
  }
  if (key === 'doubleDoor' || key === 'french') return 'double';
  if (key === 'slidingDoor') return 'sliding';
  if (key === 'foldingDoor') return 'bifold';
  return 'single';
}

function mapWindowType(cat: any): Window['type'] {
  const key = getCategoryKey(cat);
  if (key === 'slidingWindow') return 'sliding';
  if (key === 'bayWindow') return 'bay';
  return 'standard';
}

function mapFurnitureCatalogId(cat: any, dims: number[]): string {
  const key = getCategoryKey(cat);
  const widthM = dims[0];
  const heightM = dims[1];

  const mapping: Record<string, () => string> = {
    sofa: () => widthM > 1.5 ? 'sofa' : 'loveseat',
    table: () => heightM > 0.6 ? 'dining_table' : 'coffee_table',
    chair: () => 'chair',
    bed: () => widthM > 1.4 ? 'bed_queen' : 'bed_twin',
    storage: () => 'storage',
    toilet: () => 'toilet',
    bathtub: () => 'bathtub',
    sink: () => 'sink_b',
    refrigerator: () => 'fridge',
    stove: () => 'stove',
    oven: () => 'oven',
    dishwasher: () => 'dishwasher',
    television: () => 'television',
    washerDryer: () => 'washer_dryer',
    fireplace: () => 'fireplace',
    stairs: () => 'storage',
  };

  return mapping[key]?.() ?? 'chair';
}

function mapSectionLabel(label: string): string {
  const map: Record<string, string> = {
    livingRoom: 'Living Room',
    bedroom: 'Bedroom',
    kitchen: 'Kitchen',
    bathroom: 'Bathroom',
    diningRoom: 'Dining Room',
    laundryRoom: 'Laundry',
    office: 'Office',
    hallway: 'Hallway',
    garage: 'Garage',
    closet: 'Closet',
    pantry: 'Pantry',
    entryway: 'Entryway',
  };
  return map[label] ?? label;
}

/**
 * Find the closest point on a wall segment to a given point, return parameter t (0-1)
 */
function projectOntoWall(wall: Wall, pt: Point): number {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0.5;
  const t = ((pt.x - wall.start.x) * dx + (pt.y - wall.start.y) * dy) / lenSq;
  return Math.max(0.01, Math.min(0.99, t));
}

/**
 * Straighten walls: snap near-horizontal/vertical walls to axis-aligned,
 * then merge nearby endpoints so corners meet cleanly.
 */
function straightenWalls(walls: Wall[], angleTolerance = 5, mergeDistance = 15): void {
  const tolRad = (angleTolerance * Math.PI) / 180;

  // Pass 1: Snap walls that are nearly axis-aligned
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const angle = Math.atan2(dy, dx);
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    // Check if near 0°, 90°, 180°, 270°
    const snappedAngle = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI].find(
      a => angleDiff(angle, a) < tolRad
    );

    if (snappedAngle !== undefined) {
      // Recalculate endpoints from midpoint + snapped angle
      const mx = (wall.start.x + wall.end.x) / 2;
      const my = (wall.start.y + wall.end.y) / 2;
      const halfLen = len / 2;
      const cdx = Math.cos(snappedAngle) * halfLen;
      const cdy = Math.sin(snappedAngle) * halfLen;
      wall.start.x = Math.round(mx - cdx);
      wall.start.y = Math.round(my - cdy);
      wall.end.x = Math.round(mx + cdx);
      wall.end.y = Math.round(my + cdy);
    }
  }

  // Pass 2: Merge nearby endpoints
  mergeEndpoints(walls, mergeDistance);
}

/** Normalize angle to [-π, π) */
function normalizeAngle(a: number): number {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Smallest absolute angular difference */
function angleDiff(a: number, b: number): number {
  return Math.abs(normalizeAngle(a - b));
}

/**
 * Enforce orthogonal: snap every wall to the nearest axis direction
 * (0°, 90°, 180°, 270°) so all walls are perfectly horizontal or vertical.
 */
function enforceOrthogonal(walls: Wall[], mergeDistance = 15): void {
  if (walls.length === 0) return;

  const AXES = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // right, down, left, up

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const currentAngle = Math.atan2(dy, dx);

    // Find nearest axis angle
    let bestAngle = 0;
    let bestDiff = Infinity;
    for (const a of AXES) {
      const diff = angleDiff(currentAngle, a);
      if (diff < bestDiff) { bestDiff = diff; bestAngle = a; }
    }

    // Recalculate endpoints from midpoint + snapped angle
    const mx = (wall.start.x + wall.end.x) / 2;
    const my = (wall.start.y + wall.end.y) / 2;
    const halfLen = len / 2;
    wall.start.x = Math.round(mx - Math.cos(bestAngle) * halfLen);
    wall.start.y = Math.round(my - Math.sin(bestAngle) * halfLen);
    wall.end.x = Math.round(mx + Math.cos(bestAngle) * halfLen);
    wall.end.y = Math.round(my + Math.sin(bestAngle) * halfLen);
  }

  // Re-merge endpoints after snapping
  mergeEndpoints(walls, mergeDistance);
}

/** Merge nearby wall endpoints to cluster average */
function mergeEndpoints(walls: Wall[], mergeDistance: number): void {
  const endpoints: { wall: Wall; which: 'start' | 'end' }[] = [];
  for (const wall of walls) {
    endpoints.push({ wall, which: 'start' });
    endpoints.push({ wall, which: 'end' });
  }

  const merged = new Set<number>();
  for (let i = 0; i < endpoints.length; i++) {
    if (merged.has(i)) continue;
    const pi = endpoints[i].which === 'start' ? endpoints[i].wall.start : endpoints[i].wall.end;
    const cluster = [i];

    for (let j = i + 1; j < endpoints.length; j++) {
      if (merged.has(j)) continue;
      const pj = endpoints[j].which === 'start' ? endpoints[j].wall.start : endpoints[j].wall.end;
      if (Math.hypot(pi.x - pj.x, pi.y - pj.y) < mergeDistance) {
        cluster.push(j);
      }
    }

    if (cluster.length > 1) {
      let ax = 0, ay = 0;
      for (const idx of cluster) {
        const p = endpoints[idx].which === 'start' ? endpoints[idx].wall.start : endpoints[idx].wall.end;
        ax += p.x; ay += p.y;
      }
      ax = Math.round(ax / cluster.length);
      ay = Math.round(ay / cluster.length);

      for (const idx of cluster) {
        const ep = endpoints[idx];
        if (ep.which === 'start') { ep.wall.start.x = ax; ep.wall.start.y = ay; }
        else { ep.wall.end.x = ax; ep.wall.end.y = ay; }
        merged.add(idx);
      }
    }
  }
}

export interface RoomPlanImportOptions {
  straighten?: boolean;
  orthogonal?: boolean;
  angleTolerance?: number;   // degrees, default 5
  mergeDistance?: number;     // cm, default 15
}

export function importRoomPlan(jsonData: any, options: RoomPlanImportOptions = {}): Floor {
  const rpWalls: RPWall[] = jsonData.walls ?? [];
  const rpDoors: RPDoorWindow[] = jsonData.doors ?? [];
  const rpWindows: RPDoorWindow[] = jsonData.windows ?? [];
  const rpObjects: RPObject[] = jsonData.objects ?? [];
  const rpSections: RPSection[] = jsonData.sections ?? [];

  const floorId = uid();
  const walls: Wall[] = [];
  const doors: Door[] = [];
  const windows: Window[] = [];
  const furniture: FurnitureItem[] = [];
  const rooms: Room[] = [];

  // Map RoomPlan wall identifier → our wall id
  const wallIdMap = new Map<string, string>();

  // Process walls
  for (const rw of rpWalls) {
    const pos = getPosition(rw.transform);
    const angle = getYRotation(rw.transform);
    const halfWidth = (rw.dimensions[0] / 2) * 100; // cm
    const height = rw.dimensions[1] * 100; // cm

    const center = toOurPoint(pos.x, pos.z);
    // Wall direction from rotation (in XZ plane)
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle); // sin maps to our Y (roomplan Z direction component)

    // Actually: rotation is around Y axis. cos(angle) affects X, sin(angle) affects Z.
    // transform[0]=cos, transform[8]=sin for column-major Y rotation
    // So wall extends along direction (cos(angle), sin(angle)) in roomplan XZ
    // In our coords: dirX = cos(angle), dirY = sin(angle) [since rpZ → ourY... wait]
    // rpX→ourX, rpZ→ourY. The rotation angle from atan2(t[8],t[0]) gives rotation in XZ plane.
    // Wall local X-axis direction in world: (t[0], t[8]) = (cos(a), sin(a)) in XZ
    // So in our 2D: direction = (t[0], t[8]) which is (cos(a), sin(a))
    const wallDirX = rw.transform[0]; // col0[0]: local X axis in world X
    const wallDirZ = rw.transform[2]; // col0[2]: local X axis in world Z

    const start: Point = {
      x: center.x - wallDirX * halfWidth,
      y: center.y - wallDirZ * halfWidth,
    };
    const end: Point = {
      x: center.x + wallDirX * halfWidth,
      y: center.y + wallDirZ * halfWidth,
    };

    const wallId = uid();
    wallIdMap.set(rw.identifier, wallId);

    walls.push({
      id: wallId,
      start,
      end,
      thickness: 15,
      height: Math.round(height),
      color: '#444444',
    });
  }

  // Post-process walls
  const md = options.mergeDistance ?? 15;
  if (options.orthogonal) {
    enforceOrthogonal(walls, md);
  } else if (options.straighten !== false) {
    straightenWalls(walls, options.angleTolerance ?? 5, md);
  }

  // Process doors
  for (const rd of rpDoors) {
    const parentWallId = rd.parentIdentifier ? wallIdMap.get(rd.parentIdentifier) : undefined;
    if (!parentWallId) continue;

    const wall = walls.find(w => w.id === parentWallId);
    if (!wall) continue;

    const pos = getPosition(rd.transform);
    const doorPoint = toOurPoint(pos.x, pos.z);
    const position = projectOntoWall(wall, doorPoint);

    doors.push({
      id: uid(),
      wallId: parentWallId,
      position,
      width: Math.round(rd.dimensions[0] * 100),
      height: Math.round(rd.dimensions[1] * 100),
      type: mapDoorType(rd.category),
      swingDirection: 'left',
      flipSide: false,
    });
  }

  // Process windows
  for (const rw of rpWindows) {
    const parentWallId = rw.parentIdentifier ? wallIdMap.get(rw.parentIdentifier) : undefined;
    if (!parentWallId) continue;

    const wall = walls.find(w => w.id === parentWallId);
    if (!wall) continue;

    const pos = getPosition(rw.transform);
    const winPoint = toOurPoint(pos.x, pos.z);
    const position = projectOntoWall(wall, winPoint);

    windows.push({
      id: uid(),
      wallId: parentWallId,
      position,
      width: Math.round(rw.dimensions[0] * 100),
      height: Math.round(rw.dimensions[1] * 100),
      sillHeight: 90,
      type: mapWindowType(rw.category),
    });
  }

  // Process objects (furniture)
  for (const ro of rpObjects) {
    const pos = getPosition(ro.transform);
    const angle = getYRotation(ro.transform);
    const catalogId = mapFurnitureCatalogId(ro.category, ro.dimensions);

    furniture.push({
      id: uid(),
      catalogId,
      position: toOurPoint(pos.x, pos.z),
      rotation: (angle * 180) / Math.PI,
      scale: { x: 1, y: 1, z: 1 },
      width: Math.round(ro.dimensions[0] * 100),
      depth: Math.round(ro.dimensions[2] * 100),
      height: Math.round(ro.dimensions[1] * 100),
    });
  }

  // Process sections (rooms)
  for (const rs of rpSections) {
    rooms.push({
      id: uid(),
      name: mapSectionLabel(rs.label),
      walls: [], // wall association would need polygon analysis
      floorTexture: 'hardwood',
      area: 0,
    });
  }

  return {
    id: floorId,
    name: 'Ground Floor',
    level: 0,
    walls,
    rooms,
    doors,
    windows,
    furniture,
    stairs: [],
  };
}

/**
 * Extract room.json from a .zip file (iOS RoomPlan export format)
 */
export async function extractRoomJsonFromZip(zipFile: File): Promise<any> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(zipFile);

  // Find room.json in the zip
  let roomJsonFile: any = null;
  zip.forEach((relativePath, file) => {
    if (relativePath.endsWith('room.json') && !file.dir) {
      roomJsonFile = file;
    }
  });

  if (!roomJsonFile) {
    throw new Error('No room.json found in zip file');
  }

  const content = await roomJsonFile.async('string');
  return JSON.parse(content);
}
