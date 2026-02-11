<script lang="ts">
  import { onMount } from 'svelte';
  import { activeFloor } from '$lib/stores/project';
  import type { Floor, Wall, Door, Window as Win, Room, Stair } from '$lib/models/types';
  import { wallColors, type WallColor } from '$lib/utils/materials';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { createFurnitureModel } from '$lib/utils/furnitureModels3d';
  import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { getMaterial } from '$lib/utils/materials';
  import { getWallTextureCanvas, setTextureLoadCallback } from '$lib/utils/textureGenerator';

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let pointerControls: PointerLockControls;
  let animId: number;
  let currentFloor: Floor | null = null;
  let wallGroup: THREE.Group;
  
  // Walkthrough mode
  let walkthroughMode = $state(false);
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;
  let lookLeft = false;
  let lookRight = false;
  let lookUp = false;
  let lookDown = false;
  let isShiftHeld = false;
  const LOOK_SPEED = 2.0; // radians/s
  let canJump = false;
  let velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  let moveSpeed = $state(400); // cm/s
  let sprintSpeed = $state(800); // cm/s
  let eyeHeight = $state(160); // cm

  const WALL_THICKNESS = 15;
  const BASEBOARD_HEIGHT = 8;

  // Create a canvas-based floor texture
  function createFloorTexture(): THREE.CanvasTexture {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d')!;
    // Hardwood pattern
    cx.fillStyle = '#c4a882';
    cx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 32) {
      for (let x = 0; x < size; x += 64) {
        const offset = (y / 32) % 2 === 0 ? 0 : 32;
        cx.fillStyle = y % 64 < 32 ? '#b89b72' : '#d4b892';
        cx.fillRect(x + offset, y, 62, 30);
        cx.strokeStyle = '#a08060';
        cx.lineWidth = 0.5;
        cx.strokeRect(x + offset, y, 62, 30);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }

  function init() {
    scene = new THREE.Scene();

    // Gradient background
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const cx = c.getContext('2d')!;
    const grad = cx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#87ceeb');
    grad.addColorStop(0.5, '#c8e6f0');
    grad.addColorStop(1, '#e8e0d4');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 2, 256);
    const bgTex = new THREE.CanvasTexture(c);
    scene.background = bgTex;

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.set(800, 600, 800);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 100, 0);
    controls.maxPolarAngle = Math.PI / 2.05;
    
    // Initialize PointerLock controls for walkthrough mode
    pointerControls = new PointerLockControls(camera, renderer.domElement);
    
    // Keyboard event listeners for walkthrough
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    
    // ESC key to exit walkthrough mode
    pointerControls.addEventListener('unlock', () => {
      if (walkthroughMode) {
        exitWalkthroughMode();
      }
    });

    // Lights — improved multi-source setup
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.4);
    scene.add(hemi);

    // Key light (sun)
    const dir = new THREE.DirectionalLight(0xfff8e7, 1.0);
    dir.position.set(500, 1200, 800);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -1500;
    dir.shadow.camera.right = 1500;
    dir.shadow.camera.top = 1500;
    dir.shadow.camera.bottom = -1500;
    dir.shadow.bias = -0.0005;
    scene.add(dir);

    // Fill light — softer, opposite side to reduce harsh shadows
    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.4);
    fill.position.set(-600, 800, -400);
    scene.add(fill);

    // Rim/back light for depth
    const rim = new THREE.DirectionalLight(0xffe4c4, 0.25);
    rim.position.set(-200, 600, 1000);
    scene.add(rim);

    // Textured floor
    const floorTex = createFloorTexture();
    const floorGeo = new THREE.PlaneGeometry(4000, 4000);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, side: THREE.DoubleSide, roughness: 0.8 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    wallGroup = new THREE.Group();
    scene.add(wallGroup);
  }

  function autoCenterCamera(floor: Floor) {
    if (floor.walls.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const w of floor.walls) {
      for (const p of [w.start, w.end]) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
      }
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxZ - minZ, 200);
    controls.target.set(cx, 100, cz);
    camera.position.set(cx + size * 1.8, size * 1.4, cz + size * 1.8);
    controls.update();
  }

  function generateWallTexture(textureId: string, color: string): THREE.CanvasTexture {
    const canvas = getWallTextureCanvas(textureId, color);
    if (!canvas) {
      // Fallback: solid color
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const cx = c.getContext('2d')!;
      cx.fillStyle = color;
      cx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.004, 0.004); // Scale for wall dimensions in cm
    return tex;
  }

  function buildStairs(floor: Floor) {
    if (!floor.stairs) return;
    for (const stair of floor.stairs) {
      const treadDepth = stair.depth / stair.riserCount;
      const riserHeight = 260 / stair.riserCount; // Assume standard 260cm floor height
      const mat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
      const sideMat = new THREE.MeshStandardMaterial({ color: 0xb8956a, roughness: 0.8 });
      
      const stairGroup = new THREE.Group();
      
      for (let i = 0; i < stair.riserCount; i++) {
        // Tread
        const treadGeo = new THREE.BoxGeometry(stair.width, 3, treadDepth);
        const tread = new THREE.Mesh(treadGeo, mat);
        tread.position.set(0, (i + 1) * riserHeight - 1.5, -stair.depth / 2 + i * treadDepth + treadDepth / 2);
        tread.castShadow = true;
        tread.receiveShadow = true;
        stairGroup.add(tread);
        
        // Riser
        const riserGeo = new THREE.BoxGeometry(stair.width, riserHeight, 2);
        const riser = new THREE.Mesh(riserGeo, sideMat);
        riser.position.set(0, i * riserHeight + riserHeight / 2, -stair.depth / 2 + i * treadDepth);
        riser.castShadow = true;
        stairGroup.add(riser);
      }
      
      stairGroup.position.set(stair.position.x, 0, stair.position.y);
      stairGroup.rotation.y = -(stair.rotation * Math.PI) / 180;
      if (stair.direction === 'down') {
        stairGroup.rotation.y += Math.PI;
      }
      wallGroup.add(stairGroup);
    }
  }

  function buildWalls(floor: Floor) {
    while (wallGroup.children.length) wallGroup.remove(wallGroup.children[0]);

    const defaultInteriorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const defaultExteriorMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc9, roughness: 0.85 });
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.7 });

    for (const wall of floor.walls) {
      // Use wall color if set (non-default), otherwise use defaults
      const wallColor = wall.color && wall.color !== '#cccccc' && wall.color !== '#888888'
        ? new THREE.Color(wall.color)
        : null;
      let interiorMat: THREE.MeshStandardMaterial;
      let exteriorMat: THREE.MeshStandardMaterial;
      if (wall.texture) {
        const wallTex = generateWallTexture(wall.texture, wall.color || '#888888');
        wallTex.repeat.set(0.003, 0.003);
        interiorMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
        exteriorMat = new THREE.MeshStandardMaterial({ map: wallTex.clone(), roughness: 0.85 });
      } else if (wallColor) {
        interiorMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
        exteriorMat = new THREE.MeshStandardMaterial({ color: wallColor.clone().offsetHSL(0, -0.05, -0.1), roughness: 0.85 });
      } else {
        interiorMat = defaultInteriorMat;
        exteriorMat = defaultExteriorMat;
      }
      // Curved wall handling
      if (wall.curvePoint) {
        const h = wall.height;
        const t = Math.max(wall.thickness, WALL_THICKNESS);
        const SEGS = 16;
        const materials = [
          exteriorMat, exteriorMat,
          interiorMat, interiorMat,
          interiorMat, exteriorMat,
        ];
        for (let i = 0; i < SEGS; i++) {
          const t0 = i / SEGS;
          const t1 = (i + 1) / SEGS;
          const mt0 = 1 - t0, mt1 = 1 - t1;
          const p0x = mt0*mt0*wall.start.x + 2*mt0*t0*wall.curvePoint.x + t0*t0*wall.end.x;
          const p0y = mt0*mt0*wall.start.y + 2*mt0*t0*wall.curvePoint.y + t0*t0*wall.end.y;
          const p1x = mt1*mt1*wall.start.x + 2*mt1*t1*wall.curvePoint.x + t1*t1*wall.end.x;
          const p1y = mt1*mt1*wall.start.y + 2*mt1*t1*wall.curvePoint.y + t1*t1*wall.end.y;
          const segLen = Math.hypot(p1x - p0x, p1y - p0y);
          if (segLen < 0.5) continue;
          const segAngle = Math.atan2(p1y - p0y, p1x - p0x);
          const segCx = (p0x + p1x) / 2;
          const segCy = (p0y + p1y) / 2;
          const geo = new THREE.BoxGeometry(segLen, h, t);
          const mesh = new THREE.Mesh(geo, materials);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(segCx, h / 2, segCy);
          mesh.rotation.y = -segAngle;
          wallGroup.add(mesh);
        }
        // Baseboard for curved wall
        for (let i = 0; i < SEGS; i++) {
          const t0 = i / SEGS, t1 = (i + 1) / SEGS;
          const mt0 = 1 - t0, mt1 = 1 - t1;
          const p0x = mt0*mt0*wall.start.x + 2*mt0*t0*wall.curvePoint.x + t0*t0*wall.end.x;
          const p0y = mt0*mt0*wall.start.y + 2*mt0*t0*wall.curvePoint.y + t0*t0*wall.end.y;
          const p1x = mt1*mt1*wall.start.x + 2*mt1*t1*wall.curvePoint.x + t1*t1*wall.end.x;
          const p1y = mt1*mt1*wall.start.y + 2*mt1*t1*wall.curvePoint.y + t1*t1*wall.end.y;
          const segLen = Math.hypot(p1x - p0x, p1y - p0y);
          if (segLen < 0.5) continue;
          const segAngle = Math.atan2(p1y - p0y, p1x - p0x);
          const bbGeo = new THREE.BoxGeometry(segLen, BASEBOARD_HEIGHT, t + 2);
          const bbMesh = new THREE.Mesh(bbGeo, baseboardMat);
          bbMesh.position.set((p0x + p1x) / 2, BASEBOARD_HEIGHT / 2, (p0y + p1y) / 2);
          bbMesh.rotation.y = -segAngle;
          bbMesh.castShadow = true;
          wallGroup.add(bbMesh);
        }
        continue;
      }

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;

      const h = wall.height;
      const t = Math.max(wall.thickness, WALL_THICKNESS);
      const angle = Math.atan2(dy, dx);
      const cx = (wall.start.x + wall.end.x) / 2;
      const cy = (wall.start.y + wall.end.y) / 2;

      const doorOpenings = floor.doors.filter((d) => d.wallId === wall.id);
      const winOpenings = floor.windows.filter((w) => w.wallId === wall.id);
      const segments = buildWallSegments(len, h, t, doorOpenings, winOpenings);

      for (const seg of segments) {
        const geo = new THREE.BoxGeometry(seg.width, seg.height, t);

        // Create a multi-material wall: interior white, exterior brown
        const materials = [
          exteriorMat, exteriorMat, // left, right
          interiorMat, interiorMat, // top, bottom
          interiorMat, exteriorMat, // front (interior), back (exterior)
        ];
        const mesh = new THREE.Mesh(geo, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const localX = seg.offsetX - len / 2;
        mesh.position.set(
          cx + localX * Math.cos(angle),
          seg.height / 2 + seg.offsetY,
          cy + localX * Math.sin(angle)
        );
        mesh.rotation.y = -angle;
        wallGroup.add(mesh);
      }

      // Baseboard — with gaps at door openings
      const doorOpeningsForBB = floor.doors.filter((d) => d.wallId === wall.id);
      if (doorOpeningsForBB.length === 0) {
        const bbGeo = new THREE.BoxGeometry(len, BASEBOARD_HEIGHT, t + 2);
        const bbMesh = new THREE.Mesh(bbGeo, baseboardMat);
        bbMesh.position.set(cx, BASEBOARD_HEIGHT / 2, cy);
        bbMesh.rotation.y = -angle;
        bbMesh.castShadow = true;
        wallGroup.add(bbMesh);
      } else {
        // Build baseboard segments skipping door gaps
        const sortedDoors = [...doorOpeningsForBB].sort((a, b) => a.position - b.position);
        let bbCursor = 0;
        for (const door of sortedDoors) {
          const dLeft = door.position * len - door.width / 2;
          const dRight = door.position * len + door.width / 2;
          if (dLeft > bbCursor) {
            const segLen = dLeft - bbCursor;
            const segCenter = bbCursor + segLen / 2 - len / 2;
            const bbGeo = new THREE.BoxGeometry(segLen, BASEBOARD_HEIGHT, t + 2);
            const bbMesh = new THREE.Mesh(bbGeo, baseboardMat);
            bbMesh.position.set(
              cx + segCenter * Math.cos(angle),
              BASEBOARD_HEIGHT / 2,
              cy + segCenter * Math.sin(angle)
            );
            bbMesh.rotation.y = -angle;
            bbMesh.castShadow = true;
            wallGroup.add(bbMesh);
          }
          bbCursor = Math.max(bbCursor, dRight);
        }
        if (bbCursor < len) {
          const segLen = len - bbCursor;
          const segCenter = bbCursor + segLen / 2 - len / 2;
          const bbGeo = new THREE.BoxGeometry(segLen, BASEBOARD_HEIGHT, t + 2);
          const bbMesh = new THREE.Mesh(bbGeo, baseboardMat);
          bbMesh.position.set(
            cx + segCenter * Math.cos(angle),
            BASEBOARD_HEIGHT / 2,
            cy + segCenter * Math.sin(angle)
          );
          bbMesh.rotation.y = -angle;
          bbMesh.castShadow = true;
          wallGroup.add(bbMesh);
        }
      }
    }

    // Doors
    for (const door of floor.doors) {
      const wall = floor.walls.find((w) => w.id === door.wallId);
      if (!wall) continue;
      const t = door.position;
      const px = wall.start.x + (wall.end.x - wall.start.x) * t;
      const py = wall.start.y + (wall.end.y - wall.start.y) * t;
      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      const wt = Math.max(wall.thickness, WALL_THICKNESS);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 });
      const doorHeight = 210;
      const jamb = 5; // jamb thickness

      // Left jamb
      const ljGeo = new THREE.BoxGeometry(jamb, doorHeight, wt + 2);
      const ljMesh = new THREE.Mesh(ljGeo, frameMat);
      const ljOffset = -door.width / 2 - jamb / 2;
      ljMesh.position.set(
        px + ljOffset * Math.cos(angle),
        doorHeight / 2,
        py + ljOffset * Math.sin(angle)
      );
      ljMesh.rotation.y = -angle;
      ljMesh.castShadow = true;
      wallGroup.add(ljMesh);

      // Right jamb
      const rjMesh = new THREE.Mesh(ljGeo, frameMat);
      const rjOffset = door.width / 2 + jamb / 2;
      rjMesh.position.set(
        px + rjOffset * Math.cos(angle),
        doorHeight / 2,
        py + rjOffset * Math.sin(angle)
      );
      rjMesh.rotation.y = -angle;
      rjMesh.castShadow = true;
      wallGroup.add(rjMesh);

      // Header
      const hGeo = new THREE.BoxGeometry(door.width + jamb * 2, jamb, wt + 2);
      const hMesh = new THREE.Mesh(hGeo, frameMat);
      hMesh.position.set(px, doorHeight + jamb / 2, py);
      hMesh.rotation.y = -angle;
      hMesh.castShadow = true;
      wallGroup.add(hMesh);

      // Door panel — hinged on left side, slightly ajar (15°)
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.5 });
      const panelGeo = new THREE.BoxGeometry(door.width - 2, doorHeight - 4, 4);
      // Shift geometry so pivot is at left edge
      panelGeo.translate(door.width / 2 - 1, 0, 0);
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      // Position at left jamb inner edge
      const hingeOffset = -door.width / 2;
      const swingAngle = 0.26; // ~15 degrees ajar
      const normalX = -Math.sin(angle);
      const normalZ = Math.cos(angle);
      panelMesh.position.set(
        px + hingeOffset * Math.cos(angle) + normalX * 2,
        doorHeight / 2 - 2,
        py + hingeOffset * Math.sin(angle) + normalZ * 2
      );
      panelMesh.rotation.y = -angle + swingAngle;
      panelMesh.castShadow = true;
      wallGroup.add(panelMesh);

      // Door handle (small sphere)
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
      const handleGeo = new THREE.SphereGeometry(3, 8, 8);
      const handleMesh = new THREE.Mesh(handleGeo, handleMat);
      // Place on the door panel's right side at handle height
      const handleLocalX = door.width - 12;
      const handleCos = Math.cos(-angle + swingAngle);
      const handleSin = Math.sin(-angle + swingAngle);
      handleMesh.position.set(
        panelMesh.position.x + handleLocalX * handleCos,
        100,
        panelMesh.position.z - handleLocalX * handleSin
      );
      wallGroup.add(handleMesh);
    }

    // Windows
    for (const win of floor.windows) {
      const wall = floor.walls.find((w) => w.id === win.wallId);
      if (!wall) continue;
      const t = win.position;
      const px = wall.start.x + (wall.end.x - wall.start.x) * t;
      const py = wall.start.y + (wall.end.y - wall.start.y) * t;
      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      const wt = Math.max(wall.thickness, WALL_THICKNESS);
      const winCY = win.sillHeight + win.height / 2;

      const frameMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.4, metalness: 0.1 });
      const mullionW = 4; // mullion bar width

      // Outer frame — 4 bars forming rectangle
      const bars: { w: number; h: number; ox: number; oy: number }[] = [
        { w: win.width + mullionW * 2, h: mullionW, ox: 0, oy: -win.height / 2 - mullionW / 2 }, // bottom
        { w: win.width + mullionW * 2, h: mullionW, ox: 0, oy: win.height / 2 + mullionW / 2 },  // top
        { w: mullionW, h: win.height, ox: -win.width / 2 - mullionW / 2, oy: 0 },  // left
        { w: mullionW, h: win.height, ox: win.width / 2 + mullionW / 2, oy: 0 },   // right
        // Center vertical mullion
        { w: mullionW, h: win.height, ox: 0, oy: 0 },
        // Center horizontal mullion
        { w: win.width, h: mullionW, ox: 0, oy: 0 },
      ];
      for (const bar of bars) {
        const geo = new THREE.BoxGeometry(bar.w, bar.h, mullionW);
        const mesh = new THREE.Mesh(geo, frameMat);
        mesh.position.set(
          px + bar.ox * Math.cos(angle),
          winCY + bar.oy,
          py + bar.ox * Math.sin(angle)
        );
        mesh.rotation.y = -angle;
        wallGroup.add(mesh);
      }

      // Glass panes (4 quadrants)
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xa8d8ea, transparent: true, opacity: 0.3,
        roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide
      });
      const halfW = (win.width - mullionW) / 2;
      const halfH = (win.height - mullionW) / 2;
      for (const qx of [-1, 1]) {
        for (const qy of [-1, 1]) {
          const gGeo = new THREE.BoxGeometry(halfW, halfH, 1);
          const gMesh = new THREE.Mesh(gGeo, glassMat);
          const ox = qx * (halfW / 2 + mullionW / 2);
          gMesh.position.set(
            px + ox * Math.cos(angle),
            winCY + qy * (halfH / 2 + mullionW / 2),
            py + ox * Math.sin(angle)
          );
          gMesh.rotation.y = -angle;
          wallGroup.add(gMesh);
        }
      }

      // Sill — protruding ledge
      const sillGeo = new THREE.BoxGeometry(win.width + 16, 4, wt + 10);
      const sillMesh = new THREE.Mesh(sillGeo, frameMat);
      sillMesh.position.set(px, win.sillHeight - 2, py);
      sillMesh.rotation.y = -angle;
      sillMesh.castShadow = true;
      wallGroup.add(sillMesh);
    }

    // Furniture
    for (const fi of floor.furniture) {
      const cat = getCatalogItem(fi.catalogId);
      if (!cat) continue;
      // Create modified catalog definition with overrides
      const furnitureDef = {
        ...cat,
        color: fi.color ?? cat.color,
        width: fi.width ?? cat.width,
        depth: fi.depth ?? cat.depth,
        height: fi.height ?? cat.height,
      };
      const model = createFurnitureModel(fi.catalogId, furnitureDef);
      model.position.set(fi.position.x, 0, fi.position.y);
      model.rotation.y = -(fi.rotation * Math.PI) / 180;
      if (fi.scale) model.scale.set(fi.scale.x, 1, fi.scale.y);
      wallGroup.add(model);
    }

    // Room floors with materials + floating labels
    const FALLBACK_ROOM_COLORS = [0xbfdbfe, 0xfde68a, 0xbbf7d0, 0xfecaca, 0xddd6fe, 0xa5f3fc, 0xfed7aa];
    const rooms = detectRooms(floor.walls);
    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri];
      const poly = getRoomPolygon(room, floor.walls);
      if (poly.length < 3) continue;

      // Triangulate the polygon using ear-clipping via THREE.ShapeGeometry
      const shape = new THREE.Shape();
      shape.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i].x, poly[i].y);
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      
      // Use room's floor material or fallback to color coding
      let material: THREE.MeshStandardMaterial;
      if (room.floorTexture) {
        const floorMat = getMaterial(room.floorTexture);
        material = new THREE.MeshStandardMaterial({ 
          color: new THREE.Color(floorMat.color), 
          roughness: floorMat.roughness ?? 0.8,
          transparent: false,
          opacity: 1.0
        });
      } else {
        // Fallback to old color system for rooms without specific materials
        const color = FALLBACK_ROOM_COLORS[ri % FALLBACK_ROOM_COLORS.length];
        material = new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.9, 
          transparent: true, 
          opacity: 0.5 
        });
      }
      
      const mesh = new THREE.Mesh(geo, material);
      // Rotate to lie on XZ plane, slightly above base floor
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 1;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Floating room label using sprite
      const centroid = roomCentroid(poly);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx2 = canvas.getContext('2d')!;
      ctx2.fillStyle = 'rgba(0,0,0,0.6)';
      ctx2.roundRect(0, 0, 256, 64, 8);
      ctx2.fill();
      ctx2.fillStyle = '#ffffff';
      ctx2.font = 'bold 22px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(room.name, 128, 26);
      ctx2.font = '16px sans-serif';
      ctx2.fillStyle = '#d1d5db';
      ctx2.fillText(`${room.area} m²`, 128, 50);

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(centroid.x, 30, centroid.y);
      sprite.scale.set(150, 40, 1);
      wallGroup.add(sprite);

      // Ceiling — render at wall height, visible from below
      const defaultWallH = floor.walls.length > 0 ? floor.walls[0].height : 260;
      const ceilMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0,
        roughness: 0.95,
        side: THREE.BackSide // visible from below
      });
      const ceilGeo = new THREE.ShapeGeometry(shape);
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
      ceilMesh.rotation.x = -Math.PI / 2;
      ceilMesh.position.y = defaultWallH;
      ceilMesh.receiveShadow = true;
      wallGroup.add(ceilMesh);
    }

    // Stairs
    buildStairs(floor);

    autoCenterCamera(floor);
  }

  interface WallSegment {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }

  function buildWallSegments(
    wallLen: number, wallH: number, _t: number,
    doors: Door[], windows: Win[]
  ): WallSegment[] {
    type Opening = { pos: number; width: number; bottomY: number; topY: number };
    const openings: Opening[] = [];
    for (const d of doors) {
      openings.push({ pos: d.position * wallLen, width: d.width, bottomY: 0, topY: 210 });
    }
    for (const w of windows) {
      openings.push({ pos: w.position * wallLen, width: w.width, bottomY: w.sillHeight, topY: w.sillHeight + w.height });
    }

    if (openings.length === 0) {
      return [{ width: wallLen, height: wallH, offsetX: wallLen / 2, offsetY: 0 }];
    }

    openings.sort((a, b) => a.pos - b.pos);
    const segs: WallSegment[] = [];
    let cursor = 0;

    for (const op of openings) {
      const left = op.pos - op.width / 2;
      const right = op.pos + op.width / 2;
      if (left > cursor) {
        segs.push({ width: left - cursor, height: wallH, offsetX: cursor + (left - cursor) / 2, offsetY: 0 });
      }
      if (op.topY < wallH) {
        segs.push({ width: op.width, height: wallH - op.topY, offsetX: op.pos, offsetY: op.topY });
      }
      if (op.bottomY > 0) {
        segs.push({ width: op.width, height: op.bottomY, offsetX: op.pos, offsetY: 0 });
      }
      cursor = Math.max(cursor, right);
    }

    if (cursor < wallLen) {
      segs.push({ width: wallLen - cursor, height: wallH, offsetX: cursor + (wallLen - cursor) / 2, offsetY: 0 });
    }

    return segs;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!walkthroughMode) return;
    
    switch (event.code) {
      // Arrows = move
      case 'ArrowUp': moveForward = true; break;
      case 'ArrowDown': moveBackward = true; break;
      case 'ArrowLeft': moveLeft = true; break;
      case 'ArrowRight': moveRight = true; break;
      // WASD = look
      case 'KeyW': lookUp = true; break;
      case 'KeyS': lookDown = true; break;
      case 'KeyA': lookLeft = true; break;
      case 'KeyD': lookRight = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': isShiftHeld = true; break;
      case 'Escape': exitWalkthroughMode(); break;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (!walkthroughMode) return;
    
    switch (event.code) {
      case 'ArrowUp': moveForward = false; break;
      case 'ArrowDown': moveBackward = false; break;
      case 'ArrowLeft': moveLeft = false; break;
      case 'ArrowRight': moveRight = false; break;
      case 'KeyW': lookUp = false; break;
      case 'KeyS': lookDown = false; break;
      case 'KeyA': lookLeft = false; break;
      case 'KeyD': lookRight = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': isShiftHeld = false; break;
    }
  }
  
  function toggleWalkthroughMode() {
    if (walkthroughMode) {
      exitWalkthroughMode();
    } else {
      enterWalkthroughMode();
    }
  }
  
  function enterWalkthroughMode() {
    walkthroughMode = true;
    controls.enabled = false;
    
    // Position camera at eye height in center of floor plan or largest room
    if (currentFloor) {
      const rooms = detectRooms(currentFloor.walls);
      let startPos = { x: 0, y: eyeHeight, z: 0 };
      
      if (rooms.length > 0) {
        // Find largest room and position camera at its center
        let largestRoom = rooms[0];
        let largestArea = 0;
        
        for (const room of rooms) {
          if (room.area > largestArea) {
            largestArea = room.area;
            largestRoom = room;
          }
        }
        
        const poly = getRoomPolygon(largestRoom, currentFloor.walls);
        if (poly.length > 0) {
          const centroid = roomCentroid(poly);
          startPos = { x: centroid.x, y: eyeHeight, z: centroid.y };
        }
      } else if (currentFloor.walls.length > 0) {
        // No rooms, use center of floor plan
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const w of currentFloor.walls) {
          for (const p of [w.start, w.end]) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
          }
        }
        startPos = { x: (minX + maxX) / 2, y: eyeHeight, z: (minZ + maxZ) / 2 };
      }
      
      camera.position.set(startPos.x, startPos.y, startPos.z);
      camera.lookAt(startPos.x, startPos.y, startPos.z - 100); // Look forward initially
    }
    
    pointerControls.lock();
  }
  
  function exitWalkthroughMode() {
    walkthroughMode = false;
    controls.enabled = true;
    velocity.set(0, 0, 0);
    moveForward = moveBackward = moveLeft = moveRight = false;
    lookLeft = lookRight = lookUp = lookDown = false;
    
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    
    if (walkthroughMode) {
      const delta = 0.016; // Approximate 60fps
      const speed = isShiftHeld ? sprintSpeed : moveSpeed;
      
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      
      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize(); // Ensures consistent movement regardless of diagonal movement
      
      if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;
      
      pointerControls.moveRight(-velocity.x * delta);
      pointerControls.moveForward(-velocity.z * delta);
      camera.position.y = eyeHeight; // Keep at eye height

      // WASD look rotation
      if (lookLeft || lookRight) {
        const yaw = ((lookLeft ? 1 : 0) - (lookRight ? 1 : 0)) * LOOK_SPEED * delta;
        camera.rotation.y += yaw;
      }
      if (lookUp || lookDown) {
        const pitch = ((lookUp ? 1 : 0) - (lookDown ? 1 : 0)) * LOOK_SPEED * delta;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x + pitch));
      }
    } else {
      controls.update();
    }
    
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!container || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  onMount(() => {
    init();
    animate();

    // Rebuild 3D scene when photo textures finish loading
    setTextureLoadCallback(() => {
      if (currentFloor) buildWalls(currentFloor);
    });

    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    const unsub = activeFloor.subscribe((f) => {
      currentFloor = f;
      if (f) buildWalls(f);
    });

    return () => {
      resizeObs.disconnect();
      unsub();
      cancelAnimationFrame(animId);
      document.removeEventListener('keydown', onKeyDown, false);
      document.removeEventListener('keyup', onKeyUp, false);
      renderer.dispose();
    };
  });
</script>

<div bind:this={container} class="w-full h-full relative">
  <!-- Walkthrough Mode Toggle Button -->
  <button
    onclick={toggleWalkthroughMode}
    class="absolute top-4 right-4 z-10 bg-black/70 text-white p-2 rounded-lg hover:bg-black/80 transition-colors"
    title={walkthroughMode ? 'Exit Walkthrough Mode' : 'Enter Walkthrough Mode'}
  >
    {#if walkthroughMode}
      <!-- Exit/Eye closed icon -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    {:else}
      <!-- Walking person icon -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="4" r="2"/>
        <path d="M10 16v6"/>
        <path d="M14 16v6"/>
        <path d="M12 6h2l4 4"/>
        <path d="M10 14l2-2 1 2"/>
      </svg>
    {/if}
  </button>

  {#if walkthroughMode}
    <!-- Crosshair -->
    <div class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      <div class="w-4 h-4">
        <svg width="16" height="16" viewBox="0 0 16 16" class="text-white drop-shadow-lg">
          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1"/>
          <line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" stroke-width="1"/>
          <line x1="2" y1="8" x2="6" y2="8" stroke="currentColor" stroke-width="1"/>
          <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1"/>
        </svg>
      </div>
    </div>
    
    <!-- Controls Panel -->
    <div class="absolute top-4 left-4 z-10 bg-black/70 text-white text-xs rounded-lg backdrop-blur-sm p-3 space-y-2 min-w-[180px]">
      <div class="font-semibold text-white/90 mb-1">Walkthrough Controls</div>
      <label class="flex items-center justify-between gap-2">
        <span class="text-white/70">Eye Height</span>
        <div class="flex items-center gap-1">
          <input type="range" min="80" max="220" bind:value={eyeHeight} class="w-16 h-1 accent-blue-400" />
          <span class="w-10 text-right">{eyeHeight}cm</span>
        </div>
      </label>
      <label class="flex items-center justify-between gap-2">
        <span class="text-white/70">Walk Speed</span>
        <div class="flex items-center gap-1">
          <input type="range" min="100" max="1000" step="50" bind:value={moveSpeed} class="w-16 h-1 accent-blue-400" />
          <span class="w-10 text-right">{moveSpeed}</span>
        </div>
      </label>
      <label class="flex items-center justify-between gap-2">
        <span class="text-white/70">Sprint Speed</span>
        <div class="flex items-center gap-1">
          <input type="range" min="200" max="2000" step="100" bind:value={sprintSpeed} class="w-16 h-1 accent-blue-400" />
          <span class="w-10 text-right">{sprintSpeed}</span>
        </div>
      </label>
    </div>

    <!-- Help Text -->
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div class="bg-black/70 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm">
        WASD to look • Arrows to move • Mouse to look • Shift to sprint • ESC to exit
      </div>
    </div>
  {/if}
</div>
