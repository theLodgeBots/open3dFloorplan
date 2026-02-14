import { writable, derived, get } from 'svelte/store';
import type { Project, Floor, Wall, Door, Window as Win, FurnitureItem, Point, Stair, Column, BackgroundImage, GuideLine } from '$lib/models/types';


function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultFloor(level = 0): Floor {
  const id = uid();
  return { id, name: level === 0 ? 'Ground Floor' : `Floor ${level}`, level, walls: [], rooms: [], doors: [], windows: [], furniture: [], stairs: [], columns: [], guides: [], measurements: [], annotations: [] };
}

export function createDefaultProject(name = 'Untitled Project'): Project {
  const floor = createDefaultFloor();
  return {
    id: uid(),
    name,
    floors: [floor],
    activeFloorId: floor.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const currentProject = writable<Project | null>(null);

export const activeFloor = derived(currentProject, ($p) => {
  if (!$p) return null;
  return $p.floors.find((f) => f.id === $p.activeFloorId) ?? $p.floors[0] ?? null;
});

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'furniture';
export const selectedTool = writable<Tool>('select');
export const snapEnabled = writable<boolean>(true);
/** When true, left-click drag pans the canvas instead of selecting */
export const panMode = writable<boolean>(false);
export const showFurnitureStore = writable<boolean>(true);
export const selectedElementId = writable<string | null>(null);
/** Multi-select: set of element IDs currently selected (used alongside selectedElementId for marquee/shift-click) */
export const selectedElementIds = writable<Set<string>>(new Set());
export const viewMode = writable<'2d' | '3d'>('2d');

// Undo / Redo
const undoStack: string[] = [];
const redoStack: string[] = [];

// Undo grouping: batch multiple mutations into a single undo entry
let undoGroupSnapshot: string | null = null;
let undoGroupDepth = 0;

/** Begin an undo group. Nested calls are supported; only the outermost pair takes effect. */
export function beginUndoGroup() {
  if (undoGroupDepth === 0) {
    const p = get(currentProject);
    if (p) undoGroupSnapshot = JSON.stringify(p);
  }
  undoGroupDepth++;
}

/** End an undo group. Commits a single undo entry from the state captured at beginUndoGroup(). */
export function endUndoGroup() {
  if (undoGroupDepth <= 0) return;
  undoGroupDepth--;
  if (undoGroupDepth === 0 && undoGroupSnapshot !== null) {
    undoStack.push(undoGroupSnapshot);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    undoGroupSnapshot = null;
  }
}

function snapshot() {
  // If inside an undo group, skip — the group handles the snapshot
  if (undoGroupDepth > 0) return;
  const p = get(currentProject);
  if (p) undoStack.push(JSON.stringify(p));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
}

function reviveDates(p: Project): Project {
  if (p.createdAt && !(p.createdAt instanceof Date)) p.createdAt = new Date(p.createdAt as any);
  if (p.updatedAt && !(p.updatedAt instanceof Date)) p.updatedAt = new Date(p.updatedAt as any);
  return p;
}

export function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  const cur = get(currentProject);
  if (cur) redoStack.push(JSON.stringify(cur));
  currentProject.set(reviveDates(JSON.parse(prev)));
}

export function redo() {
  const next = redoStack.pop();
  if (!next) return;
  const cur = get(currentProject);
  if (cur) undoStack.push(JSON.stringify(cur));
  currentProject.set(reviveDates(JSON.parse(next)));
}

function mutate(fn: (floor: Floor) => void) {
  const p = get(currentProject);
  if (!p) return;
  snapshot();
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  fn(floor);
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function addWall(start: Point, end: Point): string {
  const id = uid();
  mutate((f) => {
    f.walls.push({ id, start, end, thickness: 15, height: 280, color: '#444444' });
  });
  return id;
}

export function removeWall(id: string) {
  mutate((f) => {
    f.walls = f.walls.filter((w) => w.id !== id);
    f.doors = f.doors.filter((d) => d.wallId !== id);
    f.windows = f.windows.filter((w) => w.wallId !== id);
  });
}

export function addDoor(wallId: string, position: number, doorType: Door['type'] = 'single'): string {
  const id = uid();
  const defaults: Record<Door['type'], { width: number; height: number }> = {
    single: { width: 90, height: 210 },
    double: { width: 150, height: 210 },
    sliding: { width: 180, height: 210 },
    french: { width: 150, height: 210 },
    pocket: { width: 90, height: 210 },
    bifold: { width: 180, height: 210 },
  };
  const { width, height } = defaults[doorType];
  mutate((f) => {
    f.doors.push({ id, wallId, position, width, height, type: doorType, swingDirection: 'left', flipSide: false });
  });
  return id;
}

export function addWindow(wallId: string, position: number, windowType: import('$lib/models/types').Window['type'] = 'standard'): string {
  const id = uid();
  const defaults: Record<import('$lib/models/types').Window['type'], { width: number; height: number }> = {
    standard: { width: 120, height: 120 },
    fixed: { width: 100, height: 100 },
    casement: { width: 80, height: 130 },
    sliding: { width: 180, height: 120 },
    bay: { width: 200, height: 150 },
  };
  const { width, height } = defaults[windowType];
  mutate((f) => {
    f.windows.push({ id, wallId, position, width, height, sillHeight: 90, type: windowType });
  });
  return id;
}

export function addFurniture(catalogId: string, position: Point): string {
  const id = uid();
  mutate((f) => {
    f.furniture.push({ id, catalogId, position, rotation: 0, scale: { x: 1, y: 1, z: 1 } });
  });
  return id;
}

/** Snapshot the current state before a drag begins (call once at drag start) */
export function beginDrag() {
  snapshot();
}

/** Move furniture without creating an undo snapshot on every call (used during drag).
 *  Call `beginDrag()` when the drag starts to snapshot the pre-drag state. */
export function moveFurniture(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const item = floor.furniture.find((fi) => fi.id === id);
  if (item) {
    item.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Snapshot the current state before a drag begins (call once at drag start).
 *  Alias for beginDrag() for backward compatibility. */
export function commitFurnitureMove() {
  snapshot();
}

export function rotateFurniture(id: string, angle: number) {
  mutate((f) => {
    const item = f.furniture.find((fi) => fi.id === id);
    if (item) item.rotation = (item.rotation + angle) % 360;
  });
}

export function setFurnitureRotation(id: string, angle: number) {
  mutate((f) => {
    const item = f.furniture.find((fi) => fi.id === id);
    if (item) item.rotation = ((angle % 360) + 360) % 360;
  });
}

export function scaleFurniture(id: string, scale: { x: number; y: number }) {
  mutate((f) => {
    const fi = f.furniture.find((item) => item.id === id);
    if (fi) {
      fi.scale = { x: Math.max(0.2, scale.x), y: Math.max(0.2, scale.y), z: fi.scale.z };
    }
  });
}

export function removeFurniture(id: string) {
  mutate((f) => {
    f.furniture = f.furniture.filter((fi) => fi.id !== id);
  });
}

// Stairs
export function addStair(position: Point): string {
  const id = uid();
  mutate((f) => {
    if (!f.stairs) f.stairs = [];
    f.stairs.push({ id, position, rotation: 0, width: 100, depth: 300, riserCount: 14, direction: 'up', stairType: 'straight' });
  });
  return id;
}

export function updateStair(id: string, updates: Partial<Stair>) {
  mutate((f) => {
    if (!f.stairs) return;
    const s = f.stairs.find((s) => s.id === id);
    if (s) Object.assign(s, updates);
  });
}

export function removeStair(id: string) {
  mutate((f) => {
    if (!f.stairs) return;
    f.stairs = f.stairs.filter((s) => s.id !== id);
  });
}

export function moveStair(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor || !floor.stairs) return;
  const s = floor.stairs.find((s) => s.id === id);
  if (s) {
    s.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

// Background Image
export function setBackgroundImage(bg: BackgroundImage | undefined) {
  mutate((f) => {
    f.backgroundImage = bg;
  });
}

export function updateBackgroundImage(updates: Partial<BackgroundImage>) {
  mutate((f) => {
    if (f.backgroundImage) Object.assign(f.backgroundImage, updates);
  });
}

// Column functions
export function addColumn(position: Point, shape: 'round' | 'square' = 'round'): string {
  const id = uid();
  mutate((f) => {
    if (!f.columns) f.columns = [];
    f.columns.push({ id, position, rotation: 0, shape, diameter: 30, height: 280, color: '#cccccc' });
  });
  return id;
}

export function updateColumn(id: string, updates: Partial<Column>) {
  mutate((f) => {
    if (!f.columns) return;
    const c = f.columns.find((c) => c.id === id);
    if (c) Object.assign(c, updates);
  });
}

export function removeColumn(id: string) {
  mutate((f) => {
    if (!f.columns) return;
    f.columns = f.columns.filter((c) => c.id !== id);
  });
}

export function moveColumn(id: string, position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor || !floor.columns) return;
  const c = floor.columns.find((c) => c.id === id);
  if (c) {
    c.position = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Tool for placing columns */
export const placingColumn = writable<boolean>(false);
export const placingColumnShape = writable<'round' | 'square'>('round');

/** Tool for placing stairs */
export const placingStair = writable<boolean>(false);

/** Scale calibration mode */
export const calibrationMode = writable<boolean>(false);
export const calibrationPoints = writable<Point[]>([]);

export function removeElement(id: string) {
  mutate((f) => {
    // Check if the element being removed is a wall — if so, also remove associated doors/windows
    const isWall = f.walls.some((w) => w.id === id);
    f.walls = f.walls.filter((w) => w.id !== id);
    if (isWall) {
      // Cascade delete: remove doors and windows attached to this wall
      f.doors = f.doors.filter((d) => d.wallId !== id);
      f.windows = f.windows.filter((w) => w.wallId !== id);
    }
    f.doors = f.doors.filter((d) => d.id !== id);
    f.windows = f.windows.filter((w) => w.id !== id);
    f.furniture = f.furniture.filter((fi) => fi.id !== id);
    if (f.stairs) f.stairs = f.stairs.filter((s) => s.id !== id);
    if (f.columns) f.columns = f.columns.filter((c) => c.id !== id);
  });
}

/** Move a wall endpoint without creating an undo snapshot (for dragging) */
export function moveWallEndpoint(id: string, endpoint: 'start' | 'end', position: Point) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const w = floor.walls.find((w) => w.id === id);
  if (w) {
    w[endpoint] = position;
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

export function updateWall(id: string, updates: Partial<Wall>) {
  mutate((f) => {
    const w = f.walls.find((w) => w.id === id);
    if (w) Object.assign(w, updates);
  });
}

export function updateDoor(id: string, updates: Partial<Door>) {
  mutate((f) => {
    const d = f.doors.find((d) => d.id === id);
    if (d) Object.assign(d, updates);
  });
}

export function updateWindow(id: string, updates: Partial<Win>) {
  mutate((f) => {
    const w = f.windows.find((w) => w.id === id);
    if (w) Object.assign(w, updates);
  });
}

export function updateFurniture(id: string, updates: Partial<FurnitureItem>) {
  mutate((f) => {
    const fi = f.furniture.find((fi) => fi.id === id);
    if (fi) Object.assign(fi, updates);
  });
}

export function updateRoom(id: string, updates: Partial<{ name: string; floorTexture: string; color: string; roomType: import('$lib/models/types').RoomCategory }>) {
  mutate((f) => {
    let r = f.rooms.find((r) => r.id === id);
    if (r) {
      Object.assign(r, updates);
    } else {
      // Room not in floor.rooms yet (dynamically detected) — add it so changes persist on save
      const detected = get(detectedRoomsStore).find((r) => r.id === id);
      if (detected) {
        const newRoom = { ...detected, ...updates };
        f.rooms.push(newRoom);
      }
    }
  });
}

export function addFloor(name?: string, copyCurrentLayout = false) {
  const p = get(currentProject);
  if (!p) return;
  snapshot();
  const level = p.floors.length;
  const floor: Floor = { id: uid(), name: name ?? `Floor ${level}`, level, walls: [], rooms: [], doors: [], windows: [], furniture: [], stairs: [], columns: [] };
  if (copyCurrentLayout) {
    const cur = p.floors.find(f => f.id === p.activeFloorId);
    if (cur) {
      floor.walls = cur.walls.map(w => ({ ...w, id: uid() }));
    }
  }
  p.floors.push(floor);
  p.activeFloorId = floor.id;
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function removeFloor(id: string) {
  const p = get(currentProject);
  if (!p || p.floors.length <= 1) return;
  snapshot();
  p.floors = p.floors.filter(f => f.id !== id);
  if (p.activeFloorId === id) {
    p.activeFloorId = p.floors[0].id;
  }
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function setActiveFloor(floorId: string) {
  const p = get(currentProject);
  if (!p) return;
  if (p.floors.some((f) => f.id === floorId)) {
    p.activeFloorId = floorId;
    currentProject.set({ ...p });
  }
}

export function updateProjectName(name: string) {
  const p = get(currentProject);
  if (!p) return;
  p.name = name;
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function loadProject(project: Project) {
  undoStack.length = 0;
  redoStack.length = 0;
  currentProject.set(project);
}

/** Import a floor's data into the current project's active floor (replaces walls/doors/windows/furniture) */
export function importFloorIntoCurrentProject(floor: import('$lib/models/types').Floor) {
  const p = get(currentProject);
  if (!p) return;
  snapshot();
  const activeFloorIdx = p.floors.findIndex((f) => f.id === p.activeFloorId);
  if (activeFloorIdx === -1) return;
  const existing = p.floors[activeFloorIdx];
  // Merge imported data into the active floor
  existing.walls = [...existing.walls, ...floor.walls];
  existing.doors = [...existing.doors, ...floor.doors];
  existing.windows = [...existing.windows, ...floor.windows];
  existing.furniture = [...existing.furniture, ...floor.furniture];
  if (floor.stairs) existing.stairs = [...(existing.stairs || []), ...floor.stairs];
  if (floor.columns) existing.columns = [...(existing.columns || []), ...floor.columns];
  currentProject.set({ ...p });
}

export const selectedRoomId = writable<string | null>(null);
/** Detected rooms (synced from canvas room detection) */
export const detectedRoomsStore = writable<import('$lib/models/types').Room[]>([]);
/** catalogId currently being placed (null = not placing) */
export const placingFurnitureId = writable<string | null>(null);
/** Rotation angle for furniture being placed */
export const placingRotation = writable<number>(0);
/** Door subtype currently selected for placement */
export const placingDoorType = writable<Door['type']>('single');
/** Window subtype currently selected for placement */
export const placingWindowType = writable<import('$lib/models/types').Window['type']>('standard');

/** Duplicate a door onto the same wall */
export function duplicateDoor(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const d = floor.doors.find(d => d.id === id);
  if (!d) return null;
  const newPos = Math.min(1, d.position + 0.1);
  const newId = uid();
  mutate(f => {
    f.doors.push({ ...d, id: newId, position: newPos });
  });
  return newId;
}

/** Duplicate a window onto the same wall */
export function duplicateWindow(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.windows.find(w => w.id === id);
  if (!w) return null;
  const newPos = Math.min(1, w.position + 0.1);
  const newId = uid();
  mutate(f => {
    f.windows.push({ ...w, id: newId, position: newPos });
  });
  return newId;
}

/** Duplicate furniture */
export function duplicateFurniture(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const fi = floor.furniture.find(fi => fi.id === id);
  if (!fi) return null;
  const newId = uid();
  mutate(f => {
    f.furniture.push({ ...fi, id: newId, position: { x: fi.position.x + 30, y: fi.position.y + 30 } });
  });
  return newId;
}

/** Move a wall parallel to itself (both endpoints shift by the same perpendicular offset) without undo snapshot (for dragging) */
export function moveWallParallel(id: string, dx: number, dy: number) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return;
  const w = floor.walls.find((w) => w.id === id);
  if (w) {
    w.start = { x: w.start.x + dx, y: w.start.y + dy };
    w.end = { x: w.end.x + dx, y: w.end.y + dy };
    if (w.curvePoint) {
      w.curvePoint = { x: w.curvePoint.x + dx, y: w.curvePoint.y + dy };
    }
    p.updatedAt = new Date();
    currentProject.set({ ...p });
  }
}

/** Split a wall into two segments at a given parameter t (0-1) */
export function splitWall(id: string, t: number): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find((f) => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.walls.find((w) => w.id === id);
  if (!w || w.curvePoint) return null; // don't split curved walls
  if (t <= 0.001 || t >= 0.999) return null; // prevent division by zero at extremes
  snapshot();
  const midPt: Point = {
    x: w.start.x + (w.end.x - w.start.x) * t,
    y: w.start.y + (w.end.y - w.start.y) * t,
  };
  const newId = uid();
  // New wall from midpoint to original end
  floor.walls.push({ id: newId, start: { ...midPt }, end: { ...w.end }, thickness: w.thickness, height: w.height, color: w.color });
  // Shorten original wall to midpoint
  w.end = { ...midPt };
  // Move doors/windows on the original wall: adjust positions
  for (const d of floor.doors) {
    if (d.wallId === id) {
      if (d.position > t) {
        d.wallId = newId;
        d.position = (d.position - t) / (1 - t);
      } else {
        d.position = d.position / t;
      }
    }
  }
  for (const win of floor.windows) {
    if (win.wallId === id) {
      if (win.position > t) {
        win.wallId = newId;
        win.position = (win.position - t) / (1 - t);
      } else {
        win.position = win.position / t;
      }
    }
  }
  p.updatedAt = new Date();
  currentProject.set({ ...p });
  return newId;
}

/** Duplicate a wall */
export function duplicateWall(id: string): string | null {
  const p = get(currentProject);
  if (!p) return null;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return null;
  const w = floor.walls.find(w => w.id === id);
  if (!w) return null;
  const newId = uid();
  mutate(f => {
    f.walls.push({ ...w, id: newId, start: { x: w.start.x + 30, y: w.start.y + 30 }, end: { x: w.end.x + 30, y: w.end.y + 30 } });
  });
  return newId;
}

// --- Guide Lines ---
export function addGuide(orientation: 'horizontal' | 'vertical', position: number): string {
  const id = uid();
  mutate(f => {
    if (!f.guides) f.guides = [];
    f.guides.push({ id, orientation, position });
  });
  return id;
}

export function moveGuide(id: string, position: number) {
  mutate(f => {
    if (!f.guides) return;
    const g = f.guides.find(g => g.id === id);
    if (g) g.position = position;
  });
}

export function removeGuide(id: string) {
  mutate(f => {
    if (!f.guides) return;
    f.guides = f.guides.filter(g => g.id !== id);
  });
}

// --- Measurements ---
export function addMeasurement(x1: number, y1: number, x2: number, y2: number): string {
  const id = uid();
  mutate(f => {
    if (!f.measurements) f.measurements = [];
    f.measurements.push({ id, x1, y1, x2, y2 });
  });
  return id;
}

export function removeMeasurement(id: string) {
  mutate(f => {
    if (!f.measurements) return;
    f.measurements = f.measurements.filter(m => m.id !== id);
  });
}

// --- Annotations ---
export function addAnnotation(x1: number, y1: number, x2: number, y2: number, offset = 40, label?: string): string {
  const id = uid();
  mutate(f => {
    if (!f.annotations) f.annotations = [];
    f.annotations.push({ id, x1, y1, x2, y2, offset, label });
  });
  return id;
}

export function removeAnnotation(id: string) {
  mutate(f => {
    if (!f.annotations) return;
    f.annotations = f.annotations.filter(a => a.id !== id);
  });
}

export function updateAnnotation(id: string, updates: Partial<{ x1: number; y1: number; x2: number; y2: number; offset: number; label: string }>) {
  mutate(f => {
    if (!f.annotations) return;
    const a = f.annotations.find(a => a.id === id);
    if (!a) return;
    Object.assign(a, updates);
  });
}

// Layer visibility store (used by LayersPanel and FloorPlanCanvas)
export const layerVisibility = writable<{ walls: boolean; doors: boolean; windows: boolean; furniture: boolean; stairs: boolean; columns: boolean; guides: boolean; measurements: boolean; annotations: boolean }>({
  walls: true, doors: true, windows: true, furniture: true, stairs: true, columns: true, guides: true, measurements: true, annotations: true,
});

// Zoom store for 2D canvas — shared between FloorPlanCanvas and TopBar
export const canvasZoom = writable<number>(1);
// Camera position stores for 2D canvas — used to compute viewport center
export const canvasCamX = writable<number>(0);
export const canvasCamY = writable<number>(0);

