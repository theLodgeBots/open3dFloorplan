<script lang="ts">
  import { onMount } from 'svelte';
  import { activeFloor, selectedTool, selectedElementId, selectedElementIds, selectedRoomId, addWall, addDoor, addWindow, updateWall, moveWallEndpoint, updateDoor, updateWindow, addFurniture, moveFurniture, commitFurnitureMove, rotateFurniture, setFurnitureRotation, scaleFurniture, removeElement, placingFurnitureId, placingRotation, placingDoorType, placingWindowType, detectedRoomsStore, duplicateDoor, duplicateWindow, duplicateFurniture, duplicateWall, moveWallParallel, splitWall, snapEnabled, placingStair, addStair, moveStair, updateStair, calibrationMode, calibrationPoints, updateBackgroundImage } from '$lib/stores/project';
  import type { Point, Wall, Door, Window as Win, FurnitureItem, Stair } from '$lib/models/types';
  import type { Floor, Room } from '$lib/models/types';
  import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { getMaterial } from '$lib/utils/materials';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { drawFurnitureIcon } from '$lib/utils/furnitureIcons';
  import { handleGlobalShortcut } from '$lib/utils/shortcuts';
  import { getWallTextureCanvas, setTextureLoadCallback } from '$lib/utils/textureGenerator';

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

  // Ruler toggle
  let showRulers = $state(true);
  const RULER_SIZE = 24;

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
  let currentDoorType: Door['type'] = $state('single');
  let currentWindowType: Win['type'] = $state('standard');
  let currentSnapEnabled: boolean = $state(true);
  let isPlacingStair: boolean = $state(false);
  let draggingStairId: string | null = $state(null);
  let stairDragOffset: Point = { x: 0, y: 0 };
  let isCalibrating: boolean = $state(false);
  let calPoints: Point[] = $state([]);
  let bgImage: HTMLImageElement | null = $state(null);

  // Wall endpoint drag state (includes all connected walls at the corner)
  let draggingWallEndpoint: { wallId: string; endpoint: 'start' | 'end' } | null = $state(null);
  let draggingConnectedEndpoints: { wallId: string; endpoint: 'start' | 'end' }[] = $state([]);

  // Resize/rotate handle drag state
  type HandleType = 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'rotate';
  let draggingHandle: HandleType | null = $state(null);
  let handleDragStart: Point = { x: 0, y: 0 };
  let handleOrigScale: { x: number; y: number } = { x: 1, y: 1 };
  let handleOrigRotation: number = 0;

  // Wall parallel drag state (drag midpoint to move wall parallel)
  let draggingWallParallel: { wallId: string; startMousePos: Point; origStart: Point; origEnd: Point; origCurve?: Point; connectedStart: { wallId: string; endpoint: 'start' | 'end' }[]; connectedEnd: { wallId: string; endpoint: 'start' | 'end' }[] } | null = $state(null);

  // Curve handle drag state
  let draggingCurveHandle: string | null = $state(null); // wallId being curved

  // Wall snap state for visual feedback
  let wallSnapInfo: { wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null = $state(null);

  // Door/window placement preview state
  let placementPreview: { wallId: string; position: number; type: 'door' | 'window' } | null = $state(null);

  // Marquee (drag-to-select) state
  let marqueeStart: Point | null = $state(null);
  let marqueeEnd: Point | null = $state(null);
  let currentSelectedIds: Set<string> = $state(new Set());

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
    if (!currentSnapEnabled) return v;
    return Math.round(v / SNAP) * SNAP;
  }

  function screenToWorld(sx: number, sy: number): Point {
    return { x: (sx - width / 2) / zoom + camX, y: (sy - height / 2) / zoom + camY };
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - camX) * zoom + width / 2, y: (wy - camY) * zoom + height / 2 };
  }

  /** Find all other wall endpoints that share the same point (within tolerance) */
  function findConnectedEndpoints(pt: Point, excludeWallId: string): { wallId: string; endpoint: 'start' | 'end' }[] {
    const tolerance = 2;
    const results: { wallId: string; endpoint: 'start' | 'end' }[] = [];
    if (!currentFloor) return results;
    for (const w of currentFloor.walls) {
      if (w.id === excludeWallId) continue;
      if (Math.hypot(w.start.x - pt.x, w.start.y - pt.y) < tolerance) {
        results.push({ wallId: w.id, endpoint: 'start' });
      }
      if (Math.hypot(w.end.x - pt.x, w.end.y - pt.y) < tolerance) {
        results.push({ wallId: w.id, endpoint: 'end' });
      }
    }
    return results;
  }

  function magneticSnap(p: Point, excludeWallIds?: Set<string>): Point & { snappedToEndpoint?: boolean } {
    if (!currentFloor) return { x: snap(p.x), y: snap(p.y) };
    let best: Point & { snappedToEndpoint?: boolean } = { x: snap(p.x), y: snap(p.y) };
    let bestDist = MAGNETIC_SNAP / zoom;
    for (const w of currentFloor.walls) {
      if (excludeWallIds && excludeWallIds.has(w.id)) continue;
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
    if (!currentSnapEnabled) return end;
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
    if (w.curvePoint) {
      // Approximate quadratic bezier length with 20 segments
      let len = 0;
      const N = 20;
      let px = w.start.x, py = w.start.y;
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        const mt = 1 - t;
        const nx = mt * mt * w.start.x + 2 * mt * t * w.curvePoint.x + t * t * w.end.x;
        const ny = mt * mt * w.start.y + 2 * mt * t * w.curvePoint.y + t * t * w.end.y;
        len += Math.hypot(nx - px, ny - py);
        px = nx; py = ny;
      }
      return len;
    }
    return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
  }

  /** Get point on wall at parameter t (0-1), handling curves */
  function wallPointAt(w: Wall, t: number): Point {
    if (w.curvePoint) {
      const mt = 1 - t;
      return {
        x: mt * mt * w.start.x + 2 * mt * t * w.curvePoint.x + t * t * w.end.x,
        y: mt * mt * w.start.y + 2 * mt * t * w.curvePoint.y + t * t * w.end.y,
      };
    }
    return {
      x: w.start.x + (w.end.x - w.start.x) * t,
      y: w.start.y + (w.end.y - w.start.y) * t,
    };
  }

  /** Get tangent direction at parameter t on wall */
  function wallTangentAt(w: Wall, t: number): Point {
    if (w.curvePoint) {
      const mt = 1 - t;
      const dx = 2 * mt * (w.curvePoint.x - w.start.x) + 2 * t * (w.end.x - w.curvePoint.x);
      const dy = 2 * mt * (w.curvePoint.y - w.start.y) + 2 * t * (w.end.y - w.curvePoint.y);
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    }
    const dx = w.end.x - w.start.x;
    const dy = w.end.y - w.start.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function wallThicknessScreen(w: Wall): number {
    return Math.max(w.thickness * zoom, 4);
  }

  /** Draw distance dimensions from door center to wall endpoints when door is selected */
  function drawDoorDistanceDimensions(wall: Wall, door: Door) {
    const wLength = wallLength(wall);
    if (wLength < 10) return; // skip tiny walls
    
    // Calculate distances from door center to wall endpoints (in cm)
    const distFromA = wLength * door.position;
    const distFromB = wLength * (1 - door.position);
    
    // Get door center position
    const doorCenter = wallPointAt(wall, door.position);
    const dcScreen = worldToScreen(doorCenter.x, doorCenter.y);
    
    // Get wall endpoints
    const wallStartScreen = worldToScreen(wall.start.x, wall.start.y);
    const wallEndScreen = worldToScreen(wall.end.x, wall.end.y);
    
    // Draw thin lines from door center to each endpoint
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.moveTo(dcScreen.x, dcScreen.y);
    ctx.lineTo(wallStartScreen.x, wallStartScreen.y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(dcScreen.x, dcScreen.y);
    ctx.lineTo(wallEndScreen.x, wallEndScreen.y);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Draw green pill dimension labels
    const fontSize = Math.max(10, 11 * zoom);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Distance to start point (A)
    const midPointA = {
      x: (dcScreen.x + wallStartScreen.x) / 2,
      y: (dcScreen.y + wallStartScreen.y) / 2
    };
    const labelTextA = `${(distFromA / 100).toFixed(2)} m`;
    const textWidthA = ctx.measureText(labelTextA).width;
    const pillWidthA = textWidthA + 12;
    const pillHeightA = fontSize + 6;
    
    // Green pill background
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(midPointA.x - pillWidthA / 2, midPointA.y - pillHeightA / 2, pillWidthA, pillHeightA, pillHeightA / 2);
    ctx.fill();
    
    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelTextA, midPointA.x, midPointA.y);
    
    // Distance to end point (B)
    const midPointB = {
      x: (dcScreen.x + wallEndScreen.x) / 2,
      y: (dcScreen.y + wallEndScreen.y) / 2
    };
    const labelTextB = `${(distFromB / 100).toFixed(2)} m`;
    const textWidthB = ctx.measureText(labelTextB).width;
    const pillWidthB = textWidthB + 12;
    const pillHeightB = fontSize + 6;
    
    // Green pill background
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(midPointB.x - pillWidthB / 2, midPointB.y - pillHeightB / 2, pillWidthB, pillHeightB, pillHeightB / 2);
    ctx.fill();
    
    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelTextB, midPointB.x, midPointB.y);
  }

  /** Draw distance dimensions from window center to wall endpoints when window is selected */
  function drawWindowDistanceDimensions(wall: Wall, window: Win) {
    const wLength = wallLength(wall);
    if (wLength < 10) return; // skip tiny walls
    
    // Calculate distances from window center to wall endpoints (in cm)
    const distFromA = wLength * window.position;
    const distFromB = wLength * (1 - window.position);
    
    // Get window center position
    const windowCenter = wallPointAt(wall, window.position);
    const wcScreen = worldToScreen(windowCenter.x, windowCenter.y);
    
    // Get wall endpoints
    const wallStartScreen = worldToScreen(wall.start.x, wall.start.y);
    const wallEndScreen = worldToScreen(wall.end.x, wall.end.y);
    
    // Draw thin lines from window center to each endpoint
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.moveTo(wcScreen.x, wcScreen.y);
    ctx.lineTo(wallStartScreen.x, wallStartScreen.y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(wcScreen.x, wcScreen.y);
    ctx.lineTo(wallEndScreen.x, wallEndScreen.y);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Draw green pill dimension labels
    const fontSize = Math.max(10, 11 * zoom);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Distance to start point (A)
    const midPointA = {
      x: (wcScreen.x + wallStartScreen.x) / 2,
      y: (wcScreen.y + wallStartScreen.y) / 2
    };
    const labelTextA = `${(distFromA / 100).toFixed(2)} m`;
    const textWidthA = ctx.measureText(labelTextA).width;
    const pillWidthA = textWidthA + 12;
    const pillHeightA = fontSize + 6;
    
    // Green pill background
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(midPointA.x - pillWidthA / 2, midPointA.y - pillHeightA / 2, pillWidthA, pillHeightA, pillHeightA / 2);
    ctx.fill();
    
    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelTextA, midPointA.x, midPointA.y);
    
    // Distance to end point (B)
    const midPointB = {
      x: (wcScreen.x + wallEndScreen.x) / 2,
      y: (wcScreen.y + wallEndScreen.y) / 2
    };
    const labelTextB = `${(distFromB / 100).toFixed(2)} m`;
    const textWidthB = ctx.measureText(labelTextB).width;
    const pillWidthB = textWidthB + 12;
    const pillHeightB = fontSize + 6;
    
    // Green pill background
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(midPointB.x - pillWidthB / 2, midPointB.y - pillHeightB / 2, pillWidthB, pillHeightB, pillHeightB / 2);
    ctx.fill();
    
    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelTextB, midPointB.x, midPointB.y);
  }

  function drawWall(w: Wall, selected: boolean) {
    const s = worldToScreen(w.start.x, w.start.y);
    const e = worldToScreen(w.end.x, w.end.y);
    const thickness = wallThicknessScreen(w);

    if (w.curvePoint) {
      // Draw curved wall as thick bezier path
      const cp = worldToScreen(w.curvePoint.x, w.curvePoint.y);
      const SEGS = 24;
      const outerPts: { x: number; y: number }[] = [];
      const innerPts: { x: number; y: number }[] = [];

      for (let i = 0; i <= SEGS; i++) {
        const t = i / SEGS;
        const mt = 1 - t;
        const px = mt * mt * s.x + 2 * mt * t * cp.x + t * t * e.x;
        const py = mt * mt * s.y + 2 * mt * t * cp.y + t * t * e.y;
        // Tangent
        const tdx = 2 * mt * (cp.x - s.x) + 2 * t * (e.x - cp.x);
        const tdy = 2 * mt * (cp.y - s.y) + 2 * t * (e.y - cp.y);
        const tlen = Math.hypot(tdx, tdy) || 1;
        const nx = (-tdy / tlen) * thickness / 2;
        const ny = (tdx / tlen) * thickness / 2;
        outerPts.push({ x: px + nx, y: py + ny });
        innerPts.push({ x: px - nx, y: py - ny });
      }

      ctx.fillStyle = selected ? '#93c5fd' : '#404040';
      ctx.strokeStyle = selected ? '#3b82f6' : '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
      for (let i = innerPts.length - 1; i >= 0; i--) ctx.lineTo(innerPts[i].x, innerPts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dimension label for curved wall (arc length)
      const wlen = wallLength(w);
      if (wlen >= 10) {
        const midPt = wallPointAt(w, 0.5);
        const midS = worldToScreen(midPt.x, midPt.y);
        const midTan = wallTangentAt(w, 0.5);
        const offsetDist = thickness / 2 + 16;
        ctx.fillStyle = '#374151';
        const fontSize = Math.max(10, 11 * zoom);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(wlen / 100).toFixed(2)} m`, midS.x - midTan.y * offsetDist, midS.y + midTan.x * offsetDist);
      }

      // Curve handle (midpoint) and endpoint handles when selected
      if (selected) {
        const handleSize = 5;
        // Endpoint handles
        for (const pt of [s, e]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, handleSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        // Curve control point handle (diamond shape)
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        const sz = 6;
        ctx.beginPath();
        ctx.moveTo(cp.x, cp.y - sz);
        ctx.lineTo(cp.x + sz, cp.y);
        ctx.lineTo(cp.x, cp.y + sz);
        ctx.lineTo(cp.x - sz, cp.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Dashed guide lines from curve point to endpoints
        ctx.strokeStyle = '#d9770680';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(cp.x, cp.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }

    // Straight wall
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

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

    // Wall texture pattern overlay
    if (w.texture) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(e.x + nx, e.y + ny);
      ctx.lineTo(e.x - nx, e.y - ny);
      ctx.lineTo(s.x - nx, s.y - ny);
      ctx.closePath();
      ctx.clip();

      const texCanvas = getWallTextureCanvas(w.texture, w.color);
      if (texCanvas) {
        // Use the high-res texture as a pattern
        const scale = zoom * 0.25; // scale texture to match zoom
        ctx.globalAlpha = 0.6;
        const angle = Math.atan2(dy, dx);
        const cxp = (s.x + e.x) / 2;
        const cyp = (s.y + e.y) / 2;
        ctx.translate(cxp, cyp);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        const pat = ctx.createPattern(texCanvas, 'repeat');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(-len / 2 / scale, -thickness / 2 / scale, len / scale, thickness / scale);
        }
      }
      ctx.restore();
    }

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
      // Midpoint handle — square for parallel drag (Alt+drag to curve)
      const midX = (s.x + e.x) / 2;
      const midY = (s.y + e.y) / 2;
      const sz = 5;
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(midX - sz, midY - sz, sz * 2, sz * 2);
      ctx.strokeRect(midX - sz, midY - sz, sz * 2, sz * 2);
      // Draw perpendicular arrows to indicate parallel drag direction
      const perpX = -(dy / len) * 12;
      const perpY = (dx / len) * 12;
      ctx.strokeStyle = '#3b82f680';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX - perpX, midY - perpY);
      ctx.lineTo(midX + perpX, midY + perpY);
      ctx.stroke();
      // Small arrowheads
      const arrowSz = 3;
      for (const sign of [1, -1]) {
        const ax = midX + perpX * sign;
        const ay = midY + perpY * sign;
        const adx = perpX / 12 * arrowSz * sign;
        const ady = perpY / 12 * arrowSz * sign;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - adx + ady * 0.5, ay - ady - adx * 0.5);
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - adx - ady * 0.5, ay - ady + adx * 0.5);
        ctx.stroke();
      }
    }
  }

  function drawDoorOnWall(wall: Wall, door: Door) {
    const t = door.position;
    const wpt = wallPointAt(wall, t);
    const s = worldToScreen(wpt.x, wpt.y);

    const tan = wallTangentAt(wall, t);
    const ux = tan.x, uy = tan.y;
    const nx = -uy, ny = ux;

    const halfDoor = (door.width / 2) * zoom;
    const thickness = wallThicknessScreen(wall);
    const wallAngle = Math.atan2(uy, ux);
    const swingDir = door.swingDirection === 'left' ? 1 : -1;
    const sideFlip = (door.flipSide ?? false) ? -1 : 1;

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

    // Door jamb ticks (for all types)
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

    const doorType = door.type || 'single';

    if (doorType === 'single' || doorType === 'pocket') {
      // Single swing door / pocket door
      // swingDir: left=-1 means hinge on left jamb, right=+1 means hinge on right jamb
      // sideFlip: +1 = inward (normal side), -1 = outward (opposite side of wall)
      const r = door.width * zoom;
      // Hinge at left or right jamb of the door gap
      const hingeX = s.x + ux * halfDoor * swingDir;
      const hingeY = s.y + uy * halfDoor * swingDir;
      // Arc swings from wall direction toward perpendicular (inward or outward)
      const startAngle = wallAngle + (swingDir === 1 ? Math.PI : 0);
      const endAngle = startAngle + (-swingDir) * sideFlip * (Math.PI / 2);

      if (doorType === 'pocket') {
        // Pocket: dashed line showing door recessed into wall
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hingeX, hingeY);
        ctx.lineTo(hingeX + ux * halfDoor * 2 * swingDir, hingeY + uy * halfDoor * 2 * swingDir);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Swing arc
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hingeX, hingeY, r, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
        ctx.stroke();
      }

      // Door panel line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(hingeX, hingeY);
      const panelAngle = doorType === 'pocket' ? startAngle : endAngle;
      ctx.lineTo(hingeX + r * Math.cos(panelAngle), hingeY + r * Math.sin(panelAngle));
      ctx.stroke();

      // Hinge dot
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(hingeX, hingeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (doorType === 'double' || doorType === 'french') {
      // Double/French: two swing arcs from each side
      const r = halfDoor;
      for (const side of [-1, 1] as const) {
        const hx = s.x + ux * halfDoor * side;
        const hy = s.y + uy * halfDoor * side;
        const arcSwing = side === -1 ? swingDir : -swingDir;
        const sa = wallAngle + Math.PI * (side === 1 ? 1 : 0);
        const ea = sa + arcSwing * sideFlip * (Math.PI / 2);

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, r, Math.min(sa, ea), Math.max(sa, ea));
        ctx.stroke();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + r * Math.cos(ea), hy + r * Math.sin(ea));
        ctx.stroke();

        // Hinge dot
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(hx, hy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (doorType === 'french') {
        // Glass panes: small X marks on each panel
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 0.5;
      }

    } else if (doorType === 'sliding') {
      // Sliding: two overlapping panels with arrow
      const panelW = halfDoor * 0.9;
      const offset = thickness * 0.15 * sideFlip;
      // Panel 1 (fixed)
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - ux * halfDoor, s.y - uy * halfDoor);
      ctx.lineTo(s.x + ux * panelW * 0.1, s.y + uy * panelW * 0.1);
      ctx.stroke();
      // Panel 2 (sliding) slightly offset perpendicular
      ctx.beginPath();
      ctx.moveTo(s.x - ux * panelW * 0.1 + nx * offset, s.y - uy * panelW * 0.1 + ny * offset);
      ctx.lineTo(s.x + ux * halfDoor + nx * offset, s.y + uy * halfDoor + ny * offset);
      ctx.stroke();
      // Arrow showing slide direction
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      const arrowY = ny * (thickness * 0.4);
      const arrowX = nx * (thickness * 0.4);
      const ax = s.x - arrowX;
      const ay = s.y - arrowY;
      ctx.beginPath();
      ctx.moveTo(ax - ux * halfDoor * 0.5, ay - uy * halfDoor * 0.5);
      ctx.lineTo(ax + ux * halfDoor * 0.5, ay + uy * halfDoor * 0.5);
      ctx.stroke();
      // Arrow head
      const ahx = ax + ux * halfDoor * 0.5;
      const ahy = ay + uy * halfDoor * 0.5;
      ctx.beginPath();
      ctx.moveTo(ahx - ux * 6 + nx * 4, ahy - uy * 6 + ny * 4);
      ctx.lineTo(ahx, ahy);
      ctx.lineTo(ahx - ux * 6 - nx * 4, ahy - uy * 6 - ny * 4);
      ctx.stroke();

    } else if (doorType === 'bifold') {
      // Bifold: zigzag folding panels
      const panelCount = 4;
      const panelW = (door.width / panelCount) * zoom;
      const foldAngle = Math.PI / 6; // 30° fold
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      let px = s.x - ux * halfDoor;
      let py = s.y - uy * halfDoor;
      for (let i = 0; i < panelCount; i++) {
        const angle = wallAngle + (i % 2 === 0 ? foldAngle * swingDir : -foldAngle * swingDir * 0.3);
        const ex = px + panelW * Math.cos(angle);
        const ey = py + panelW * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // Fold joint dot
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
        px = ex;
        py = ey;
      }
    }
  }

  function drawWindowOnWall(wall: Wall, win: Win) {
    const t = win.position;
    const wpt = wallPointAt(wall, t);
    const s = worldToScreen(wpt.x, wpt.y);

    const tan = wallTangentAt(wall, t);
    const ux = tan.x, uy = tan.y;
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
    // Use overridden dimensions or fall back to catalog defaults
    const w = (item.width ?? cat.width) * (item.scale?.x ?? 1) * zoom;
    const d = (item.depth ?? cat.depth) * (item.scale?.y ?? 1) * zoom;
    const angle = (item.rotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    // Architectural top-down icon - use overridden color or catalog default
    const itemColor = item.color ?? cat.color;
    const strokeColor = selected ? '#3b82f6' : itemColor;
    ctx.lineWidth = selected ? 2 : 1;
    drawFurnitureIcon(ctx, item.catalogId, w, d, itemColor, strokeColor);

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

  function drawPlacementPreview() {
    if (!placementPreview || !currentFloor) return;
    const wall = currentFloor.walls.find(w => w.id === placementPreview!.wallId);
    if (!wall) return;
    const t = placementPreview.position;
    const wpt = wallPointAt(wall, t);
    const s = worldToScreen(wpt.x, wpt.y);
    const tan = wallTangentAt(wall, t);
    const ux = tan.x, uy = tan.y;
    const nx = -uy, ny = ux;
    const isDoor = placementPreview.type === 'door';
    const itemWidth = isDoor ? 90 : 120; // default door 90cm, window 120cm
    const halfW = (itemWidth / 2) * zoom;
    const thickness = wallThicknessScreen(wall);

    ctx.save();
    ctx.globalAlpha = 0.5;

    // Ghost gap (white area on wall)
    ctx.fillStyle = '#fafafa';
    const gux = ux * halfW, guy = uy * halfW;
    const gnx = nx * (thickness / 2 + 1), gny = ny * (thickness / 2 + 1);
    ctx.beginPath();
    ctx.moveTo(s.x - gux + gnx, s.y - guy + gny);
    ctx.lineTo(s.x + gux + gnx, s.y + guy + gny);
    ctx.lineTo(s.x + gux - gnx, s.y + guy - gny);
    ctx.lineTo(s.x - gux - gnx, s.y - guy - gny);
    ctx.closePath();
    ctx.fill();

    if (isDoor) {
      // Ghost swing arc
      const wallAngle = Math.atan2(uy, ux);
      const r = itemWidth * zoom;
      const hingeX = s.x - ux * halfW;
      const hingeY = s.y - uy * halfW;
      const startAngle = wallAngle + Math.PI;
      const endAngle = startAngle + Math.PI / 2;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hingeX, hingeY, r, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();
      // Door panel
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hingeX, hingeY);
      ctx.lineTo(hingeX + r * Math.cos(endAngle), hingeY + r * Math.sin(endAngle));
      ctx.stroke();
      // Jamb ticks
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#3b82f6';
      const jamb = thickness / 2 + 2;
      for (const sign of [-1, 1]) {
        const jx = s.x + ux * halfW * sign;
        const jy = s.y + uy * halfW * sign;
        ctx.beginPath();
        ctx.moveTo(jx + nx * jamb, jy + ny * jamb);
        ctx.lineTo(jx - nx * jamb, jy - ny * jamb);
        ctx.stroke();
      }
    } else {
      // Ghost window — 3 parallel lines
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      for (const off of [-2, 0, 2]) {
        const ox = nx * off, oy = ny * off;
        ctx.beginPath();
        ctx.moveTo(s.x - ux * halfW + ox, s.y - uy * halfW + oy);
        ctx.lineTo(s.x + ux * halfW + ox, s.y + uy * halfW + oy);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;

    // "Click to place" tooltip
    ctx.font = 'bold 11px system-ui, sans-serif';
    const text = isDoor ? 'Click to place door' : 'Click to place window';
    const tm = ctx.measureText(text);
    const tx = s.x, ty = s.y - thickness / 2 - 24;
    const pw = tm.width + 12, ph = 20;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(tx - pw / 2, ty - ph / 2, pw, ph, 4);
    ctx.fill();
    // Small triangle pointing down
    ctx.beginPath();
    ctx.moveTo(tx - 5, ty + ph / 2);
    ctx.lineTo(tx + 5, ty + ph / 2);
    ctx.lineTo(tx, ty + ph / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx, ty);

    ctx.restore();

    // Highlight the target wall
    const ws = worldToScreen(wall.start.x, wall.start.y);
    const we = worldToScreen(wall.end.x, wall.end.y);
    ctx.strokeStyle = '#3b82f680';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(ws.x, ws.y);
    ctx.lineTo(we.x, we.y);
    ctx.stroke();
    ctx.setLineDash([]);
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

  // Floor texture patterns for 2D room rendering
  type FloorPatternType = 'wood' | 'tile' | 'stone' | 'none';
  const ROOM_FLOOR_PATTERN: Record<string, FloorPatternType> = {
    'Living Room': 'wood', 'Bedroom': 'wood', 'Office': 'wood', 'Dining Room': 'wood', 'Hallway': 'wood',
    'Kitchen': 'tile', 'Bathroom': 'tile', 'Laundry': 'tile',
    'Garage': 'stone', 'Closet': 'none',
  };

  function drawRoomFloorPattern(room: Room, screenPoly: {x:number,y:number}[]) {
    const pattern = ROOM_FLOOR_PATTERN[room.name] ?? 'wood';
    if (pattern === 'none' || zoom < 0.3) return; // skip at very low zoom

    ctx.save();
    // Clip to room polygon
    ctx.beginPath();
    ctx.moveTo(screenPoly[0].x, screenPoly[0].y);
    for (let i = 1; i < screenPoly.length; i++) ctx.lineTo(screenPoly[i].x, screenPoly[i].y);
    ctx.closePath();
    ctx.clip();

    // Bounding box of screen polygon
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of screenPoly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const alpha = Math.min(0.12, 0.04 + zoom * 0.02);
    ctx.strokeStyle = `rgba(120, 120, 120, ${alpha})`;
    ctx.lineWidth = 0.5;

    if (pattern === 'wood') {
      // Horizontal plank lines
      const spacing = 15 * zoom; // ~15cm planks
      if (spacing > 3) {
        for (let y = minY; y <= maxY; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();
        }
        // Staggered vertical joints every ~60cm
        const jointSpacing = 60 * zoom;
        if (jointSpacing > 8) {
          let row = 0;
          for (let y = minY; y <= maxY; y += spacing) {
            const offset = (row % 2) * jointSpacing * 0.5;
            for (let x = minX + offset; x <= maxX; x += jointSpacing) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + spacing);
              ctx.stroke();
            }
            row++;
          }
        }
      }
    } else if (pattern === 'tile') {
      // Grid tile pattern
      const tileSize = 30 * zoom; // ~30cm tiles
      if (tileSize > 5) {
        for (let x = minX; x <= maxX; x += tileSize) {
          ctx.beginPath();
          ctx.moveTo(x, minY);
          ctx.lineTo(x, maxY);
          ctx.stroke();
        }
        for (let y = minY; y <= maxY; y += tileSize) {
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();
        }
      }
    } else if (pattern === 'stone') {
      // Diagonal crosshatch
      const spacing = 25 * zoom;
      if (spacing > 5) {
        const w = maxX - minX, h = maxY - minY;
        for (let d = -h; d <= w; d += spacing) {
          ctx.beginPath();
          ctx.moveTo(minX + d, minY);
          ctx.lineTo(minX + d + h, maxY);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
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

      // 2D floor texture pattern (subtle architectural hatching)
      drawRoomFloorPattern(room, screenPoly);

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
      const fontSize = Math.max(11, 13 * zoom);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${room.name} (${room.area} m²)`, sc.x, sc.y);

      // Room dimensions (width × depth from oriented bounding box)
      if (poly.length >= 3) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of poly) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        const roomW = (maxX - minX) / 100;
        const roomD = (maxY - minY) / 100;
        if (roomW > 0.1 && roomD > 0.1) {
          const dimFontSize = Math.max(9, 10 * zoom);
          ctx.fillStyle = '#b0b8c4';
          ctx.font = `${dimFontSize}px sans-serif`;
          ctx.fillText(`${roomW.toFixed(2)} × ${roomD.toFixed(2)} m`, sc.x, sc.y + fontSize + 2);
        }
      }
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

  function drawRulers() {
    if (!ctx || !showRulers) return;
    const R = RULER_SIZE;
    const fontSize = 9;
    ctx.save();

    // Determine tick spacing based on zoom
    // We want ticks ~50-150px apart in screen space
    const rawStep = 50 / zoom; // world units per ~50px
    // Round to a nice number: 10, 20, 50, 100, 200, 500, 1000...
    const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let tickStep = niceSteps[niceSteps.length - 1];
    for (const s of niceSteps) {
      if (s * zoom >= 40) { tickStep = s; break; }
    }
    const minorDiv = tickStep >= 100 ? 5 : tickStep >= 10 ? 5 : 2;
    const minorStep = tickStep / minorDiv;

    // --- Horizontal ruler (top) ---
    ctx.fillStyle = '#f1f3f5';
    ctx.fillRect(R, 0, width - R, R);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.lineTo(width, R); ctx.stroke();

    // Ticks
    const worldLeft = screenToWorld(R, 0).x;
    const worldRight = screenToWorld(width, 0).x;
    const startTick = Math.floor(worldLeft / minorStep) * minorStep;

    ctx.fillStyle = '#6b7280';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let wx = startTick; wx <= worldRight; wx += minorStep) {
      const sx = worldToScreen(wx, 0).x;
      if (sx < R) continue;
      const isMajor = Math.abs(wx % tickStep) < 0.01;
      const isMid = !isMajor && Math.abs(wx % (tickStep / 2)) < 0.01 && minorDiv >= 4;
      const tickH = isMajor ? R * 0.7 : isMid ? R * 0.45 : R * 0.25;

      ctx.strokeStyle = isMajor ? '#9ca3af' : '#d1d5db';
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, R);
      ctx.lineTo(sx, R - tickH);
      ctx.stroke();

      if (isMajor) {
        const label = tickStep >= 100 ? `${(wx / 100).toFixed(wx % 100 === 0 ? 0 : 1)}m` : `${Math.round(wx)}`;
        ctx.fillText(label, sx, 2);
      }
    }

    // --- Vertical ruler (left) ---
    ctx.fillStyle = '#f1f3f5';
    ctx.fillRect(0, R, R, height - R);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.lineTo(R, height); ctx.stroke();

    const worldTop = screenToWorld(0, R).y;
    const worldBottom = screenToWorld(0, height).y;
    const startTickY = Math.floor(worldTop / minorStep) * minorStep;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let wy = startTickY; wy <= worldBottom; wy += minorStep) {
      const sy = worldToScreen(0, wy).y;
      if (sy < R) continue;
      const isMajor = Math.abs(wy % tickStep) < 0.01;
      const isMid = !isMajor && Math.abs(wy % (tickStep / 2)) < 0.01 && minorDiv >= 4;
      const tickH = isMajor ? R * 0.7 : isMid ? R * 0.45 : R * 0.25;

      ctx.strokeStyle = isMajor ? '#9ca3af' : '#d1d5db';
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(R, sy);
      ctx.lineTo(R - tickH, sy);
      ctx.stroke();

      if (isMajor) {
        const label = tickStep >= 100 ? `${(wy / 100).toFixed(wy % 100 === 0 ? 0 : 1)}m` : `${Math.round(wy)}`;
        ctx.save();
        ctx.translate(R - 3, sy);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#6b7280';
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // Corner square
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, R, R);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, R, R);

    // Mouse position indicators on rulers
    const mScreen = worldToScreen(mousePos.x, mousePos.y);
    // Horizontal indicator
    if (mScreen.x > R) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(mScreen.x, R);
      ctx.lineTo(mScreen.x - 3, R - 6);
      ctx.lineTo(mScreen.x + 3, R - 6);
      ctx.closePath();
      ctx.fill();
    }
    // Vertical indicator
    if (mScreen.y > R) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(R, mScreen.y);
      ctx.lineTo(R - 6, mScreen.y - 3);
      ctx.lineTo(R - 6, mScreen.y + 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBackgroundImage() {
    if (!bgImage || !currentFloor?.backgroundImage) return;
    const bg = currentFloor.backgroundImage;
    const s = worldToScreen(bg.position.x, bg.position.y);
    ctx.save();
    ctx.globalAlpha = bg.opacity;
    ctx.translate(s.x, s.y);
    ctx.rotate(bg.rotation * Math.PI / 180);
    const sw = bgImage.width * bg.scale * zoom;
    const sh = bgImage.height * bg.scale * zoom;
    ctx.drawImage(bgImage, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  function drawStair(stair: Stair, selected: boolean) {
    const s = worldToScreen(stair.position.x, stair.position.y);
    const w = stair.width * zoom;
    const d = stair.depth * zoom;
    const angle = (stair.rotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    // Stair outline
    ctx.fillStyle = selected ? '#bfdbfe80' : '#e5e7eb80';
    ctx.strokeStyle = selected ? '#3b82f6' : '#555';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.strokeRect(-w / 2, -d / 2, w, d);

    // Tread lines
    const treadSpacing = d / stair.riserCount;
    ctx.strokeStyle = selected ? '#3b82f6' : '#888';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < stair.riserCount; i++) {
      const y = -d / 2 + i * treadSpacing;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
      ctx.stroke();
    }

    // Direction arrow
    ctx.fillStyle = selected ? '#3b82f6' : '#555';
    ctx.strokeStyle = selected ? '#3b82f6' : '#555';
    ctx.lineWidth = 1.5;
    const arrowY = stair.direction === 'up' ? -d / 2 + d * 0.15 : d / 2 - d * 0.15;
    const arrowDir = stair.direction === 'up' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(0, arrowY + arrowDir * d * 0.3);
    ctx.lineTo(0, arrowY);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(0, arrowY);
    ctx.lineTo(-w * 0.1, arrowY + arrowDir * d * 0.08);
    ctx.lineTo(w * 0.1, arrowY + arrowDir * d * 0.08);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle = '#374151';
    ctx.font = `${Math.max(8, 10 * zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stair.direction === 'up' ? 'UP' : 'DN', 0, 0);

    if (selected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    drawGrid();
    drawBackgroundImage();

    const floor = currentFloor;
    if (!floor) { requestAnimationFrame(draw); return; }

    updateDetectedRooms();
    const selId = currentSelectedId;
    const multiIds = currentSelectedIds;
    function isSelected(id: string) { return id === selId || multiIds.has(id); }

    drawRooms();
    drawSnapPoints();

    for (const w of floor.walls) drawWall(w, isSelected(w.id));

    // Draw filled joints where walls share endpoints (covers corner gaps)
    drawWallJoints(floor, selId);

    for (const d of floor.doors) {
      const wall = floor.walls.find((w) => w.id === d.wallId);
      if (wall) {
        drawDoorOnWall(wall, d);
        // Draw distance dimensions when selected
        if (isSelected(d.id)) drawDoorDistanceDimensions(wall, d);
      }
    }
    for (const win of floor.windows) {
      const wall = floor.walls.find((w) => w.id === win.wallId);
      if (wall) {
        drawWindowOnWall(wall, win);
        // Draw distance dimensions when selected
        if (isSelected(win.id)) drawWindowDistanceDimensions(wall, win);
      }
    }

    // Furniture
    for (const fi of floor.furniture) {
      const selected = isSelected(fi.id);
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

    // Stairs
    if (floor.stairs) {
      for (const stair of floor.stairs) {
        drawStair(stair, isSelected(stair.id));
      }
    }

    // Stair placement preview
    if (isPlacingStair) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const preview: Stair = { id: 'preview', position: mousePos, rotation: 0, width: 100, depth: 300, riserCount: 14, direction: 'up' };
      drawStair(preview, false);
      ctx.restore();
    }

    // Calibration points
    if (isCalibrating && calPoints.length > 0) {
      ctx.fillStyle = '#ef4444';
      for (const pt of calPoints) {
        const sp = worldToScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (calPoints.length === 2) {
        const sp1 = worldToScreen(calPoints[0].x, calPoints[0].y);
        const sp2 = worldToScreen(calPoints[1].x, calPoints[1].y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sp1.x, sp1.y);
        ctx.lineTo(sp2.x, sp2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Furniture placement preview
    if (currentPlacingId && currentTool === 'furniture') drawFurniturePreview();

    // Door/window placement preview
    if (placementPreview) drawPlacementPreview();

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

    // Marquee selection rectangle
    if (marqueeStart && marqueeEnd) {
      const s = worldToScreen(marqueeStart.x, marqueeStart.y);
      const e = worldToScreen(marqueeEnd.x, marqueeEnd.y);
      const rx = Math.min(s.x, e.x), ry = Math.min(s.y, e.y);
      const rw = Math.abs(e.x - s.x), rh = Math.abs(e.y - s.y);
      if (rw > 2 || rh > 2) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      }
    }

    // Measurement
    if (measureStart && measuring) drawMeasurement();

    // Rulers (drawn last, on top of everything)
    drawRulers();

    requestAnimationFrame(draw);
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    resize();
    // Re-render when photo textures finish loading
    setTextureLoadCallback(() => { /* draw loop is already running via rAF */ });
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
    const unsub8 = placingDoorType.subscribe((t) => { currentDoorType = t; });
    const unsub9 = placingWindowType.subscribe((t) => { currentWindowType = t; });
    const unsub10 = snapEnabled.subscribe((v) => { currentSnapEnabled = v; });
    const unsub11 = placingStair.subscribe((v) => { isPlacingStair = v; });
    const unsub12 = calibrationMode.subscribe((v) => { isCalibrating = v; });
    const unsub13 = calibrationPoints.subscribe((pts) => { calPoints = pts; });
    const unsub_multi = selectedElementIds.subscribe((ids) => { currentSelectedIds = ids; });
    const unsub14 = activeFloor.subscribe((f) => {
      if (f?.backgroundImage?.dataUrl && (!bgImage || bgImage.src !== f.backgroundImage.dataUrl)) {
        const img = new Image();
        img.onload = () => { bgImage = img; };
        img.src = f.backgroundImage.dataUrl;
      } else if (!f?.backgroundImage) {
        bgImage = null;
      }
    });

    return () => { resizeObs.disconnect(); unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); unsub9(); unsub10(); unsub11(); unsub12(); unsub13(); unsub_multi(); unsub14(); };
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
    const threshold = 15 / zoom;
    for (const w of currentFloor.walls) {
      if (w.curvePoint) {
        // Check distance to bezier curve by sampling
        for (let i = 0; i <= 20; i++) {
          const pt = wallPointAt(w, i / 20);
          if (Math.hypot(p.x - pt.x, p.y - pt.y) < threshold + w.thickness / 2) return w;
        }
      } else {
        if (pointToSegmentDist(p, w.start, w.end) < threshold) return w;
      }
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

  function findStairAt(p: Point): Stair | null {
    if (!currentFloor?.stairs) return null;
    for (const stair of [...currentFloor.stairs].reverse()) {
      const dx = p.x - stair.position.x;
      const dy = p.y - stair.position.y;
      const angle = -(stair.rotation * Math.PI) / 180;
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(rx) < stair.width / 2 && Math.abs(ry) < stair.depth / 2) return stair;
    }
    return null;
  }

  function findDoorAt(p: Point): Door | null {
    if (!currentFloor) return null;
    for (const d of currentFloor.doors) {
      const wall = currentFloor.walls.find(w => w.id === d.wallId);
      if (!wall) continue;
      const cp = wallPointAt(wall, d.position);
      if (Math.hypot(p.x - cp.x, p.y - cp.y) < (d.width / 2 + 5) / zoom) return d;
    }
    return null;
  }

  function findWindowAt(p: Point): Win | null {
    if (!currentFloor) return null;
    for (const w of currentFloor.windows) {
      const wall = currentFloor.walls.find(wl => wl.id === w.wallId);
      if (!wall) continue;
      const cp = wallPointAt(wall, w.position);
      if (Math.hypot(p.x - cp.x, p.y - cp.y) < (w.width / 2 + 5) / zoom) return w;
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
    if (w.curvePoint) {
      // Find closest t on bezier by sampling
      let bestT = 0.5, bestDist = Infinity;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const pt = wallPointAt(w, t);
        const d = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (d < bestDist) { bestDist = d; bestT = t; }
      }
      return Math.max(0.1, Math.min(0.9, bestT));
    }
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

    // Calibration mode click
    if (isCalibrating) {
      calibrationPoints.update(pts => {
        const newPts = [...pts, { x: wp.x, y: wp.y }];
        if (newPts.length >= 2) {
          const dist = Math.hypot(newPts[1].x - newPts[0].x, newPts[1].y - newPts[0].y);
          const realDist = prompt('Enter the real-world distance between these two points (in cm):');
          if (realDist && Number(realDist) > 0) {
            const pixelsPerCm = dist / Number(realDist);
            if (currentFloor?.backgroundImage) {
              updateBackgroundImage({ scale: currentFloor.backgroundImage.scale * (1 / pixelsPerCm) });
            }
          }
          calibrationMode.set(false);
          return [];
        }
        return newPts;
      });
      return;
    }

    // Stair placement
    if (isPlacingStair) {
      const pos = { x: snap(wp.x), y: snap(wp.y) };
      const id = addStair(pos);
      selectedElementId.set(id);
      placingStair.set(false);
      return;
    }

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
            draggingConnectedEndpoints = findConnectedEndpoints(selWall.start, selWall.id);
            commitFurnitureMove(); // uses same undo snapshot mechanism
            return;
          }
          if (Math.hypot(wp.x - selWall.end.x, wp.y - selWall.end.y) < epThreshold) {
            draggingWallEndpoint = { wallId: selWall.id, endpoint: 'end' };
            draggingConnectedEndpoints = findConnectedEndpoints(selWall.end, selWall.id);
            commitFurnitureMove();
            return;
          }
          // Check midpoint handle: Alt+drag = curve, normal drag = parallel move
          const curveHandlePt = selWall.curvePoint
            ? selWall.curvePoint
            : { x: (selWall.start.x + selWall.end.x) / 2, y: (selWall.start.y + selWall.end.y) / 2 };
          if (Math.hypot(wp.x - curveHandlePt.x, wp.y - curveHandlePt.y) < epThreshold) {
            if (e.altKey) {
              draggingCurveHandle = selWall.id;
            } else if (!selWall.curvePoint) {
              // Parallel drag for straight walls
              draggingWallParallel = {
                wallId: selWall.id,
                startMousePos: { ...wp },
                origStart: { ...selWall.start },
                origEnd: { ...selWall.end },
                connectedStart: findConnectedEndpoints(selWall.start, selWall.id),
                connectedEnd: findConnectedEndpoints(selWall.end, selWall.id),
              };
            } else {
              // For curved walls, midpoint handle still curves
              draggingCurveHandle = selWall.id;
            }
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
      // Helper: select an element (shift = add to multi-select)
      function selectElement(id: string, isShift: boolean) {
        if (isShift) {
          selectedElementIds.update(ids => {
            const next = new Set(ids);
            // Also include the current single selection if any
            if (currentSelectedId && currentSelectedId !== id) next.add(currentSelectedId);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
          selectedElementId.set(id);
        } else {
          selectedElementId.set(id);
          selectedElementIds.set(new Set());
        }
        selectedRoomId.set(null);
      }

      // Check doors/windows first (they sit on walls, so check before walls)
      const door = findDoorAt(wp);
      if (door) {
        selectElement(door.id, e.shiftKey);
        if (!e.shiftKey) draggingDoorId = door.id;
        return;
      }
      const win = findWindowAt(wp);
      if (win) {
        selectElement(win.id, e.shiftKey);
        if (!e.shiftKey) draggingWindowId = win.id;
        return;
      }
      // Check stairs
      const stair = findStairAt(wp);
      if (stair) {
        selectElement(stair.id, e.shiftKey);
        if (!e.shiftKey) {
          draggingStairId = stair.id;
          stairDragOffset = { x: wp.x - stair.position.x, y: wp.y - stair.position.y };
        }
        return;
      }
      // Check furniture
      const fi = findFurnitureAt(wp);
      if (fi) {
        selectElement(fi.id, e.shiftKey);
        if (!e.shiftKey) {
          draggingFurnitureId = fi.id;
          commitFurnitureMove(); // snapshot before drag for undo
          dragOffset = { x: wp.x - fi.position.x, y: wp.y - fi.position.y };
        }
        return;
      }
      const wall = findWallAt(wp);
      if (wall) {
        selectElement(wall.id, e.shiftKey);
      } else {
        const room = findRoomAt(wp);
        if (room) {
          selectedRoomId.set(room.id);
          selectedElementId.set(null);
          selectedElementIds.set(new Set());
        } else {
          // Empty space — start marquee selection
          marqueeStart = { ...wp };
          marqueeEnd = { ...wp };
          if (!e.shiftKey) {
            selectedElementId.set(null);
            selectedElementIds.set(new Set());
          }
          selectedRoomId.set(null);
        }
      }
    } else if (tool === 'door') {
      const wall = findWallAt(wp);
      if (wall) {
        addDoor(wall.id, positionOnWall(wp, wall), currentDoorType);
        selectedTool.set('select');
      }
    } else if (tool === 'window') {
      const wall = findWallAt(wp);
      if (wall) {
        addWindow(wall.id, positionOnWall(wp, wall), currentWindowType);
        selectedTool.set('select');
      }
    }
  }

  function onDblClick(e: MouseEvent) {
    // Double-click on a wall in select mode to split it
    if (currentTool === 'select') {
      const rect = canvas.getBoundingClientRect();
      const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const wall = findWallAt(wp);
      if (wall && !wall.curvePoint) {
        const t = positionOnWall(wp, wall);
        if (t > 0.05 && t < 0.95) {
          const newId = splitWall(wall.id, t);
          if (newId) {
            selectedElementId.set(null);
            return;
          }
        }
      }
    }
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
      // Exclude the dragged wall and all connected walls from magnetic snap targets
      const excludeIds = new Set<string>([draggingWallEndpoint.wallId, ...draggingConnectedEndpoints.map(c => c.wallId)]);
      let pt = magneticSnap(mousePos, excludeIds);
      // Angle snap to the opposite endpoint of the primary wall being dragged
      if (currentFloor) {
        const wall = currentFloor.walls.find(w => w.id === draggingWallEndpoint!.wallId);
        if (wall) {
          const other = draggingWallEndpoint.endpoint === 'start' ? wall.end : wall.start;
          pt = angleSnap(other, pt);
        }
      }
      moveWallEndpoint(draggingWallEndpoint.wallId, draggingWallEndpoint.endpoint, pt);
      // Move all connected endpoints together
      for (const conn of draggingConnectedEndpoints) {
        moveWallEndpoint(conn.wallId, conn.endpoint, pt);
      }
    }
    if (draggingWallParallel && currentFloor) {
      const wall = currentFloor.walls.find(w => w.id === draggingWallParallel.wallId);
      if (wall) {
        // Constrain movement to perpendicular direction only
        const wdx = draggingWallParallel.origEnd.x - draggingWallParallel.origStart.x;
        const wdy = draggingWallParallel.origEnd.y - draggingWallParallel.origStart.y;
        const wLen = Math.hypot(wdx, wdy);
        if (wLen > 0) {
          // Normal (perpendicular) direction
          const nx = -wdy / wLen;
          const ny = wdx / wLen;
          // Project mouse delta onto normal
          const mdx = mousePos.x - draggingWallParallel.startMousePos.x;
          const mdy = mousePos.y - draggingWallParallel.startMousePos.y;
          let proj = mdx * nx + mdy * ny;
          // Snap to grid
          proj = Math.round(proj / SNAP) * SNAP;
          const dx = proj * nx;
          const dy = proj * ny;
          // Set wall positions from original + offset
          const newStart = {
            x: draggingWallParallel.origStart.x + dx,
            y: draggingWallParallel.origStart.y + dy,
          };
          const newEnd = {
            x: draggingWallParallel.origEnd.x + dx,
            y: draggingWallParallel.origEnd.y + dy,
          };
          moveWallEndpoint(draggingWallParallel.wallId, 'start', newStart);
          moveWallEndpoint(draggingWallParallel.wallId, 'end', newEnd);
          // Move connected walls' shared endpoints so adjacent walls stretch to stay connected
          for (const conn of draggingWallParallel.connectedStart) {
            moveWallEndpoint(conn.wallId, conn.endpoint, newStart);
          }
          for (const conn of draggingWallParallel.connectedEnd) {
            moveWallEndpoint(conn.wallId, conn.endpoint, newEnd);
          }
        }
      }
    }
    if (draggingCurveHandle && currentFloor) {
      const wall = currentFloor.walls.find(w => w.id === draggingCurveHandle);
      if (wall) {
        // Check if mouse is close enough to the straight line (if so, snap back to straight)
        const mx = (wall.start.x + wall.end.x) / 2;
        const my = (wall.start.y + wall.end.y) / 2;
        const distToMid = Math.hypot(mousePos.x - mx, mousePos.y - my);
        if (distToMid < 5) {
          // Snap back to straight wall
          updateWall(draggingCurveHandle, { curvePoint: undefined });
        } else {
          updateWall(draggingCurveHandle, { curvePoint: { x: snap(mousePos.x), y: snap(mousePos.y) } });
        }
      }
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
    if (draggingStairId && currentFloor?.stairs) {
      const basePos = { x: mousePos.x - stairDragOffset.x, y: mousePos.y - stairDragOffset.y };
      moveStair(draggingStairId, { x: snap(basePos.x), y: snap(basePos.y) });
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
    // Door/window placement preview
    if ((currentTool === 'door' || currentTool === 'window') && currentFloor) {
      const wall = findWallAt(mousePos);
      if (wall) {
        placementPreview = { wallId: wall.id, position: positionOnWall(mousePos, wall), type: currentTool as 'door' | 'window' };
      } else {
        placementPreview = null;
      }
    } else {
      placementPreview = null;
    }

    // Marquee drag update
    if (marqueeStart) {
      marqueeEnd = { ...mousePos };
    }

    if (measuring && measureStart) {
      measureEnd = { ...mousePos };
    }
  }

  function onMouseUp(e: MouseEvent) {
    isPanning = false;

    // Finalize marquee selection
    if (marqueeStart && marqueeEnd && currentFloor) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      const marqueeW = maxX - minX;
      const marqueeH = maxY - minY;

      // Only treat as marquee if dragged at least a small distance
      if (marqueeW > 5 || marqueeH > 5) {
        const ids = new Set<string>(e.shiftKey ? currentSelectedIds : []);

        function ptInRect(p: Point) {
          return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
        }

        // Walls: both endpoints inside
        for (const w of currentFloor.walls) {
          if (ptInRect(w.start) && ptInRect(w.end)) ids.add(w.id);
        }
        // Doors/windows: center point inside
        for (const d of currentFloor.doors) {
          const w = currentFloor.walls.find(w => w.id === d.wallId);
          if (w) {
            const cx = w.start.x + (w.end.x - w.start.x) * d.position;
            const cy = w.start.y + (w.end.y - w.start.y) * d.position;
            if (ptInRect({ x: cx, y: cy })) ids.add(d.id);
          }
        }
        for (const win of currentFloor.windows) {
          const w = currentFloor.walls.find(w => w.id === win.wallId);
          if (w) {
            const cx = w.start.x + (w.end.x - w.start.x) * win.position;
            const cy = w.start.y + (w.end.y - w.start.y) * win.position;
            if (ptInRect({ x: cx, y: cy })) ids.add(win.id);
          }
        }
        // Furniture: center inside
        for (const fi of currentFloor.furniture) {
          if (ptInRect(fi.position)) ids.add(fi.id);
        }
        // Stairs: center inside
        if (currentFloor.stairs) {
          for (const st of currentFloor.stairs) {
            if (ptInRect(st.position)) ids.add(st.id);
          }
        }

        if (ids.size > 0) {
          selectedElementIds.set(ids);
          // Set primary selection to first element
          const first = ids.values().next().value;
          if (first) selectedElementId.set(first);
        }
      }
      marqueeStart = null;
      marqueeEnd = null;
    }

    if (draggingFurnitureId) commitFurnitureMove();
    if (draggingHandle) commitFurnitureMove();
    if (draggingWallEndpoint) commitFurnitureMove();
    if (draggingWallParallel) commitFurnitureMove();
    if (draggingCurveHandle) commitFurnitureMove();
    draggingWallParallel = null;
    draggingCurveHandle = null;
    draggingFurnitureId = null;
    draggingStairId = null;
    draggingDoorId = null;
    draggingWindowId = null;
    draggingHandle = null;
    draggingWallEndpoint = null;
    draggingConnectedEndpoints = [];
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
    draggingWallParallel ? 'move' :
    draggingCurveHandle ? 'crosshair' :
    draggingWallEndpoint ? 'crosshair' :
    draggingHandle === 'rotate' ? 'grabbing' :
    draggingHandle?.startsWith('resize') ? 'nwse-resize' :
    currentTool === 'select' ? 'default' :
    currentTool === 'furniture' ? 'copy' :
    (currentTool === 'door' || currentTool === 'window') ? (placementPreview ? 'crosshair' : 'not-allowed') :
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
    {#if currentSelectedIds.size > 1}
      <span class="text-blue-600 font-medium">{currentSelectedIds.size} selected</span>
      <span class="text-gray-300">|</span>
    {/if}
    <span>Zoom: {Math.round(zoom * 100)}%</span>
    <button class="hover:text-gray-700" onclick={() => zoomToFit()} title="Zoom to Fit (F)">⊞ Fit</button>
    <button class="hover:text-gray-700" onclick={() => showGrid = !showGrid} title="Toggle Grid (G)">
      {showGrid ? '▦' : '▢'} Grid
    </button>
    <button class="hover:text-gray-700" onclick={() => showRulers = !showRulers} title="Toggle Rulers">
      {showRulers ? '📏' : '📐'} Rulers
    </button>
  </div>
  <!-- Contextual Toolbar -->
  {#if (currentSelectedId || currentSelectedIds.size > 0) && currentFloor && currentTool === 'select'}
    {@const el = (() => {
      const f = currentFloor;
      const wall = f.walls.find(w => w.id === currentSelectedId);
      if (wall) {
        const s = worldToScreen((wall.start.x + wall.end.x) / 2, (wall.start.y + wall.end.y) / 2);
        return { type: 'wall', pos: s };
      }
      const door = f.doors.find(d => d.id === currentSelectedId);
      if (door) {
        const w = f.walls.find(w => w.id === door.wallId);
        if (w) {
          const s = worldToScreen(w.start.x + (w.end.x - w.start.x) * door.position, w.start.y + (w.end.y - w.start.y) * door.position);
          return { type: 'door', pos: s, door };
        }
      }
      const win = f.windows.find(w => w.id === currentSelectedId);
      if (win) {
        const w = f.walls.find(w => w.id === win.wallId);
        if (w) {
          const s = worldToScreen(w.start.x + (w.end.x - w.start.x) * win.position, w.start.y + (w.end.y - w.start.y) * win.position);
          return { type: 'window', pos: s };
        }
      }
      const furn = f.furniture.find(fi => fi.id === currentSelectedId);
      if (furn) {
        const s = worldToScreen(furn.position.x, furn.position.y);
        return { type: 'furniture', pos: s };
      }
      return null;
    })()}
    {#if el}
      <div
        class="absolute z-40 flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 px-1 py-0.5"
        style="left: {el.pos.x}px; top: {el.pos.y - 44}px; transform: translateX(-50%);"
      >
        <button
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          title="Duplicate"
          onclick={() => {
            if (!currentSelectedId || !currentFloor) return;
            let newId: string | null = null;
            if (el.type === 'door') newId = duplicateDoor(currentSelectedId);
            else if (el.type === 'window') newId = duplicateWindow(currentSelectedId);
            else if (el.type === 'furniture') newId = duplicateFurniture(currentSelectedId);
            else if (el.type === 'wall') newId = duplicateWall(currentSelectedId);
            if (newId) selectedElementId.set(newId);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        {#if el.type === 'door' && el.door}
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Flip swing"
            onclick={() => { if (el.door) updateDoor(el.door.id, { swingDirection: el.door.swingDirection === 'left' ? 'right' : 'left' }); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
        {/if}
        {#if el.type === 'wall'}
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Split wall at midpoint"
            onclick={() => {
              if (currentSelectedId) {
                const newId = splitWall(currentSelectedId, 0.5);
                if (newId) selectedElementId.set(null);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M4 12h4M16 12h4"/></svg>
          </button>
        {/if}
        <div class="w-px h-5 bg-gray-200 mx-0.5"></div>
        <button
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          title="Delete"
          onclick={() => {
            if (currentSelectedIds.size > 0) {
              for (const id of currentSelectedIds) removeElement(id);
              selectedElementIds.set(new Set());
              selectedElementId.set(null);
            } else if (currentSelectedId) {
              removeElement(currentSelectedId);
              selectedElementId.set(null);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
        </button>
      </div>
    {/if}
  {/if}
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
