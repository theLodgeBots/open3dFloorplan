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
export const ORTHO_VERSION = 'v5';

function enforceOrthogonal(walls: Wall[], mergeDistance = 15, furniture?: FurnitureItem[]): void {
  if (walls.length === 0) return;

  // ── Step 1: Global rotation to remove dominant angle ──
  let sinSum = 0, cosSum = 0;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
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

  // ── Step 2: Classify each wall as H or V ──
  const wallOrientation = new Map<Wall, 'H' | 'V'>();
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const angle = Math.atan2(dy, dx);
    const nearestAxis = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    wallOrientation.set(wall, Math.abs(Math.cos(nearestAxis)) > Math.abs(Math.sin(nearestAxis)) ? 'H' : 'V');
  }

  // ── Step 3: Enforce exact H/V per wall ──
  // H walls: lock both endpoints to same Y (average)
  // V walls: lock both endpoints to same X (average)
  for (const wall of walls) {
    const orient = wallOrientation.get(wall)!;
    if (orient === 'H') {
      const midY = Math.round((wall.start.y + wall.end.y) / 2);
      wall.start.y = midY;
      wall.end.y = midY;
      wall.start.x = Math.round(wall.start.x);
      wall.end.x = Math.round(wall.end.x);
    } else {
      const midX = Math.round((wall.start.x + wall.end.x) / 2);
      wall.start.x = midX;
      wall.end.x = midX;
      wall.start.y = Math.round(wall.start.y);
      wall.end.y = Math.round(wall.end.y);
    }
  }

  // ── Step 4: Smart corner merge ──
  // When merging nearby endpoints, respect wall orientation:
  //   H wall endpoints: Y is authoritative (locked), only merge X
  //   V wall endpoints: X is authoritative (locked), only merge Y
  //   H meets V: perfect corner — H provides Y, V provides X
  type Endpoint = { wall: Wall; which: 'start' | 'end'; orient: 'H' | 'V' };
  const eps: Endpoint[] = [];
  for (const wall of walls) {
    const orient = wallOrientation.get(wall)!;
    eps.push({ wall, which: 'start', orient });
    eps.push({ wall, which: 'end', orient });
  }

  function getP(ep: Endpoint): Point {
    return ep.which === 'start' ? ep.wall.start : ep.wall.end;
  }
  function setP(ep: Endpoint, x: number, y: number) {
    if (ep.which === 'start') { ep.wall.start.x = x; ep.wall.start.y = y; }
    else { ep.wall.end.x = x; ep.wall.end.y = y; }
  }

  // Union-Find
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

  const corners = new Map<number, number[]>();
  for (let i = 0; i < eps.length; i++) {
    const root = find(i);
    if (!corners.has(root)) corners.set(root, []);
    corners.get(root)!.push(i);
  }

  for (const [, members] of corners) {
    if (members.length < 2) continue;

    // Collect authoritative values per axis
    const xFromV: number[] = []; // V walls own their X
    const yFromH: number[] = []; // H walls own their Y
    const allX: number[] = [];
    const allY: number[] = [];

    for (const idx of members) {
      const p = getP(eps[idx]);
      allX.push(p.x);
      allY.push(p.y);
      if (eps[idx].orient === 'V') xFromV.push(p.x);
      if (eps[idx].orient === 'H') yFromH.push(p.y);
    }

    // X: prefer V-wall authority, fallback to average
    const finalX = Math.round(xFromV.length > 0
      ? xFromV.reduce((a, b) => a + b, 0) / xFromV.length
      : allX.reduce((a, b) => a + b, 0) / allX.length);

    // Y: prefer H-wall authority, fallback to average
    const finalY = Math.round(yFromH.length > 0
      ? yFromH.reduce((a, b) => a + b, 0) / yFromH.length
      : allY.reduce((a, b) => a + b, 0) / allY.length);

    for (const idx of members) {
      const ep = eps[idx];
      if (ep.orient === 'H') {
        // H wall: keep its locked Y, take merged X
        setP(ep, finalX, getP(ep).y);
      } else {
        // V wall: keep its locked X, take merged Y
        setP(ep, getP(ep).x, finalY);
      }
    }
  }

  // ── Step 5: Iterative orientation-aware merge + re-enforce ──
  for (let iter = 0; iter < 5; iter++) {
    // Rebuild eps list with current positions
    const iterEps: Endpoint[] = [];
    for (const wall of walls) {
      const orient = wallOrientation.get(wall)!;
      iterEps.push({ wall, which: 'start', orient });
      iterEps.push({ wall, which: 'end', orient });
    }

    // Re-cluster
    const iterParent: number[] = iterEps.map((_, i) => i);
    function iterFind(i: number): number {
      while (iterParent[i] !== i) { iterParent[i] = iterParent[iterParent[i]]; i = iterParent[i]; }
      return i;
    }
    function iterUnion(a: number, b: number) { iterParent[iterFind(a)] = iterFind(b); }

    for (let i = 0; i < iterEps.length; i++) {
      const pi = getP(iterEps[i]);
      for (let j = i + 1; j < iterEps.length; j++) {
        const pj = getP(iterEps[j]);
        if (Math.hypot(pi.x - pj.x, pi.y - pj.y) < mergeDistance) {
          iterUnion(i, j);
        }
      }
    }

    const iterCorners = new Map<number, number[]>();
    for (let i = 0; i < iterEps.length; i++) {
      const root = iterFind(i);
      if (!iterCorners.has(root)) iterCorners.set(root, []);
      iterCorners.get(root)!.push(i);
    }

    // Orientation-aware merge
    for (const [, members] of iterCorners) {
      if (members.length < 2) continue;
      const xFromV: number[] = [];
      const yFromH: number[] = [];
      const allX: number[] = [];
      const allY: number[] = [];

      for (const idx of members) {
        const p = getP(iterEps[idx]);
        allX.push(p.x);
        allY.push(p.y);
        if (iterEps[idx].orient === 'V') xFromV.push(p.x);
        if (iterEps[idx].orient === 'H') yFromH.push(p.y);
      }

      const finalX = Math.round(xFromV.length > 0
        ? xFromV.reduce((a, b) => a + b, 0) / xFromV.length
        : allX.reduce((a, b) => a + b, 0) / allX.length);
      const finalY = Math.round(yFromH.length > 0
        ? yFromH.reduce((a, b) => a + b, 0) / yFromH.length
        : allY.reduce((a, b) => a + b, 0) / allY.length);

      for (const idx of members) {
        setP(iterEps[idx], finalX, finalY);
      }
    }

    // Re-enforce H/V
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
  }

  // ── Step 6: Final coordinate snapping for rounding artifacts ──
  // After iteration, some corners differ by 1-2cm due to rounding.
  // Group same-orientation walls by their locked coordinate and unify nearby values.
  function snapCoordGroups(getCoord: (w: Wall) => number, setCoord: (w: Wall, v: number) => void, filter: (w: Wall) => boolean) {
    const vals = walls.filter(filter).map(w => ({ wall: w, val: getCoord(w) }));
    vals.sort((a, b) => a.val - b.val);
    let i = 0;
    while (i < vals.length) {
      let j = i;
      while (j < vals.length && vals[j].val - vals[i].val <= 3) j++;
      // Snap group [i, j) to weighted average
      const avg = Math.round(vals.slice(i, j).reduce((s, v) => s + v.val, 0) / (j - i));
      for (let k = i; k < j; k++) setCoord(vals[k].wall, avg);
      i = j;
    }
  }

  // Snap V walls' X coordinates
  snapCoordGroups(
    w => w.start.x,
    (w, v) => { w.start.x = v; w.end.x = v; },
    w => wallOrientation.get(w) === 'V'
  );
  // Snap H walls' Y coordinates
  snapCoordGroups(
    w => w.start.y,
    (w, v) => { w.start.y = v; w.end.y = v; },
    w => wallOrientation.get(w) === 'H'
  );

  // Final merge
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
