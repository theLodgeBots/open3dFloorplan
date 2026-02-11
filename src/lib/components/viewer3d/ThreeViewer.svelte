<script lang="ts">
  import { onMount } from 'svelte';
  import { activeFloor } from '$lib/stores/project';
  import type { Floor, Wall, Door, Window as Win } from '$lib/models/types';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let animId: number;
  let currentFloor: Floor | null = null;
  let wallGroup: THREE.Group;

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

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(500, 1200, 800);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -1500;
    dir.shadow.camera.right = 1500;
    dir.shadow.camera.top = 1500;
    dir.shadow.camera.bottom = -1500;
    scene.add(dir);

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
    camera.position.set(cx + size * 0.8, size * 0.7, cz + size * 0.8);
    controls.update();
  }

  function buildWalls(floor: Floor) {
    while (wallGroup.children.length) wallGroup.remove(wallGroup.children[0]);

    const interiorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const exteriorMat = new THREE.MeshStandardMaterial({ color: 0x9e8e7e, roughness: 0.85 });
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.7 });

    for (const wall of floor.walls) {
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

      // Baseboard
      const bbGeo = new THREE.BoxGeometry(len, BASEBOARD_HEIGHT, t + 2);
      const bbMesh = new THREE.Mesh(bbGeo, baseboardMat);
      bbMesh.position.set(cx, BASEBOARD_HEIGHT / 2, cy);
      bbMesh.rotation.y = -angle;
      bbMesh.castShadow = true;
      wallGroup.add(bbMesh);
    }

    // Doors
    for (const door of floor.doors) {
      const wall = floor.walls.find((w) => w.id === door.wallId);
      if (!wall) continue;
      const t = door.position;
      const px = wall.start.x + (wall.end.x - wall.start.x) * t;
      const py = wall.start.y + (wall.end.y - wall.start.y) * t;
      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

      // Door frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 });
      const frameGeo = new THREE.BoxGeometry(door.width + 10, 210, 5);
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(px, 105, py);
      frameMesh.rotation.y = -angle;
      frameMesh.castShadow = true;
      wallGroup.add(frameMesh);

      // Door panel
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.5 });
      const panelGeo = new THREE.BoxGeometry(door.width - 4, 205, 3);
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.set(px, 103, py);
      panelMesh.rotation.y = -angle;
      wallGroup.add(panelMesh);
    }

    // Windows
    for (const win of floor.windows) {
      const wall = floor.walls.find((w) => w.id === win.wallId);
      if (!wall) continue;
      const t = win.position;
      const px = wall.start.x + (wall.end.x - wall.start.x) * t;
      const py = wall.start.y + (wall.end.y - wall.start.y) * t;
      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

      // Glass
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
      const glassGeo = new THREE.BoxGeometry(win.width, win.height, 3);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(px, win.sillHeight + win.height / 2, py);
      glassMesh.rotation.y = -angle;
      wallGroup.add(glassMesh);

      // Frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
      const frameGeo = new THREE.BoxGeometry(win.width + 8, win.height + 8, 5);
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(px, win.sillHeight + win.height / 2, py);
      frameMesh.rotation.y = -angle;
      wallGroup.add(frameMesh);

      // Sill
      const sillGeo = new THREE.BoxGeometry(win.width + 16, 4, 12);
      const sillMesh = new THREE.Mesh(sillGeo, frameMat);
      sillMesh.position.set(px, win.sillHeight - 2, py);
      sillMesh.rotation.y = -angle;
      wallGroup.add(sillMesh);
    }

    // Furniture
    for (const fi of floor.furniture) {
      const cat = getCatalogItem(fi.catalogId);
      if (!cat) continue;
      const mat = new THREE.MeshStandardMaterial({ color: cat.color, roughness: 0.7 });
      const geo = new THREE.BoxGeometry(cat.width, cat.height, cat.depth);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(fi.position.x, cat.height / 2, fi.position.y);
      mesh.rotation.y = -(fi.rotation * Math.PI) / 180;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Edge outline
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 });
      const line = new THREE.LineSegments(edges, lineMat);
      line.position.copy(mesh.position);
      line.rotation.copy(mesh.rotation);
      wallGroup.add(line);
    }

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

  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
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
      renderer.dispose();
    };
  });
</script>

<div bind:this={container} class="w-full h-full"></div>
