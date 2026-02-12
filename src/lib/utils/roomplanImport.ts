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
 * Enforce orthogonal: find the dominant rotation of the whole layout,
 * then rotate ALL points by its inverse so walls become axis-aligned.
 * This preserves topology (connected corners stay connected).
 */
/** Orthogonal enforcement version (shown in import dialog) */
export const ORTHO_VERSION = 'v4';

function enforceOrthogonal(walls: Wall[], mergeDistance = 15, furniture?: FurnitureItem[]): void {
  if (walls.length === 0) return;

  // ── Step 1: Global rotation to remove dominant angle ──
  let sinSum = 0, cosSum = 0;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    // Multiply angle by 4 so 0°/90°/180°/270° all map to 0° in this space
    const angle = Math.atan2(dy, dx) * 4;
    sinSum += Math.sin(angle) * len;
    cosSum += Math.cos(angle) * len;
  }
  const dominantAngle = Math.atan2(sinSum, cosSum) / 4;

  const AXES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let bestAxis = 0;
  let bestDiff = Infinity;
  for (const a of AXES) {
    const diff = angleDiff(dominantAngle, a);
    if (diff < bestDiff) { bestDiff = diff; bestAxis = a; }
  }
  const rotationAngle = bestAxis - dominantAngle;

  // Centroid for rotation pivot
  let cx = 0, cy = 0, n = 0;
  for (const wall of walls) {
    cx += wall.start.x + wall.end.x;
    cy += wall.start.y + wall.end.y;
    n += 2;
  }
  cx /= n; cy /= n;

  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);
  function rotatePoint(p: { x: number; y: number }) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    p.x = cx + dx * cosR - dy * sinR;
    p.y = cy + dx * sinR + dy * cosR;
  }

  for (const wall of walls) {
    rotatePoint(wall.start);
    rotatePoint(wall.end);
  }
  if (furniture) {
    for (const f of furniture) {
      rotatePoint(f.position);
      f.rotation = (f.rotation ?? 0) + (rotationAngle * 180) / Math.PI;
    }
  }

  // ── Step 2: Build corner graph ──
  // Cluster endpoints that are within mergeDistance into "corner nodes"
  type Endpoint = { wall: Wall; which: 'start' | 'end' };
  const eps: Endpoint[] = [];
  for (const wall of walls) {
    eps.push({ wall, which: 'start' });
    eps.push({ wall, which: 'end' });
  }

  function getP(ep: Endpoint): Point {
    return ep.which === 'start' ? ep.wall.start : ep.wall.end;
  }

  // Union-Find to cluster nearby endpoints
  const parent: number[] = eps.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  for (let i = 0; i < eps.length; i++) {
    const pi = getP(eps[i]);
    for (let j = i + 1; j < eps.length; j++) {
      const pj = getP(eps[j]);
      if (Math.hypot(pi.x - pj.x, pi.y - pj.y) < mergeDistance) {
        union(i, j);
      }
    }
  }

  // Build corner clusters: cornerId → list of endpoint indices
  const corners = new Map<number, number[]>();
  for (let i = 0; i < eps.length; i++) {
    const root = find(i);
    if (!corners.has(root)) corners.set(root, []);
    corners.get(root)!.push(i);
  }

  // ── Step 3: Classify each wall as H or V ──
  const wallOrientation = new Map<Wall, 'H' | 'V'>();
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const angle = Math.atan2(dy, dx);
    const nearestAxis = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    wallOrientation.set(wall, Math.abs(Math.cos(nearestAxis)) > Math.abs(Math.sin(nearestAxis)) ? 'H' : 'V');
  }

  // ── Step 4: Solve corner positions using wall constraints ──
  // For each corner, collect constraints:
  //   - H walls constrain the corner's Y (wall midpoint Y)
  //   - V walls constrain the corner's X (wall midpoint X)
  // Then average the constraints for each axis, falling back to endpoint average.
  for (const [, members] of corners) {
    let xConstrained: number[] = [];
    let yConstrained: number[] = [];
    let allX: number[] = [];
    let allY: number[] = [];

    for (const idx of members) {
      const ep = eps[idx];
      const p = getP(ep);
      allX.push(p.x);
      allY.push(p.y);

      const orient = wallOrientation.get(ep.wall)!;
      if (orient === 'H') {
        // This wall is horizontal → both endpoints should share the same Y
        // Use the wall's midpoint Y as the constraint
        const midY = (ep.wall.start.y + ep.wall.end.y) / 2;
        yConstrained.push(midY);
      } else {
        // This wall is vertical → both endpoints should share the same X
        const midX = (ep.wall.start.x + ep.wall.end.x) / 2;
        xConstrained.push(midX);
      }
    }

    // Final corner position: use constrained average if available, else endpoint average
    const finalX = Math.round(xConstrained.length > 0
      ? xConstrained.reduce((a, b) => a + b, 0) / xConstrained.length
      : allX.reduce((a, b) => a + b, 0) / allX.length);
    const finalY = Math.round(yConstrained.length > 0
      ? yConstrained.reduce((a, b) => a + b, 0) / yConstrained.length
      : allY.reduce((a, b) => a + b, 0) / allY.length);

    // Apply to all endpoints in this corner cluster
    for (const idx of members) {
      const ep = eps[idx];
      if (ep.which === 'start') {
        ep.wall.start.x = finalX;
        ep.wall.start.y = finalY;
      } else {
        ep.wall.end.x = finalX;
        ep.wall.end.y = finalY;
      }
    }
  }

  // ── Step 5: Final per-wall axis enforcement ──
  // After corner solving, force exact H/V alignment per wall
  // by adjusting the endpoint that's NOT a shared corner (or splitting the diff)
  for (const wall of walls) {
    const orient = wallOrientation.get(wall)!;
    if (orient === 'H') {
      const midY = Math.round((wall.start.y + wall.end.y) / 2);
      wall.start.y = midY;
      wall.end.y = midY;
    } else {
      const midX = Math.round((wall.start.x + wall.end.x) / 2);
      wall.start.x = midX;
      wall.end.x = midX;
    }
  }

  // ── Step 6: Final endpoint merge (catch any remaining small gaps) ──
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

  // Post-process walls (after doors/windows/furniture so projections use original positions)
  const md = options.mergeDistance ?? 15;
  if (options.orthogonal) {
    enforceOrthogonal(walls, md, furniture);
  } else if (options.straighten !== false) {
    straightenWalls(walls, options.angleTolerance ?? 5, md);
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
