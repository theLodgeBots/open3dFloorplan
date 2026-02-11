<script lang="ts">
  import { onMount } from 'svelte';
  import { activeFloor, selectedTool, selectedElementId, selectedRoomId, addWall, addDoor, addWindow, addFurniture, moveFurniture, rotateFurniture, removeElement, placingFurnitureId, placingRotation } from '$lib/stores/project';
  import type { Point, Wall, Door, Window as Win, FurnitureItem } from '$lib/models/types';
  import type { Floor, Room } from '$lib/models/types';
  import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { getMaterial } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
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

  // Store subscriptions
  let currentFloor: Floor | null = $state(null);
  let currentSelectedId: string | null = $state(null);
  let currentSelectedRoomId: string | null = $state(null);
  let currentPlacingId: string | null = $state(null);
  let currentPlacingRotation: number = $state(0);
  let currentTool: string = $state('select');

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
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    const offX = (width / 2 - camX * zoom) % step;
    const offY = (height / 2 - camY * zoom) % step;
    for (let x = offX; x < width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = offY; y < height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  function wallLength(w: Wall): number {
    return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
  }

  function drawWall(w: Wall, selected: boolean) {
    const s = worldToScreen(w.start.x, w.start.y);
    const e = worldToScreen(w.end.x, w.end.y);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const thickness = Math.max(w.thickness * zoom * 0.15, 3);
    const nx = (-dy / len) * thickness / 2;
    const ny = (dx / len) * thickness / 2;

    // Drop shadow for depth
    if (!selected) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 4 * zoom;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    ctx.fillStyle = selected ? '#93c5fd' : '#4b5563';
    ctx.strokeStyle = selected ? '#3b82f6' : '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x + nx, s.y + ny);
    ctx.lineTo(e.x + nx, e.y + ny);
    ctx.lineTo(e.x - nx, e.y - ny);
    ctx.lineTo(s.x - nx, s.y - ny);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (!selected) ctx.restore();

    // Endpoint circles
    ctx.fillStyle = selected ? '#3b82f6' : '#9ca3af';
    for (const p of [s, e]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, thickness / 2 + 1), 0, Math.PI * 2);
      ctx.fill();
    }

    // Dimension with arrowheads
    const wlen = wallLength(w);
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    const offsetDist = thickness / 2 + 14;
    const nnx = (-dy / len);
    const nny = (dx / len);
    const dimX = mx + nnx * offsetDist;
    const dimY = my + nny * offsetDist;

    // Dimension line with arrows
    const ds = { x: s.x + nnx * offsetDist, y: s.y + nny * offsetDist };
    const de = { x: e.x + nnx * offsetDist, y: e.y + nny * offsetDist };
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ds.x, ds.y); ctx.lineTo(de.x, de.y);
    ctx.stroke();
    // Arrowheads
    const arrowSize = 5;
    const ux = dx / len, uy = dy / len;
    for (const [pt, dir] of [[ds, 1], [de, -1]] as [typeof ds, number][]) {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + (ux * dir + nnx * 0.5) * arrowSize, pt.y + (uy * dir + nny * 0.5) * arrowSize);
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + (ux * dir - nnx * 0.5) * arrowSize, pt.y + (uy * dir - nny * 0.5) * arrowSize);
      ctx.stroke();
    }

    ctx.fillStyle = '#374151';
    ctx.font = `${Math.max(10, 11 * zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(wlen)} cm`, dimX, dimY);
  }

  function drawDoorOnWall(wall: Wall, door: Door) {
    const t = door.position;
    const wx = wall.start.x + (wall.end.x - wall.start.x) * t;
    const wy = wall.start.y + (wall.end.y - wall.start.y) * t;
    const s = worldToScreen(wx, wy);
    const r = Math.max(door.width * 0.5 * zoom * 0.15, 6);

    const wallAngle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
    const swingDir = door.swingDirection === 'left' ? 1 : -1;
    const startAngle = wallAngle + (swingDir === 1 ? -Math.PI / 2 : 0);
    const endAngle = startAngle + Math.PI / 2;

    // Clear wall area for door gap
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    const thickness = Math.max(wall.thickness * zoom * 0.15, 3);
    const nx = (-dy / len) * thickness / 2;
    const ny = (dx / len) * thickness / 2;
    ctx.fillStyle = '#fafafa';
    const hw = r;
    const ux = (dx / len) * hw;
    const uy = (dy / len) * hw;
    ctx.beginPath();
    ctx.moveTo(s.x - ux + nx, s.y - uy + ny);
    ctx.lineTo(s.x + ux + nx, s.y + uy + ny);
    ctx.lineTo(s.x + ux - nx, s.y + uy - ny);
    ctx.lineTo(s.x - ux - nx, s.y - uy - ny);
    ctx.closePath();
    ctx.fill();

    // Door arc (quarter circle)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, startAngle, endAngle);
    ctx.stroke();
    ctx.setLineDash([]);

    // Door panel line
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + r * Math.cos(endAngle), s.y + r * Math.sin(endAngle));
    ctx.stroke();

    // Hinge dot
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
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

    const hw = Math.max(win.width * 0.5 * zoom * 0.15, 6);
    const gap = Math.max(3, 4 * zoom * 0.15);

    // Two parallel lines with gap (architectural window symbol)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    // Line 1
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw + nx * gap, s.y - uy * hw + ny * gap);
    ctx.lineTo(s.x + ux * hw + nx * gap, s.y + uy * hw + ny * gap);
    ctx.stroke();
    // Line 2
    ctx.beginPath();
    ctx.moveTo(s.x - ux * hw - nx * gap, s.y - uy * hw - ny * gap);
    ctx.lineTo(s.x + ux * hw - nx * gap, s.y + uy * hw - ny * gap);
    ctx.stroke();
    // Connecting lines at ends
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
    const w = cat.width * zoom * 0.15;
    const d = cat.depth * zoom * 0.15;
    const angle = (item.rotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    // Rectangle
    ctx.fillStyle = cat.color + '60';
    ctx.strokeStyle = selected ? '#3b82f6' : cat.color;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.strokeRect(-w / 2, -d / 2, w, d);

    // Label
    ctx.fillStyle = '#374151';
    const fontSize = Math.max(8, Math.min(12, w * 0.3));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.icon, 0, -fontSize * 0.4);
    ctx.font = `${fontSize * 0.7}px sans-serif`;
    ctx.fillText(cat.name, 0, fontSize * 0.5);

    // Rotation handle when selected
    if (selected) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, -d / 2 - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -d / 2);
      ctx.lineTo(0, -d / 2 - 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFurniturePreview() {
    if (!currentPlacingId) return;
    const cat = getCatalogItem(currentPlacingId);
    if (!cat) return;
    const s = worldToScreen(mousePos.x, mousePos.y);
    const w = cat.width * zoom * 0.15;
    const d = cat.depth * zoom * 0.15;
    const angle = (currentPlacingRotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = cat.color + '60';
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    ctx.setLineDash([]);
    ctx.fillStyle = '#374151';
    ctx.font = `${Math.max(8, w * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.icon, 0, 0);
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

  const ROOM_FILLS = [
    'rgba(167, 139, 250, 0.18)', // violet
    'rgba(96, 165, 250, 0.18)',  // blue
    'rgba(52, 211, 153, 0.18)',  // green
    'rgba(251, 191, 36, 0.18)',  // amber
    'rgba(248, 113, 113, 0.18)', // red
    'rgba(244, 114, 182, 0.18)', // pink
    'rgba(45, 212, 191, 0.18)',  // teal
    'rgba(251, 146, 60, 0.18)',  // orange
  ];

  function drawRooms() {
    if (!currentFloor) return;
    for (let ri = 0; ri < detectedRooms.length; ri++) {
      const room = detectedRooms[ri];
      const poly = getRoomPolygon(room, currentFloor.walls);
      if (poly.length < 3) continue;
      const screenPoly = poly.map(p => worldToScreen(p.x, p.y));
      ctx.fillStyle = ROOM_FILLS[ri % ROOM_FILLS.length];
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
      ctx.fillStyle = '#374151';
      ctx.font = `bold ${Math.max(11, 13 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, sc.x, sc.y - 8 * zoom);
      ctx.font = `${Math.max(9, 11 * zoom)}px sans-serif`;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`${room.area} m²`, sc.x, sc.y + 10 * zoom);
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
    detectedRooms = detectRooms(currentFloor.walls);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);
    drawGrid();

    const floor = currentFloor;
    if (!floor) { requestAnimationFrame(draw); return; }

    updateDetectedRooms();
    const selId = currentSelectedId;

    drawRooms();
    drawSnapPoints();

    for (const w of floor.walls) drawWall(w, w.id === selId);
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
        const thickness = Math.max(15 * zoom * 0.15, 3);
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

    return () => { resizeObs.disconnect(); unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  });

  function findWallAt(p: Point): Wall | null {
    if (!currentFloor) return null;
    for (const w of currentFloor.walls) {
      if (pointToSegmentDist(p, w.start, w.end) < 15 / zoom) return w;
    }
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
      if (Math.abs(rx) < cat.width / 2 && Math.abs(ry) < cat.depth / 2) return fi;
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
      const snapped = { x: snap(wp.x), y: snap(wp.y) };
      const id = addFurniture(currentPlacingId, snapped);
      // Apply rotation
      if (currentPlacingRotation !== 0) {
        rotateFurniture(id, currentPlacingRotation);
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
      // Check furniture first
      const fi = findFurnitureAt(wp);
      if (fi) {
        selectedElementId.set(fi.id);
        selectedRoomId.set(null);
        draggingFurnitureId = fi.id;
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
    if (currentTool === 'wall' && wallStart) { wallStart = null; wallSequenceFirst = null; }
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
    if (draggingFurnitureId) {
      const snapped = { x: snap(mousePos.x - dragOffset.x), y: snap(mousePos.y - dragOffset.y) };
      moveFurniture(draggingFurnitureId, snapped);
    }
    if (measuring && measureStart) {
      measureEnd = { ...mousePos };
    }
  }

  function onMouseUp() {
    isPanning = false;
    draggingFurnitureId = null;
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
    <button class="hover:text-gray-700" onclick={() => showGrid = !showGrid} title="Toggle Grid (G)">
      {showGrid ? '▦' : '▢'} Grid
    </button>
  </div>
  {#if currentTool === 'wall' && wallStart}
    <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs shadow">
      Click to add wall segment · Double-click to finish · Esc to cancel
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
