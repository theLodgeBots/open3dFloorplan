<script lang="ts">
  import { onMount } from 'svelte';
  import { activeFloor, selectedTool, selectedElementId, selectedRoomId, addWall, addDoor, addWindow, updateWall, moveWallEndpoint, updateDoor, updateWindow, addFurniture, moveFurniture, commitFurnitureMove, rotateFurniture, setFurnitureRotation, scaleFurniture, removeElement, placingFurnitureId, placingRotation, detectedRoomsStore } from '$lib/stores/project';
  import type { Point, Wall, Door, Window as Win, FurnitureItem } from '$lib/models/types';
  import type { Floor, Room } from '$lib/models/types';
  import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { getMaterial } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { drawFurnitureIcon } from '$lib/utils/furnitureIcons';
  import { handleGlobalShortcut } from '$lib/utils/shortcuts';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = $state(800);
  let height = $state(600);

  // Camera
  let camX = $state(0);
  let camY = $state(0);
  let zoom = $state(1);

  // Wall drawing state
  let wallStart: Point | null = $state(null);
  let wallSequenceFirst: Point | null = $state(null);
  let mousePos: Point = $state({ x: 0, y: 0 });

  // Pan state
  let isPanning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let spaceDown = $state(false);

  // Furniture drag state
  let draggingFurnitureId: string | null = $state(null);
  let dragOffset: Point = { x: 0, y: 0 };
  let draggingDoorId: string | null = $state(null);
  let draggingWindowId: string | null = $state(null);

  // Measurement tool
  let measureStart: Point | null = $state(null);
  let measureEnd: Point | null = $state(null);
  let measuring = $state(false);

  // Grid toggle
  let showGrid = $state(true);

  // Detected rooms
  let detectedRooms: Room[] = $state([]);
  let lastWallHash = '';

  const GRID = 20;
  const SNAP = 10;
  const MAGNETIC_SNAP = 15;
  const WALL_SNAP_DIST = 30; // cm — distance threshold to snap furniture to wall

  // Store subscriptions
  let currentFloor: Floor | null = $state(null);
  let currentSelectedId: string | null = $state(null);
  let currentSelectedRoomId: string | null = $state(null);
  let currentPlacingId: string | null = $state(null);
  let currentPlacingRotation: number = $state(0);
  let currentTool: string = $state('select');

  // Wall endpoint drag state
  let draggingWallEndpoint: { wallId: string; endpoint: 'start' | 'end' } | null = $state(null);

  // Resize/rotate handle drag state
  type HandleType = 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'rotate';
  let draggingHandle: HandleType | null = $state(null);
  let handleDragStart: Point = { x: 0, y: 0 };
  let handleOrigScale: { x: number; y: number } = { x: 1, y: 1 };
  let handleOrigRotation: number = 0;

  // Wall snap state for visual feedback
  let wallSnapInfo: { wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null = $state(null);

  /**
   * Snap furniture position so its edge is flush against the nearest wall.
   * Returns adjusted position and rotation, or null if no wall is close enough.
   */
  function snapFurnitureToWall(pos: Point, catalogId: string, currentRotation: number): { position: Point; rotation: number; wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null {
    if (!currentFloor) return null;
    const cat = getCatalogItem(catalogId);
    if (!cat) return null;

    // Furniture half-depth (the "back" dimension that goes against the wall)
    const halfDepth = cat.depth / 2;

    let bestDist = WALL_SNAP_DIST;
    let bestResult: { position: Point; rotation: number; wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null = null;

    for (const wall of currentFloor.walls) {
      const wx = wall.end.x - wall.start.x;
      const wy = wall.end.y - wall.start.y;
      const wLen = Math.hypot(wx, wy);
      if (wLen < 1) continue;

      // Unit vectors along wall and perpendicular (normal)
      const ux = wx / wLen, uy = wy / wLen;
      const nx = -uy, ny = ux; // normal pointing "left" of wall direction

      // Project furniture center onto wall line
      const dx = pos.x - wall.start.x;
      const dy = pos.y - wall.start.y;
      const along = dx * ux + dy * uy; // projection along wall
      const perp = dx * nx + dy * ny;  // signed distance from wall center-line

      // Check if projection falls within wall segment (with some margin)
      if (along < -cat.width / 2 || along > wLen + cat.width / 2) continue;

      const wallHalfThickness = wall.thickness / 2;
      // Distance from furniture center to wall surface on the side the furniture is on
      const absDist = Math.abs(perp) - wallHalfThickness;

      // We want the furniture edge to touch the wall, so target distance = halfDepth
      const snapDist = Math.abs(absDist - halfDepth);

      if (snapDist < bestDist) {
        bestDist = snapDist;
        const side: 'normal' | 'anti' = perp >= 0 ? 'normal' : 'anti';
        const sign = perp >= 0 ? 1 : -1;
        // Position: push center so edge is flush with wall surface
        const targetPerp = sign * (wallHalfThickness + halfDepth);
        const clampedAlong = Math.max(cat.width / 2, Math.min(wLen - cat.width / 2, along));
        const newX = wall.start.x + ux * clampedAlong + nx * targetPerp;
        const newY = wall.start.y + uy * clampedAlong + ny * targetPerp;
        // Align rotation: furniture "front" faces away from wall
        const wallAngle = Math.atan2(wy, wx) * 180 / Math.PI;
        // Furniture at 0° has depth along Y axis, so align perpendicular
        const targetRotation = perp >= 0 ? wallAngle : wallAngle + 180;

        bestResult = {
          position: { x: snap(newX), y: snap(newY) },
          rotation: ((targetRotation % 360) + 360) % 360,
          wallId: wall.id,
          side,
          wallAngle: wallAngle
        };
      }
    }
    return bestResult;
  }

  function snap(v: number): number {
    return Math.round(v / SNAP) * SNAP;
  }

  function screenToWorld(sx: number, sy: number): Point {
    return { x: (sx - width / 2) / zoom + camX, y: (sy - height / 2) / zoom + camY };
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - camX) * zoom + width / 2, y: (wy - camY) * zoom + height / 2 };
  }

  function magneticSnap(p: Point): Point & { snappedToEndpoint?: boolean } {
    if (!currentFloor) return { x: snap(p.x), y: snap(p.y) };
    let best: Point & { snappedToEndpoint?: boolean } = { x: snap(p.x), y: snap(p.y) };
    let bestDist = MAGNETIC_SNAP / zoom;
    for (const w of currentFloor.walls) {
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

  function angleSnap(start: Point, end: Point): Point {
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

  function resize() {
    const parent = canvas?.parentElement;
    if (!parent) return;
    width = parent.clientWidth;
    height = parent.clientHeight;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function drawGrid() {
    if (!ctx || !showGrid) return;
    const step = GRID * zoom;
    if (step < 4) return;

    // Minor grid
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 0.5;
    const offX = (width / 2 - camX * zoom) % step;
    const offY = (height / 2 - camY * zoom) % step;
    for (let x = offX; x < width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = offY; y < height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Major grid (every 100cm / 1m)
    const majorStep = 100 * zoom;
    if (majorStep >= 20) {
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 0.8;
      const mOffX = (width / 2 - camX * zoom) % majorStep;
      const mOffY = (height / 2 - camY * zoom) % majorStep;
      for (let x = mOffX; x < width; x += majorStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = mOffY; y < height; y += majorStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    }
  }

  function wallLength(w: Wall): number {
    return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
  }

  function wallThicknessScreen(w: Wall): number {
    return Math.max(w.thickness * zoom, 4);
  }

  function drawWall(w: Wall, selected: boolean) {
    const s = worldToScreen(w.start.x, w.start.y);
    const e = worldToScreen(w.end.x, w.end.y);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const thickness = wallThicknessScreen(w);
    const nx = (-dy / len) * thickness / 2;
    const ny = (dx / len) * thickness / 2;

    ctx.fillStyle = selected ? '#93c5fd' : '#404040';
    ctx.strokeStyle = selected ? '#3b82f6' : '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x + nx, s.y + ny);
    ctx.lineTo(e.x + nx, e.y + ny);
    ctx.lineTo(e.x - nx, e.y - ny);
    ctx.lineTo(s.x - nx, s.y - ny);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dimension line with arrowheads (architectural style)
    const wlen = wallLength(w);
    if (wlen < 10) return; // skip tiny walls
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    const offsetDist = thickness / 2 + 20;
    const nnx = (-dy / len);
    const nny = (dx / len);

    // Pick dimension line side (flip if out of bounds)
    let dimSide = 1;
    const testX = mx + nnx * offsetDist;
    const testY = my + nny * offsetDist;
    if (testX < 10 || testX > width - 10 || testY < 10 || testY > height - 10) dimSide = -1;

    const dOffX = nnx * offsetDist * dimSide;
    const dOffY = nny * offsetDist * dimSide;

    // Extension lines (from wall endpoints to dimension line)
    const extLen = offsetDist + 4;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(s.x + nnx * (thickness / 2 + 2) * dimSide, s.y + nny * (thickness / 2 + 2) * dimSide);
    ctx.lineTo(s.x + nnx * extLen * dimSide, s.y + nny * extLen * dimSide);
    ctx.moveTo(e.x + nnx * (thickness / 2 + 2) * dimSide, e.y + nny * (thickness / 2 + 2) * dimSide);
    ctx.lineTo(e.x + nnx * extLen * dimSide, e.y + nny * extLen * dimSide);
    ctx.stroke();

    // Dimension line
    const ds = { x: s.x + dOffX, y: s.y + dOffY };
    const de = { x: e.x + dOffX, y: e.y + dOffY };
    const dimMx = (ds.x + de.x) / 2;
    const dimMy = (ds.y + de.y) / 2;

    ctx.fillStyle = '#374151';
    const fontSize = Math.max(10, 11 * zoom);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dimLabel = `${(wlen / 100).toFixed(2)} m`;
    const textW = ctx.measureText(dimLabel).width;

    // Draw dimension line with gap for text
    const ux2 = dx / len, uy2 = dy / len;
    const halfGap = textW / 2 + 4;
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(ds.x, ds.y);
    ctx.lineTo(dimMx - ux2 * halfGap, dimMy - uy2 * halfGap);
    ctx.moveTo(dimMx + ux2 * halfGap, dimMy + uy2 * halfGap);
    ctx.lineTo(de.x, de.y);
    ctx.stroke();

    // Arrowheads (tick marks — 45° slash at each end, architectural style)
    const tickSize = Math.max(4, 5 * zoom);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    for (const pt of [ds, de]) {
      ctx.beginPath();
      ctx.moveTo(pt.x - (ux2 + nnx * dimSide) * tickSize, pt.y - (uy2 + nny * dimSide) * tickSize);
      ctx.lineTo(pt.x + (ux2 + nnx * dimSide) * tickSize, pt.y + (uy2 + nny * dimSide) * tickSize);
      ctx.stroke();
    }

    // Dimension text
    ctx.fillStyle = '#374151';
    ctx.fillText(dimLabel, dimMx, dimMy);

    // Endpoint handles when selected (for drag-to-resize)
    if (selected) {
      const handleSize = 5;
      for (const pt of [s, e]) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, handleSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawDoorOnWall(wall: Wall, door: Door) {
    const t = door.position;
    const wx = wall.start.x + (wall.end.x - wall.start.x) * t;
    const wy = wall.start.y + (wall.end.y - wall.start.y) * t;
    const s = worldToScreen(wx, wy);

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    const halfDoor = (door.width / 2) * zoom;
    const thickness = wallThicknessScreen(wall);

    // Clear wall area for door gap (background color)
    ctx.fillStyle = '#fafafa';
    const gux = ux * halfDoor;
    const guy = uy * halfDoor;
    const gnx = nx * (thickness / 2 + 1);
    const gny = ny * (thickness / 2 + 1);
    ctx.beginPath();
    ctx.moveTo(s.x - gux + gnx, s.y - guy + gny);
    ctx.lineTo(s.x + gux + gnx, s.y + guy + gny);
    ctx.lineTo(s.x + gux - gnx, s.y + guy - gny);
    ctx.lineTo(s.x - gux - gnx, s.y - guy - gny);
    ctx.closePath();
    ctx.fill();

    // Door arc (quarter circle) — radius = door panel length (= opening width)
    const r = door.width * zoom;
    const wallAngle = Math.atan2(dy, dx);
    const swingDir = door.swingDirection === 'left' ? 1 : -1;
    // Hinge at one side of the gap, arc swings from wall direction to perpendicular
    const hingeX = s.x - ux * halfDoor;
    const hingeY = s.y - uy * halfDoor;
    const startAngle = wallAngle;
    const endAngle = wallAngle + swingDir * (Math.PI / 2);

    // Swing arc — solid thin line (architectural standard)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hingeX, hingeY, r, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
    ctx.stroke();

    // Door panel line (from hinge to end of arc) — thicker to show the door leaf
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.lineTo(hingeX + r * Math.cos(endAngle), hingeY + r * Math.sin(endAngle));
    ctx.stroke();

    // Door jamb ticks (small perpendicular lines at gap edges)
    const jamb = thickness / 2 + 2;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    for (const sign of [-1, 1]) {
      const jx = s.x + ux * halfDoor * sign;
      const jy = s.y + uy * halfDoor * sign;
      ctx.beginPath();
      ctx.moveTo(jx + nx * jamb, jy + ny * jamb);
      ctx.lineTo(jx - nx * jamb, jy - ny * jamb);
      ctx.stroke();
    }

    // Hinge dot
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(hingeX, hingeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWindowOnWall(wall: Wall, win: Win) {
    const t = win.position;
    const wx = wall.start.x + (wall.end.x - wall.start.x) * t;
    const wy = wall.start.y + (wall.end.y - wall.start.y) * t;
    const s = worldToScreen(wx, wy);

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    const hw = (win.width / 2) * zoom;
    const thickness = wallThicknessScreen(wall);

    // Clear wall area for window gap
    ctx.fillStyle = '#fafafa';
    const gux = ux * hw;
    const guy = uy * hw;
    const gnx = nx * (thickness / 2 + 1);
    const gny = ny * (thickness / 2 + 1);
    ctx.beginPath();
    ctx.moveTo(s.x - gux + gnx, s.y - guy + gny);
    ctx.lineTo(s.x + gux + gnx, s.y + guy + gny);
    ctx.lineTo(s.x + gux - gnx, s.y + guy - gny);
    ctx.lineTo(s.x - gux - gnx, s.y - guy - gny);
    ctx.closePath();
    ctx.fill();

    // Three parallel lines (outer two = wall edges, middle = glass pane)
    const gap = Math.max(2, thickness * 0.25);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    // Outer line 1
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw + nx * gap, s.y - uy * hw + ny * gap);
    ctx.lineTo(s.x + ux * hw + nx * gap, s.y + uy * hw + ny * gap);
    ctx.stroke();
    // Outer line 2
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw - nx * gap, s.y - uy * hw - ny * gap);
    ctx.lineTo(s.x + ux * hw - nx * gap, s.y + uy * hw - ny * gap);
    ctx.stroke();
    // Middle glass line
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw, s.y - uy * hw);
    ctx.lineTo(s.x + ux * hw, s.y + uy * hw);
    ctx.stroke();
    // Connecting end caps
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw + nx * gap, s.y - uy * hw + ny * gap);
    ctx.lineTo(s.x - ux * hw - nx * gap, s.y - uy * hw - ny * gap);
    ctx.moveTo(s.x + ux * hw + nx * gap, s.y + uy * hw + ny * gap);
    ctx.lineTo(s.x + ux * hw - nx * gap, s.y + uy * hw - ny * gap);
    ctx.stroke();
  }

  function drawFurniture(item: FurnitureItem, selected: boolean) {
    const cat = getCatalogItem(item.catalogId);
    if (!cat) return;
    const s = worldToScreen(item.position.x, item.position.y);
    const w = cat.width * (item.scale?.x ?? 1) * zoom;
    const d = cat.depth * (item.scale?.y ?? 1) * zoom;
    const angle = (item.rotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    // Architectural top-down icon
    const strokeColor = selected ? '#3b82f6' : cat.color;
    ctx.lineWidth = selected ? 2 : 1;
    drawFurnitureIcon(ctx, item.catalogId, w, d, cat.color, strokeColor);

    // Label (only if large enough)
    const fontSize = Math.max(8, Math.min(12, Math.min(w, d) * 0.2));
    if (Math.min(w, d) > 20) {
      ctx.fillStyle = '#374151';
      ctx.font = `${fontSize * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cat.name, 0, d / 2 + fontSize * 0.8);
    }

    // Selection handles when selected
    if (selected) {
      // Dashed selection border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4);
      ctx.setLineDash([]);

      // Resize handles at corners
      const hs = 5; // handle half-size
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      for (const [hx, hy] of [[-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]]) {
        ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
        ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
      }

      // Rotation handle — circle with stem above
      const rotY = -d / 2 - 18;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -d / 2 - 2);
      ctx.lineTo(0, rotY + 5);
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, rotY, 5, 0, Math.PI * 2);
      ctx.fill();
      // Small rotation arrow icon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, rotY, 3, -Math.PI * 0.8, Math.PI * 0.4);
      ctx.stroke();
      // Arrowhead
      const arrowAngle = Math.PI * 0.4;
      const ax = Math.cos(arrowAngle) * 3;
      const ay = Math.sin(arrowAngle) * 3;
      ctx.beginPath();
      ctx.moveTo(ax + 1.5, rotY + ay - 1);
      ctx.lineTo(ax, rotY + ay);
      ctx.lineTo(ax - 1, rotY + ay - 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Track wall snap during placement preview
  let placementWallSnap: { position: Point; rotation: number; wallId: string } | null = $state(null);

  function drawFurniturePreview() {
    if (!currentPlacingId) return;
    const cat = getCatalogItem(currentPlacingId);
    if (!cat) return;

    // Check wall snap for preview
    const wallSnap = snapFurnitureToWall(mousePos, currentPlacingId, currentPlacingRotation);
    placementWallSnap = wallSnap;

    const pos = wallSnap ? wallSnap.position : mousePos;
    const rot = wallSnap ? wallSnap.rotation : currentPlacingRotation;

    const s = worldToScreen(pos.x, pos.y);
    const w = cat.width * zoom;
    const d = cat.depth * zoom;
    const angle = (rot * Math.PI) / 180;

    // Highlight snap wall
    if (wallSnap && currentFloor) {
      const snapWall = currentFloor.walls.find(wl => wl.id === wallSnap.wallId);
      if (snapWall) {
        const ws = worldToScreen(snapWall.start.x, snapWall.start.y);
        const we = worldToScreen(snapWall.end.x, snapWall.end.y);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(ws.x, ws.y);
        ctx.lineTo(we.x, we.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.5;
    drawFurnitureIcon(ctx, currentPlacingId, w, d, cat.color, cat.color);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAlignmentGuides(item: FurnitureItem) {
    if (!currentFloor) return;
    const threshold = 5;
    for (const other of currentFloor.furniture) {
      if (other.id === item.id) continue;
      const s1 = worldToScreen(item.position.x, item.position.y);
      const s2 = worldToScreen(other.position.x, other.position.y);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      if (Math.abs(item.position.x - other.position.x) < threshold) {
        ctx.beginPath(); ctx.moveTo(s1.x, 0); ctx.lineTo(s1.x, height); ctx.stroke();
      }
      if (Math.abs(item.position.y - other.position.y) < threshold) {
        ctx.beginPath(); ctx.moveTo(0, s1.y); ctx.lineTo(width, s1.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  function drawMeasurement() {
    if (!measureStart) return;
    const end = measureEnd ?? mousePos;
    const s = worldToScreen(measureStart.x, measureStart.y);
    const e = worldToScreen(end.x, end.y);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    ctx.setLineDash([]);

    // Endpoints
    for (const p of [s, e]) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Distance label
    const dist = Math.hypot(end.x - measureStart.x, end.y - measureStart.y);
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${Math.round(dist)} cm`, mx, my - 6);
  }

  function drawWallJoints(floor: Floor, selId: string | null) {
    // Find endpoints shared by 2+ walls and draw filled circles to cover corner gaps
    const epMap = new Map<string, { x: number; y: number; thickness: number; selected: boolean }[]>();
    for (const w of floor.walls) {
      const sel = w.id === selId;
      for (const ep of [w.start, w.end]) {
        const key = `${Math.round(ep.x)},${Math.round(ep.y)}`;
        if (!epMap.has(key)) epMap.set(key, []);
        epMap.get(key)!.push({ x: ep.x, y: ep.y, thickness: w.thickness, selected: sel });
      }
    }
    for (const [, entries] of epMap) {
      if (entries.length < 2) continue;
      const anySelected = entries.some(e => e.selected);
      const maxThickness = Math.max(...entries.map(e => e.thickness));
      const s = worldToScreen(entries[0].x, entries[0].y);
      const r = Math.max(maxThickness * zoom, 4) / 2 + 0.5;
      ctx.fillStyle = anySelected ? '#93c5fd' : '#404040';
      ctx.strokeStyle = anySelected ? '#3b82f6' : '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawSnapPoints() {
    if (!currentFloor || !showGrid) return;
    ctx.fillStyle = '#3b82f640';
    // Draw snap points at wall endpoints
    const seen = new Set<string>();
    for (const w of currentFloor.walls) {
      for (const ep of [w.start, w.end]) {
        const key = `${ep.x},${ep.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = worldToScreen(ep.x, ep.y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const ROOM_FILLS_BY_TYPE: Record<string, string> = {
    'Living Room': 'rgba(96, 165, 250, 0.08)',   // blue
    'Bedroom':     'rgba(167, 139, 250, 0.08)',   // violet
    'Kitchen':     'rgba(251, 191, 36, 0.08)',    // amber
    'Bathroom':    'rgba(45, 212, 191, 0.08)',    // teal
    'Dining Room': 'rgba(251, 146, 60, 0.08)',    // orange
    'Office':      'rgba(52, 211, 153, 0.08)',    // green
    'Hallway':     'rgba(156, 163, 175, 0.06)',   // gray
    'Closet':      'rgba(244, 114, 182, 0.06)',   // pink
    'Laundry':     'rgba(129, 140, 248, 0.08)',   // indigo
    'Garage':      'rgba(163, 163, 163, 0.08)',   // neutral
  };
  const ROOM_FILLS_DEFAULT = [
    'rgba(167, 139, 250, 0.07)',
    'rgba(96, 165, 250, 0.07)',
    'rgba(52, 211, 153, 0.07)',
    'rgba(251, 191, 36, 0.07)',
    'rgba(248, 113, 113, 0.07)',
    'rgba(244, 114, 182, 0.07)',
    'rgba(45, 212, 191, 0.07)',
    'rgba(251, 146, 60, 0.07)',
  ];

  function getRoomFill(room: Room, index: number): string {
    return ROOM_FILLS_BY_TYPE[room.name] ?? ROOM_FILLS_DEFAULT[index % ROOM_FILLS_DEFAULT.length];
  }

  function drawRooms() {
    if (!currentFloor) return;
    for (let ri = 0; ri < detectedRooms.length; ri++) {
      const room = detectedRooms[ri];
      const poly = getRoomPolygon(room, currentFloor.walls);
      if (poly.length < 3) continue;
      const screenPoly = poly.map(p => worldToScreen(p.x, p.y));
      ctx.fillStyle = getRoomFill(room, ri);
      ctx.beginPath();
      ctx.moveTo(screenPoly[0].x, screenPoly[0].y);
      for (let i = 1; i < screenPoly.length; i++) ctx.lineTo(screenPoly[i].x, screenPoly[i].y);
      ctx.closePath();
      ctx.fill();

      const isSelected = currentSelectedRoomId === room.id;
      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const centroid = roomCentroid(poly);
      const sc = worldToScreen(centroid.x, centroid.y);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${Math.max(11, 13 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${room.name} (${room.area} m²)`, sc.x, sc.y);
    }
  }

  function drawAngleGuides(start: Point) {
    const s = worldToScreen(start.x, start.y);
    ctx.strokeStyle = '#3b82f640';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const guideLen = 200;
    const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
    for (const a of angles) {
      ctx.beginPath(); ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + guideLen * Math.cos(a), s.y + guideLen * Math.sin(a));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function updateDetectedRooms() {
    if (!currentFloor) return;
    const hash = JSON.stringify(currentFloor.walls.map(w => [w.start, w.end]));
    if (hash === lastWallHash) return;
    lastWallHash = hash;
    const newRooms = detectRooms(currentFloor.walls);
    // Preserve user-edited room names by matching on wall sets
    for (const nr of newRooms) {
      const nrWalls = new Set(nr.walls);
      const existing = detectedRooms.find(old => {
        const oldWalls = new Set(old.walls);
        return oldWalls.size === nrWalls.size && [...nrWalls].every(w => oldWalls.has(w));
      });
      if (existing) {
        nr.id = existing.id;
        nr.name = existing.name;
        nr.floorTexture = existing.floorTexture;
      }
    }
    detectedRooms = newRooms;
    detectedRoomsStore.set(newRooms);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    drawGrid();

    const floor = currentFloor;
    if (!floor) { requestAnimationFrame(draw); return; }

    updateDetectedRooms();
    const selId = currentSelectedId;

    drawRooms();
    drawSnapPoints();

    for (const w of floor.walls) drawWall(w, w.id === selId);

    // Draw filled joints where walls share endpoints (covers corner gaps)
    drawWallJoints(floor, selId);

    for (const d of floor.doors) {
      const wall = floor.walls.find((w) => w.id === d.wallId);
      if (wall) drawDoorOnWall(wall, d);
    }
    for (const win of floor.windows) {
      const wall = floor.walls.find((w) => w.id === win.wallId);
      if (wall) drawWindowOnWall(wall, win);
    }

    // Furniture
    for (const fi of floor.furniture) {
      const selected = fi.id === selId;
      if (selected && draggingFurnitureId === fi.id) drawAlignmentGuides(fi);
      drawFurniture(fi, selected);
    }

    // Wall snap indicator — highlight the target wall
    if (wallSnapInfo && currentFloor) {
      const snapWall = currentFloor.walls.find(w => w.id === wallSnapInfo!.wallId);
      if (snapWall) {
        const s = worldToScreen(snapWall.start.x, snapWall.start.y);
        const e = worldToScreen(snapWall.end.x, snapWall.end.y);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Furniture placement preview
    if (currentPlacingId && currentTool === 'furniture') drawFurniturePreview();

    // Wall in progress — draw close indicator at first point
    if (wallSequenceFirst && wallStart && currentTool === 'wall' && (wallStart.x !== wallSequenceFirst.x || wallStart.y !== wallSequenceFirst.y)) {
      const fp = worldToScreen(wallSequenceFirst.x, wallSequenceFirst.y);
      const distToFirst = Math.hypot(mousePos.x - wallSequenceFirst.x, mousePos.y - wallSequenceFirst.y);
      const isNear = distToFirst < 20;
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, isNear ? 8 : 5, 0, Math.PI * 2);
      ctx.strokeStyle = isNear ? '#22c55e' : '#64748b';
      ctx.lineWidth = isNear ? 2.5 : 1.5;
      ctx.stroke();
      if (isNear) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fill();
      }
    }
    if (wallStart && currentTool === 'wall') {
      drawAngleGuides(wallStart);
      let endPt = magneticSnap(mousePos);
      endPt = angleSnap(wallStart, endPt);
      const s = worldToScreen(wallStart.x, wallStart.y);
      const e = worldToScreen(endPt.x, endPt.y);
      const dx = e.x - s.x, dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const thickness = Math.max(20 * zoom, 4);
        const nx = (-dy / len) * thickness / 2;
        const ny = (dx / len) * thickness / 2;
        ctx.fillStyle = '#3b82f620';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(s.x + nx, s.y + ny); ctx.lineTo(e.x + nx, e.y + ny);
        ctx.lineTo(e.x - nx, e.y - ny); ctx.lineTo(s.x - nx, s.y - ny);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      }
      const plen = Math.hypot(endPt.x - wallStart.x, endPt.y - wallStart.y);
      ctx.fillStyle = '#3b82f6';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(plen)} cm`, (s.x + e.x) / 2, (s.y + e.y) / 2 - 14);
      const angle = Math.atan2(endPt.y - wallStart.y, endPt.x - wallStart.x) * 180 / Math.PI;
      ctx.fillText(`${Math.round(angle)}°`, (s.x + e.x) / 2, (s.y + e.y) / 2 + 16);

      // Snap indicator — green ring when snapping to existing endpoint
      if ((endPt as any).snappedToEndpoint) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#22c55e40';
        ctx.fill();
      }
    }

    // Measurement
    if (measureStart && measuring) drawMeasurement();

    requestAnimationFrame(draw);
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    resize();
    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(canvas.parentElement!);
    requestAnimationFrame(draw);

    const unsub1 = activeFloor.subscribe((f) => { currentFloor = f; });
    const unsub2 = selectedElementId.subscribe((id) => { currentSelectedId = id; });
    const unsub3 = selectedRoomId.subscribe((id) => { currentSelectedRoomId = id; });
    const unsub4 = placingFurnitureId.subscribe((id) => { currentPlacingId = id; });
    const unsub5 = placingRotation.subscribe((r) => { currentPlacingRotation = r; });
    const unsub6 = selectedTool.subscribe((t) => { currentTool = t; });
    const unsub7 = detectedRoomsStore.subscribe((rooms) => { if (rooms.length > 0) detectedRooms = rooms; });

    return () => { resizeObs.disconnect(); unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
  });

  function zoomToFit() {
    if (!currentFloor || currentFloor.walls.length === 0) {
      camX = 0; camY = 0; zoom = 1;
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const w of currentFloor.walls) {
      for (const p of [w.start, w.end]) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    for (const fi of currentFloor.furniture) {
      const cat = getCatalogItem(fi.catalogId);
      if (!cat) continue;
      minX = Math.min(minX, fi.position.x - cat.width / 2);
      maxX = Math.max(maxX, fi.position.x + cat.width / 2);
      minY = Math.min(minY, fi.position.y - cat.depth / 2);
      maxY = Math.max(maxY, fi.position.y + cat.depth / 2);
    }
    const padding = 80;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    camX = (minX + maxX) / 2;
    camY = (minY + maxY) / 2;
    zoom = Math.min(width / contentW, height / contentH, 3);
    zoom = Math.max(zoom, 0.1);
  }

  function findWallAt(p: Point): Wall | null {
    if (!currentFloor) return null;
    for (const w of currentFloor.walls) {
      if (pointToSegmentDist(p, w.start, w.end) < 15 / zoom) return w;
    }
    return null;
  }

  function findHandleAt(p: Point): HandleType | null {
    if (!currentFloor || !currentSelectedId) return null;
    const fi = currentFloor.furniture.find(f => f.id === currentSelectedId);
    if (!fi) return null;
    const cat = getCatalogItem(fi.catalogId);
    if (!cat) return null;
    const dx = p.x - fi.position.x;
    const dy = p.y - fi.position.y;
    const angle = -(fi.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
    const hw = cat.width * (fi.scale?.x ?? 1) / 2;
    const hd = cat.depth * (fi.scale?.y ?? 1) / 2;
    const ht = 8 / zoom; // handle tolerance in world coords

    // Rotation handle (above the top)
    const rotHandleDist = 18 / zoom;
    if (Math.abs(rx) < ht && Math.abs(ry - (-hd - rotHandleDist)) < ht) return 'rotate';

    // Corner resize handles
    if (Math.abs(rx - (-hw)) < ht && Math.abs(ry - (-hd)) < ht) return 'resize-tl';
    if (Math.abs(rx - hw) < ht && Math.abs(ry - (-hd)) < ht) return 'resize-tr';
    if (Math.abs(rx - (-hw)) < ht && Math.abs(ry - hd) < ht) return 'resize-bl';
    if (Math.abs(rx - hw) < ht && Math.abs(ry - hd) < ht) return 'resize-br';

    return null;
  }

  function findFurnitureAt(p: Point): FurnitureItem | null {
    if (!currentFloor) return null;
    for (const fi of [...currentFloor.furniture].reverse()) {
      const cat = getCatalogItem(fi.catalogId);
      if (!cat) continue;
      const dx = p.x - fi.position.x;
      const dy = p.y - fi.position.y;
      const angle = -(fi.rotation * Math.PI) / 180;
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      const hw = cat.width * (fi.scale?.x ?? 1) / 2;
      const hd = cat.depth * (fi.scale?.y ?? 1) / 2;
      if (Math.abs(rx) < hw && Math.abs(ry) < hd) return fi;
    }
    return null;
  }

  function findDoorAt(p: Point): Door | null {
    if (!currentFloor) return null;
    for (const d of currentFloor.doors) {
      const wall = currentFloor.walls.find(w => w.id === d.wallId);
      if (!wall) continue;
      const t = d.position;
      const cx = wall.start.x + (wall.end.x - wall.start.x) * t;
      const cy = wall.start.y + (wall.end.y - wall.start.y) * t;
      if (Math.hypot(p.x - cx, p.y - cy) < (d.width / 2 + 5) / zoom) return d;
    }
    return null;
  }

  function findWindowAt(p: Point): Win | null {
    if (!currentFloor) return null;
    for (const w of currentFloor.windows) {
      const wall = currentFloor.walls.find(wl => wl.id === w.wallId);
      if (!wall) continue;
      const t = w.position;
      const cx = wall.start.x + (wall.end.x - wall.start.x) * t;
      const cy = wall.start.y + (wall.end.y - wall.start.y) * t;
      if (Math.hypot(p.x - cx, p.y - cy) < (w.width / 2 + 5) / zoom) return w;
    }
    return null;
  }

  function findRoomAt(p: Point): Room | null {
    if (!currentFloor) return null;
    for (const room of detectedRooms) {
      const poly = getRoomPolygon(room, currentFloor.walls);
      if (pointInPolygon(p, poly)) return room;
    }
    return null;
  }

  function pointInPolygon(p: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i].y > p.y) !== (poly[j].y > p.y) &&
          p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function pointToSegmentDist(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function positionOnWall(p: Point, w: Wall): number {
    const dx = w.end.x - w.start.x, dy = w.end.y - w.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return 0.5;
    return Math.max(0.1, Math.min(0.9, ((p.x - w.start.x) * dx + (p.y - w.start.y) * dy) / len2));
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      return;
    }
    if (e.button !== 0) return;

    const rect = canvas.getBoundingClientRect();
    const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const tool = currentTool;

    if (tool === 'furniture' && currentPlacingId) {
      const wallSnap = snapFurnitureToWall(wp, currentPlacingId, currentPlacingRotation);
      const pos = wallSnap ? wallSnap.position : { x: snap(wp.x), y: snap(wp.y) };
      const rot = wallSnap ? wallSnap.rotation : currentPlacingRotation;
      const id = addFurniture(currentPlacingId, pos);
      if (rot !== 0) {
        rotateFurniture(id, rot);
      }
      selectedElementId.set(id);
      return;
    }

    if (tool === 'wall') {
      let endPt = magneticSnap(wp);
      if (wallStart) endPt = angleSnap(wallStart, endPt);
      if (!wallStart) {
        wallStart = endPt;
        wallSequenceFirst = endPt;
      } else {
        // Auto-close: if clicking near the first point of the sequence, close the loop
        if (wallSequenceFirst && Math.hypot(endPt.x - wallSequenceFirst.x, endPt.y - wallSequenceFirst.y) < 20 && Math.hypot(wallStart.x - wallSequenceFirst.x, wallStart.y - wallSequenceFirst.y) > 20) {
          addWall(wallStart, wallSequenceFirst);
          wallStart = null;
          wallSequenceFirst = null;
        } else if (Math.hypot(endPt.x - wallStart.x, endPt.y - wallStart.y) > 5) {
          addWall(wallStart, endPt);
          wallStart = endPt;
        }
      }
    } else if (tool === 'select') {
      // Check wall endpoint handles first (drag-to-resize walls)
      if (currentSelectedId && currentFloor) {
        const selWall = currentFloor.walls.find(w => w.id === currentSelectedId);
        if (selWall) {
          const epThreshold = 15 / zoom;
          if (Math.hypot(wp.x - selWall.start.x, wp.y - selWall.start.y) < epThreshold) {
            draggingWallEndpoint = { wallId: selWall.id, endpoint: 'start' };
            commitFurnitureMove(); // uses same undo snapshot mechanism
            return;
          }
          if (Math.hypot(wp.x - selWall.end.x, wp.y - selWall.end.y) < epThreshold) {
            draggingWallEndpoint = { wallId: selWall.id, endpoint: 'end' };
            commitFurnitureMove();
            return;
          }
        }
      }

      // Check selection handles first (resize/rotate on selected furniture)
      const handle = findHandleAt(wp);
      if (handle && currentSelectedId && currentFloor) {
        const fi = currentFloor.furniture.find(f => f.id === currentSelectedId);
        if (fi) {
          draggingHandle = handle;
          handleDragStart = { ...wp };
          handleOrigScale = { x: fi.scale?.x ?? 1, y: fi.scale?.y ?? 1 };
          handleOrigRotation = fi.rotation;
          commitFurnitureMove(); // snapshot for undo
          return;
        }
      }
      // Check doors/windows first (they sit on walls, so check before walls)
      const door = findDoorAt(wp);
      if (door) {
        selectedElementId.set(door.id);
        selectedRoomId.set(null);
        draggingDoorId = door.id;
        return;
      }
      const win = findWindowAt(wp);
      if (win) {
        selectedElementId.set(win.id);
        selectedRoomId.set(null);
        draggingWindowId = win.id;
        return;
      }
      // Check furniture
      const fi = findFurnitureAt(wp);
      if (fi) {
        selectedElementId.set(fi.id);
        selectedRoomId.set(null);
        draggingFurnitureId = fi.id;
        commitFurnitureMove(); // snapshot before drag for undo
        dragOffset = { x: wp.x - fi.position.x, y: wp.y - fi.position.y };
        return;
      }
      const wall = findWallAt(wp);
      if (wall) {
        selectedElementId.set(wall.id);
        selectedRoomId.set(null);
      } else {
        const room = findRoomAt(wp);
        if (room) {
          selectedRoomId.set(room.id);
          selectedElementId.set(null);
        } else {
          selectedElementId.set(null);
          selectedRoomId.set(null);
        }
      }
    } else if (tool === 'door') {
      const wall = findWallAt(wp);
      if (wall) {
        addDoor(wall.id, positionOnWall(wp, wall));
        selectedTool.set('select');
      }
    } else if (tool === 'window') {
      const wall = findWallAt(wp);
      if (wall) {
        addWindow(wall.id, positionOnWall(wp, wall));
        selectedTool.set('select');
      }
    }
  }

  function onDblClick(e: MouseEvent) {
    if (currentTool === 'wall' && wallStart && wallSequenceFirst) {
      // Auto-close the wall loop back to the first point if we have at least 2 walls
      if (Math.hypot(wallStart.x - wallSequenceFirst.x, wallStart.y - wallSequenceFirst.y) > 5) {
        addWall(wallStart, wallSequenceFirst);
      }
      wallStart = null;
      wallSequenceFirst = null;
    }
  }

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    mousePos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (isPanning) {
      camX -= (e.clientX - panStartX) / zoom;
      camY -= (e.clientY - panStartY) / zoom;
      panStartX = e.clientX;
      panStartY = e.clientY;
    }
    if (draggingWallEndpoint) {
      let pt = magneticSnap(mousePos);
      // Angle snap to the opposite endpoint
      if (currentFloor) {
        const wall = currentFloor.walls.find(w => w.id === draggingWallEndpoint!.wallId);
        if (wall) {
          const other = draggingWallEndpoint.endpoint === 'start' ? wall.end : wall.start;
          pt = angleSnap(other, pt);
        }
      }
      moveWallEndpoint(draggingWallEndpoint.wallId, draggingWallEndpoint.endpoint, pt);
    }
    if (draggingHandle && currentSelectedId && currentFloor) {
      const fi = currentFloor.furniture.find(f => f.id === currentSelectedId);
      if (fi) {
        const cat = getCatalogItem(fi.catalogId);
        if (cat) {
          if (draggingHandle === 'rotate') {
            // Rotate based on angle from furniture center to mouse
            const dx = mousePos.x - fi.position.x;
            const dy = mousePos.y - fi.position.y;
            let angle = Math.atan2(dx, -dy) * 180 / Math.PI; // 0° = up
            // Snap to 15° increments
            angle = Math.round(angle / 15) * 15;
            setFurnitureRotation(currentSelectedId, ((angle % 360) + 360) % 360);
          } else {
            // Resize: compute delta in furniture-local coords
            const dx = mousePos.x - fi.position.x;
            const dy = mousePos.y - fi.position.y;
            const ang = -(fi.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(ang) - dy * Math.sin(ang);
            const localY = dx * Math.sin(ang) + dy * Math.cos(ang);
            // Scale based on corner position
            let newSx = Math.abs(localX * 2) / cat.width;
            let newSy = Math.abs(localY * 2) / cat.depth;
            newSx = Math.max(0.3, Math.round(newSx * 20) / 20); // snap to 0.05
            newSy = Math.max(0.3, Math.round(newSy * 20) / 20);
            scaleFurniture(currentSelectedId, { x: newSx, y: newSy });
          }
        }
      }
    }
    if (draggingFurnitureId) {
      const basePos = { x: mousePos.x - dragOffset.x, y: mousePos.y - dragOffset.y };
      const fi = currentFloor?.furniture.find(f => f.id === draggingFurnitureId);
      if (fi) {
        const wallSnap = snapFurnitureToWall(basePos, fi.catalogId, fi.rotation);
        if (wallSnap) {
          moveFurniture(draggingFurnitureId, wallSnap.position);
          setFurnitureRotation(draggingFurnitureId, wallSnap.rotation);
          wallSnapInfo = { wallId: wallSnap.wallId, side: wallSnap.side, wallAngle: wallSnap.wallAngle };
        } else {
          const snapped = { x: snap(basePos.x), y: snap(basePos.y) };
          moveFurniture(draggingFurnitureId, snapped);
          wallSnapInfo = null;
        }
      }
    }
    if (draggingDoorId && currentFloor) {
      const door = currentFloor.doors.find(d => d.id === draggingDoorId);
      if (door) {
        const wall = currentFloor.walls.find(w => w.id === door.wallId);
        if (wall) {
          const newPos = positionOnWall(mousePos, wall);
          updateDoor(door.id, { position: newPos });
        }
      }
    }
    if (draggingWindowId && currentFloor) {
      const win = currentFloor.windows.find(w => w.id === draggingWindowId);
      if (win) {
        const wall = currentFloor.walls.find(w => w.id === win.wallId);
        if (wall) {
          const newPos = positionOnWall(mousePos, wall);
          updateWindow(win.id, { position: newPos });
        }
      }
    }
    if (measuring && measureStart) {
      measureEnd = { ...mousePos };
    }
  }

  function onMouseUp() {
    isPanning = false;
    if (draggingFurnitureId) commitFurnitureMove();
    if (draggingHandle) commitFurnitureMove();
    if (draggingWallEndpoint) commitFurnitureMove();
    draggingFurnitureId = null;
    draggingDoorId = null;
    draggingWindowId = null;
    draggingHandle = null;
    draggingWallEndpoint = null;
    wallSnapInfo = null;
    if (measuring && measureStart && measureEnd) {
      // Keep measurement visible until next click
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (currentPlacingId) {
      // Rotate furniture preview
      const delta = e.deltaY > 0 ? 15 : -15;
      placingRotation.update(r => (r + delta) % 360);
      return;
    }
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.1, Math.min(10, zoom * factor));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') { spaceDown = true; e.preventDefault(); return; }

    // Global shortcuts
    const handled = handleGlobalShortcut(e, {
      rotateFurniture: () => {
        if (currentPlacingId) {
          placingRotation.update(r => (r + 15) % 360);
        } else if (currentSelectedId && currentFloor) {
          const fi = currentFloor.furniture.find(f => f.id === currentSelectedId);
          if (fi) rotateFurniture(fi.id, 15);
        }
      }
    });
    if (handled) return;

    if (e.key === 'g' || e.key === 'G') {
      showGrid = !showGrid;
    }
    if (e.key === 'm' || e.key === 'M') {
      measuring = !measuring;
      if (!measuring) { measureStart = null; measureEnd = null; }
    }
    if (e.key === 'f' || e.key === 'F') {
      zoomToFit();
    }
    // 'C' to close wall loop back to first point
    if ((e.key === 'c' || e.key === 'C') && wallStart && wallSequenceFirst) {
      if (Math.hypot(wallStart.x - wallSequenceFirst.x, wallStart.y - wallSequenceFirst.y) > 5) {
        addWall(wallStart, wallSequenceFirst);
        wallStart = null;
        wallSequenceFirst = null;
      }
    }
    if (e.code === 'Escape') {
      wallStart = null; wallSequenceFirst = null;
      placingFurnitureId.set(null);
      placingRotation.set(0);
      measuring = false;
      measureStart = null;
      measureEnd = null;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') spaceDown = false;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    // Right-click starts/ends measurement
    const rect = canvas.getBoundingClientRect();
    const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (!measureStart || measureEnd) {
      measureStart = wp;
      measureEnd = null;
      measuring = true;
    } else {
      measureEnd = wp;
    }
  }

  let cursorStyle = $derived(
    spaceDown || isPanning ? 'grab' :
    draggingWallEndpoint ? 'crosshair' :
    draggingHandle === 'rotate' ? 'grabbing' :
    draggingHandle?.startsWith('resize') ? 'nwse-resize' :
    currentTool === 'select' ? 'default' :
    currentTool === 'furniture' ? 'copy' :
    'crosshair'
  );
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<div class="w-full h-full relative overflow-hidden" role="application">
  <canvas
    bind:this={canvas}
    class="block w-full h-full"
    style="cursor: {cursorStyle}"
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onmouseup={onMouseUp}
    ondblclick={onDblClick}
    onwheel={onWheel}
    oncontextmenu={onContextMenu}
  ></canvas>
  <div class="absolute bottom-2 right-2 bg-white/80 rounded px-2 py-1 text-xs text-gray-500 flex gap-3">
    {#if detectedRooms.length > 0}
      <span>{detectedRooms.length} room{detectedRooms.length !== 1 ? 's' : ''}</span>
      <span>{detectedRooms.reduce((s, r) => s + r.area, 0).toFixed(1)} m²</span>
      <span class="text-gray-300">|</span>
    {/if}
    {#if currentFloor}
      <span>{currentFloor.walls.length} wall{currentFloor.walls.length !== 1 ? 's' : ''}</span>
      <span class="text-gray-300">|</span>
    {/if}
    <span>Zoom: {Math.round(zoom * 100)}%</span>
    <button class="hover:text-gray-700" onclick={() => zoomToFit()} title="Zoom to Fit (F)">⊞ Fit</button>
    <button class="hover:text-gray-700" onclick={() => showGrid = !showGrid} title="Toggle Grid (G)">
      {showGrid ? '▦' : '▢'} Grid
    </button>
  </div>
  {#if currentTool === 'wall' && wallStart}
    <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs shadow">
      Click to add wall segment · Double-click to finish · C to close loop · Esc to cancel
    </div>
  {/if}
  {#if currentPlacingId && currentTool === 'furniture'}
    <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3 py-1 rounded-full text-xs shadow">
      Click to place · Scroll or R to rotate ({currentPlacingRotation}°) · Esc to cancel
    </div>
  {/if}
  {#if measuring}
    <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs shadow">
      Right-click two points to measure · M to exit · Esc to cancel
    </div>
  {/if}
</div>
