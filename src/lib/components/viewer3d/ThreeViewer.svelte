<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { activeFloor, currentProject, detectedRoomsStore, selectedElementId } from '$lib/stores/project';
  import type { Floor, Wall, Door, Window as Win, Room, Stair } from '$lib/models/types';
  import { wallColors, type WallColor } from '$lib/utils/materials';
  import { projectSettings, formatArea } from '$lib/stores/settings';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
  import MaterialPicker from './MaterialPicker.svelte';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import { createFurnitureModel } from '$lib/utils/furnitureModels3d';
  import { createFurnitureModelWithGLB } from '$lib/utils/furnitureModelLoader';
  import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { getMaterial } from '$lib/utils/materials';
  import { getWallTextureCanvas, getFloorTextureCanvas, setTextureLoadCallback } from '$lib/utils/textureGenerator';

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let pointerControls: PointerLockControls;
  let animId: number;
  let currentFloor: Floor | null = null;
  let savedRooms: Room[] = [];
  let wallGroup: THREE.Group;
  
  // Raycasting for wall selection in 3D
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const wallMeshMap = new Map<THREE.Object3D, string>(); // mesh → wallId
  let selectedWallId3D: string | null = null;
  const originalEmissive = new Map<THREE.Object3D, THREE.Color>();

  // 3D Edit mode — enables click-to-select
  let editMode = $state(false);
  // Material picker state
  let materialPickerPos = $state<{ x: number; y: number } | null>(null);
  let materialPickerWall = $state<Wall | null>(null);
  // Wall transparency toggle
  let wallsTransparent = $state(false);
  // Multi-floor stacking
  let showAllFloors = $state(false);
  const FLOOR_HEIGHT = 300; // cm — wall height + slab thickness

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
  let moveSpeed = $state(800); // cm/s
  let sprintSpeed = $state(1600); // cm/s
  let eyeHeight = $state(160); // cm

  // Lighting controls state
  let lightingPanelOpen = $state(false);
  let sunAzimuth = $state(135);      // 0-360 degrees
  let sunElevation = $state(60);     // 0-90 degrees
  let ambientIntensity = $state(0.35);
  let timeOfDay = $state<'morning' | 'noon' | 'evening' | 'night' | null>(null);

  // Light references
  let ambientLight: THREE.AmbientLight;
  let hemiLight: THREE.HemisphereLight;
  let sunLight: THREE.DirectionalLight;
  let fillLight: THREE.DirectionalLight;
  let rimLight: THREE.DirectionalLight;
  let skyCanvas: HTMLCanvasElement;
  let skyTexture: THREE.CanvasTexture;

  const TIME_PRESETS = {
    morning: { azimuth: 90, elevation: 25, ambient: 0.3, sunColor: 0xffe0a0, sunIntensity: 0.8, skyTop: '#f5a86c', skyMid: '#fdd89b', skyHorizon: '#ffe8c0', hemiSky: '#fdd89b', hemiGround: '#9b8060' },
    noon:    { azimuth: 180, elevation: 80, ambient: 0.45, sunColor: 0xffffff, sunIntensity: 1.2, skyTop: '#3a7bd5', skyMid: '#87ceeb', skyHorizon: '#c8e8f8', hemiSky: '#87ceeb', hemiGround: '#8b7355' },
    evening: { azimuth: 270, elevation: 15, ambient: 0.2, sunColor: 0xff8040, sunIntensity: 0.6, skyTop: '#2d1b69', skyMid: '#c84e3c', skyHorizon: '#f4a460', hemiSky: '#c84e3c', hemiGround: '#4a3520' },
    night:   { azimuth: 0, elevation: 5, ambient: 0.08, sunColor: 0x8899cc, sunIntensity: 0.15, skyTop: '#0a0a2e', skyMid: '#141432', skyHorizon: '#1a1a3e', hemiSky: '#141432', hemiGround: '#0a0a15' },
  };

  function updateSunPosition() {
    if (!sunLight) return;
    const azRad = (sunAzimuth * Math.PI) / 180;
    const elRad = (sunElevation * Math.PI) / 180;
    const dist = 1500;
    sunLight.position.set(
      dist * Math.cos(elRad) * Math.sin(azRad),
      dist * Math.sin(elRad),
      dist * Math.cos(elRad) * Math.cos(azRad)
    );
  }

  function updateAmbientIntensity() {
    if (ambientLight) ambientLight.intensity = ambientIntensity;
  }

  function updateSkyGradient(topColor: string, midColor: string, horizonColor: string) {
    if (!skyCanvas || !skyTexture) return;
    const cx = skyCanvas.getContext('2d')!;
    const grad = cx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, topColor);
    grad.addColorStop(0.4, midColor);
    grad.addColorStop(0.55, horizonColor);
    grad.addColorStop(0.7, '#d4cfc4');
    grad.addColorStop(1.0, '#b8b0a0');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 4, 512);
    skyTexture.needsUpdate = true;
  }

  function applyTimePreset(preset: 'morning' | 'noon' | 'evening' | 'night') {
    const p = TIME_PRESETS[preset];
    timeOfDay = preset;
    sunAzimuth = p.azimuth;
    sunElevation = p.elevation;
    ambientIntensity = p.ambient;
    updateSunPosition();
    updateAmbientIntensity();
    if (sunLight) {
      sunLight.color.set(p.sunColor);
      sunLight.intensity = p.sunIntensity;
    }
    if (hemiLight) {
      hemiLight.color.set(p.hemiSky);
      hemiLight.groundColor.set(p.hemiGround);
      hemiLight.intensity = preset === 'night' ? 0.1 : 0.4;
    }
    if (fillLight) fillLight.intensity = preset === 'night' ? 0.05 : 0.4;
    if (rimLight) rimLight.intensity = preset === 'night' ? 0.05 : 0.25;
    updateSkyGradient(p.skyTop, p.skyMid, p.skyHorizon);
  }

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

    // Sky gradient background (larger for better quality)
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = 4; skyCanvas.height = 512;
    const cx = skyCanvas.getContext('2d')!;
    const grad = cx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#4a90d9');
    grad.addColorStop(0.3, '#87ceeb');
    grad.addColorStop(0.5, '#b8ddf0');
    grad.addColorStop(0.55, '#f0ece4');
    grad.addColorStop(0.7, '#d4cfc4');
    grad.addColorStop(1.0, '#b8b0a0');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 4, 512);
    skyTexture = new THREE.CanvasTexture(skyCanvas);
    scene.background = skyTexture;

    // Ground plane (extends beyond building)
    const groundGeo = new THREE.PlaneGeometry(20000, 20000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd4cfc4,
      roughness: 0.95,
      metalness: 0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.set(800, 600, 800);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
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

    // Click-to-select walls via raycasting
    let pointerDownPos = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      // Only select in edit mode, and only if mouse didn't move much (not a drag/orbit)
      if (!editMode) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 5) return;
      if (walkthroughMode) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(wallGroup.children, false);
      let hitWallId: string | null = null;
      for (const hit of intersects) {
        if (hit.object.userData.wallId) {
          hitWallId = hit.object.userData.wallId;
          break;
        }
      }
      selectedElementId.set(hitWallId);
      
      // Show/hide material picker
      if (hitWallId && currentFloor) {
        const hitWall = currentFloor.walls.find(w => w.id === hitWallId) ?? null;
        materialPickerWall = hitWall;
        materialPickerPos = { x: e.clientX, y: e.clientY };
      } else {
        materialPickerWall = null;
        materialPickerPos = null;
      }
    });

    // Hover highlight in edit mode
    let hoveredMesh: THREE.Mesh | null = null;
    renderer.domElement.addEventListener('mousemove', (e) => {
      if (!editMode) {
        if (hoveredMesh) { hoveredMesh = null; renderer.domElement.style.cursor = ''; }
        return;
      }
      renderer.domElement.style.cursor = 'pointer';
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(wallGroup.children, false);
      const hit = intersects.find(i => i.object.userData.wallId);
      if (hit && hit.object !== hoveredMesh) {
        hoveredMesh = hit.object as THREE.Mesh;
        renderer.domElement.style.cursor = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23fff" stroke="%23000" stroke-width="1.5" d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5a1.49 1.49 0 0 0 2.12 0l5.5-5.5a1.49 1.49 0 0 0 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5a2 2 0 1 0 4 0c0-1.33-2-3.5-2-3.5z"/></svg>') + '") 2 22, pointer';
      } else if (!hit) {
        hoveredMesh = null;
        renderer.domElement.style.cursor = editMode ? 'crosshair' : '';
      }
    });

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
    ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);
    hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.4);
    scene.add(hemiLight);

    // Key light (sun)
    sunLight = new THREE.DirectionalLight(0xfff8e7, 1.0);
    sunLight.position.set(500, 1200, 800);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -1500;
    sunLight.shadow.camera.right = 1500;
    sunLight.shadow.camera.top = 1500;
    sunLight.shadow.camera.bottom = -1500;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Fill light — softer, opposite side to reduce harsh shadows
    fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.4);
    fillLight.position.set(-600, 800, -400);
    scene.add(fillLight);

    // Rim/back light for depth
    rimLight = new THREE.DirectionalLight(0xffe4c4, 0.25);
    rimLight.position.set(-200, 600, 1000);
    scene.add(rimLight);

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

  /** Generate a wall texture. wallWidth/wallHeight in cm to set proper tiling. */
  function generateWallTexture(textureId: string, color: string, wallWidth: number = 300, wallHeight: number = 280): THREE.CanvasTexture {
    const canvas = getWallTextureCanvas(textureId, color);
    if (!canvas) {
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
    // Each texture tile covers ~200cm of real wall
    const tileSizeCm = 200;
    tex.repeat.set(wallWidth / tileSizeCm, wallHeight / tileSizeCm);
    return tex;
  }

  function buildStraightStairRun(group: THREE.Group, mat: THREE.MeshStandardMaterial, sideMat: THREE.MeshStandardMaterial, width: number, depth: number, riserCount: number, riserHeight: number, offsetX: number, offsetY: number, offsetZ: number) {
    const treadDepth = depth / riserCount;
    for (let i = 0; i < riserCount; i++) {
      const treadGeo = new THREE.BoxGeometry(width, 3, treadDepth);
      const tread = new THREE.Mesh(treadGeo, mat);
      tread.position.set(offsetX, offsetY + (i + 1) * riserHeight - 1.5, offsetZ + i * treadDepth + treadDepth / 2);
      tread.castShadow = true;
      tread.receiveShadow = true;
      group.add(tread);

      const riserGeo = new THREE.BoxGeometry(width, riserHeight, 2);
      const riser = new THREE.Mesh(riserGeo, sideMat);
      riser.position.set(offsetX, offsetY + i * riserHeight + riserHeight / 2, offsetZ + i * treadDepth);
      riser.castShadow = true;
      group.add(riser);
    }
  }

  function buildStairs(floor: Floor) {
    if (!floor.stairs) return;
    for (const stair of floor.stairs) {
      const totalHeight = 260; // standard floor height
      const riserHeight = totalHeight / stair.riserCount;
      const mat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
      const sideMat = new THREE.MeshStandardMaterial({ color: 0xb8956a, roughness: 0.8 });
      const type = stair.stairType || 'straight';
      
      const stairGroup = new THREE.Group();
      
      if (type === 'straight') {
        buildStraightStairRun(stairGroup, mat, sideMat, stair.width, stair.depth, stair.riserCount, riserHeight, 0, 0, -stair.depth / 2);

      } else if (type === 'l-shaped') {
        const halfRisers = Math.floor(stair.riserCount / 2);
        const run2Risers = stair.riserCount - halfRisers;
        const run1Depth = stair.depth / 2;
        // First run (along Z)
        buildStraightStairRun(stairGroup, mat, sideMat, stair.width, run1Depth, halfRisers, riserHeight, 0, 0, 0);
        // Landing platform
        const landingY = halfRisers * riserHeight;
        const landGeo = new THREE.BoxGeometry(stair.width, 3, stair.width / 2);
        const landing = new THREE.Mesh(landGeo, mat);
        landing.position.set(0, landingY, -stair.width / 4);
        landing.castShadow = true;
        landing.receiveShadow = true;
        stairGroup.add(landing);
        // Second run (along X, turning right)
        const run2Depth = stair.depth / 2;
        const run2Group = new THREE.Group();
        buildStraightStairRun(run2Group, mat, sideMat, stair.width, run2Depth, run2Risers, riserHeight, 0, 0, 0);
        run2Group.rotation.y = -Math.PI / 2;
        run2Group.position.set(stair.width / 2 + run2Depth / 2, landingY, -stair.width / 2);
        stairGroup.add(run2Group);

      } else if (type === 'u-shaped') {
        const halfRisers = Math.floor(stair.riserCount / 2);
        const run2Risers = stair.riserCount - halfRisers;
        const runW = stair.width * 0.425;
        // First run up
        buildStraightStairRun(stairGroup, mat, sideMat, runW, stair.depth, halfRisers, riserHeight, -stair.width / 2 + runW / 2, 0, -stair.depth / 2);
        // Landing at top
        const landingY = halfRisers * riserHeight;
        const landGeo = new THREE.BoxGeometry(stair.width, 3, runW);
        const landing = new THREE.Mesh(landGeo, mat);
        landing.position.set(0, landingY, -stair.depth / 2 + runW / 2 - 10);
        landing.castShadow = true;
        stairGroup.add(landing);
        // Second run down (reversed direction)
        const run2Group = new THREE.Group();
        buildStraightStairRun(run2Group, mat, sideMat, runW, stair.depth, run2Risers, riserHeight, 0, 0, -stair.depth / 2);
        run2Group.rotation.y = Math.PI;
        run2Group.position.set(stair.width / 2 - runW / 2, landingY, 0);
        stairGroup.add(run2Group);

      } else if (type === 'spiral') {
        const radius = Math.min(stair.width, stair.depth) / 2;
        const postR = radius * 0.1;
        const totalAngle = Math.PI * 1.75;
        // Center post
        const postGeo = new THREE.CylinderGeometry(postR, postR, totalHeight, 8);
        const post = new THREE.Mesh(postGeo, sideMat);
        post.position.set(0, totalHeight / 2, 0);
        post.castShadow = true;
        stairGroup.add(post);
        // Spiral treads as wedge-shaped steps
        for (let i = 0; i < stair.riserCount; i++) {
          const angle = (i / stair.riserCount) * totalAngle;
          const nextAngle = ((i + 1) / stair.riserCount) * totalAngle;
          const y = (i + 1) * riserHeight;
          // Create wedge shape using ExtrudeGeometry
          const shape = new THREE.Shape();
          shape.moveTo(postR * Math.cos(angle), postR * Math.sin(angle));
          shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
          // Arc outer edge
          const arcSteps = 4;
          for (let j = 1; j <= arcSteps; j++) {
            const a = angle + (nextAngle - angle) * (j / arcSteps);
            shape.lineTo(radius * Math.cos(a), radius * Math.sin(a));
          }
          shape.lineTo(postR * Math.cos(nextAngle), postR * Math.sin(nextAngle));
          shape.closePath();
          const extrudeSettings = { depth: 3, bevelEnabled: false };
          const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const tread = new THREE.Mesh(geo, mat);
          tread.rotation.x = -Math.PI / 2;
          tread.position.y = y;
          tread.castShadow = true;
          tread.receiveShadow = true;
          stairGroup.add(tread);
        }
      }
      
      stairGroup.position.set(stair.position.x, 0, stair.position.y);
      stairGroup.rotation.y = -(stair.rotation * Math.PI) / 180;
      if (stair.direction === 'down') {
        stairGroup.rotation.y += Math.PI;
      }
      wallGroup.add(stairGroup);
    }
  }

  function clearGroup(group: THREE.Group) {
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
      group.remove(child);
    }
  }

  function buildWalls(floor: Floor) {
    clearGroup(wallGroup);
    wallMeshMap.clear();

    const defaultInteriorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const defaultExteriorMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc9, roughness: 0.85 });
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.7 });

    for (const wall of floor.walls) {
      // Resolve per-side materials: interior and exterior can have independent color/texture
      const DEFAULT_2D_COLORS = ['#cccccc', '#888888', '#444444', '#404040'];
      const wLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);

      function resolveWallMat(color: string | undefined, texture: string | undefined, fallback: THREE.MeshStandardMaterial, isInterior: boolean = false): THREE.MeshStandardMaterial {
        const polyOff = isInterior ? { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } : {};
        if (texture) {
          const tex = generateWallTexture(texture, color || '#888888', wLen, wall.height);
          return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, ...polyOff });
        }
        if (color && !DEFAULT_2D_COLORS.includes(color.toLowerCase())) {
          return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.9, ...polyOff });
        }
        return fallback;
      }

      // Interior: use interiorColor/interiorTexture if set, else fall back to wall.color/wall.texture
      // 'none' means explicitly no texture (overrides shared wall.texture)
      const intTex = wall.interiorTexture === 'none' ? undefined : (wall.interiorTexture || wall.texture);
      let interiorMat = resolveWallMat(
        wall.interiorColor || wall.color,
        intTex,
        defaultInteriorMat,
        true
      );
      // Exterior: use exteriorColor/exteriorTexture if set, else fall back to wall.color/wall.texture (auto-darkened)
      const extTex = wall.exteriorTexture === 'none' ? undefined : (wall.exteriorTexture || wall.texture);
      let exteriorMat: THREE.MeshStandardMaterial;
      if (extTex || wall.exteriorColor) {
        exteriorMat = resolveWallMat(wall.exteriorColor, extTex, defaultExteriorMat);
      } else if (wall.texture) {
        const extTex = generateWallTexture(wall.texture, wall.color || '#888888', wLen, wall.height);
        exteriorMat = new THREE.MeshStandardMaterial({ map: extTex, roughness: 0.85 });
      } else if (wall.color && !DEFAULT_2D_COLORS.includes(wall.color.toLowerCase())) {
        const c = new THREE.Color(wall.color).offsetHSL(0, -0.05, -0.1);
        exteriorMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
      } else {
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
          mesh.userData.wallId = wall.id;
          wallMeshMap.set(mesh, wall.id);
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
        mesh.userData.wallId = wall.id;
        wallMeshMap.set(mesh, wall.id);
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
      // Skip 2D-only architectural symbols
      if (cat.symbol) continue;
      // Create modified catalog definition with overrides
      const furnitureDef = {
        ...cat,
        color: fi.color ?? cat.color,
        width: fi.width ?? cat.width,
        depth: fi.depth ?? cat.depth,
        height: fi.height ?? cat.height,
      };
      const model = createFurnitureModelWithGLB(fi.catalogId, furnitureDef, () => {
        // Re-render when GLB model finishes loading
        if (renderer && scene && camera) renderer.render(scene, camera);
      });
      model.position.set(fi.position.x, 0, fi.position.y);
      model.rotation.y = -(fi.rotation * Math.PI) / 180;
      // Note: fi.scale is 2D editor scale — don't override 3D model scaling from scaleToFit
      if (fi.scale && (fi.scale.x !== 1 || fi.scale.y !== 1)) {
        model.scale.x *= fi.scale.x;
        model.scale.z *= fi.scale.y;
      }
      wallGroup.add(model);
    }

    // Room floors with materials + floating labels
    const FALLBACK_ROOM_COLORS = [0xbfdbfe, 0xfde68a, 0xbbf7d0, 0xfecaca, 0xddd6fe, 0xa5f3fc, 0xfed7aa];
    // Use detected rooms from the store (which have user-edited names/floorTextures)
    // Fall back to fresh detection if store is empty
    let rooms = savedRooms.length > 0 ? savedRooms : detectRooms(floor.walls);
    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri];
      const poly = getRoomPolygon(room, floor.walls);
      if (poly.length < 3) continue;

      // Triangulate the polygon using ear-clipping via THREE.ShapeGeometry
      const shape = new THREE.Shape();
      // Negate Y so that after -PI/2 X rotation, 2D Y maps to +Z (matching wall coords)
      shape.moveTo(poly[0].x, -poly[0].y);
      for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i].x, -poly[i].y);
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      
      // Compute room bounds for UV normalization (using negated Y to match shape coords)
      const bounds = poly.reduce((b, p) => ({
        minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
        minY: Math.min(b.minY, -p.y), maxY: Math.max(b.maxY, -p.y),
      }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      const roomW = bounds.maxX - bounds.minX;
      const roomH = bounds.maxY - bounds.minY;

      // Normalize ShapeGeometry UVs from world coords to [0,1] range
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < uvAttr.count; i++) {
        const u = (uvAttr.getX(i) - bounds.minX) / (roomW || 1);
        const v = (uvAttr.getY(i) - bounds.minY) / (roomH || 1);
        uvAttr.setXY(i, u, v);
      }
      uvAttr.needsUpdate = true;

      // Use room's floor material or fallback to color coding
      let material: THREE.MeshStandardMaterial;
      if (room.floorTexture) {
        const floorMat = getMaterial(room.floorTexture);
        const floorCanvas = getFloorTextureCanvas(room.floorTexture);
        if (floorCanvas) {
          const tex = new THREE.CanvasTexture(floorCanvas);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          // Tile every 200cm — now UVs are 0-1, so repeat = room size / tile size
          const tileSizeCm = 200;
          tex.repeat.set(roomW / tileSizeCm, roomH / tileSizeCm);
          material = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: floorMat.roughness ?? 0.8,
            transparent: false,
            opacity: 1.0
          });
        } else {
          material = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(floorMat.color), 
            roughness: floorMat.roughness ?? 0.8,
            transparent: false,
            opacity: 1.0
          });
        }
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
      ctx2.fillText(formatArea(room.area, get(projectSettings).units), 128, 50);

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

  /** Build all floors stacked vertically in 3D */
  function buildAllFloorsStacked() {
    const project = get(currentProject);
    if (!project || project.floors.length === 0) return;
    
    // Use buildWalls for the active floor first (it clears wallGroup)
    const activeF = project.floors.find(f => f.id === project.activeFloorId) ?? project.floors[0];
    buildWalls(activeF);
    
    // Now add other floors at Y offsets
    for (let i = 0; i < project.floors.length; i++) {
      const floor = project.floors[i];
      if (floor.id === activeF.id) {
        // Active floor is already built at Y=0, move it to its correct offset
        // We need to offset all current wallGroup children
        const yOffset = i * FLOOR_HEIGHT;
        if (yOffset !== 0) {
          // Move existing children up
          for (const child of [...wallGroup.children]) {
            child.position.y += yOffset;
          }
        }
        // Add floor label
        addFloorLabel(i, floor.name || (i === 0 ? 'Ground Floor' : `Floor ${i}`), i * FLOOR_HEIGHT);
        continue;
      }
      
      // Build non-active floor into a temporary group, then merge with transparency
      const tempGroup = new THREE.Group();
      buildFloorIntoGroup(floor, tempGroup, i * FLOOR_HEIGHT, 0.35);
      
      // Add floor label
      addFloorLabel(i, floor.name || (i === 0 ? 'Ground Floor' : `Floor ${i}`), i * FLOOR_HEIGHT);
      
      // Move children from temp group to wallGroup
      while (tempGroup.children.length > 0) {
        const child = tempGroup.children[0];
        tempGroup.remove(child);
        wallGroup.add(child);
      }
    }
    
    // Re-center camera to encompass all floors
    autoCenterCameraAllFloors(project.floors.length);
  }
  
  function addFloorLabel(floorIndex: number, name: string, yOffset: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.roundRect(0, 0, 256, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 32);
    
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    
    // Position label to the side of the building
    const box = new THREE.Box3().setFromObject(wallGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    sprite.position.set(center.x - size.x / 2 - 200, yOffset + 130, center.z);
    sprite.scale.set(200, 40, 1);
    wallGroup.add(sprite);
  }
  
  /** Build a single floor's walls/doors/windows into a group at a Y offset with optional transparency */
  function buildFloorIntoGroup(floor: Floor, group: THREE.Group, yOffset: number, opacity: number) {
    const transparentMat = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({
      color, roughness, transparent: true, opacity,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    
    const defaultInteriorMat = transparentMat(0xffffff);
    const defaultExteriorMat = transparentMat(0xd4cfc9, 0.85);

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

      const materials = [
        defaultExteriorMat, defaultExteriorMat,
        defaultInteriorMat, defaultInteriorMat,
        defaultInteriorMat, defaultExteriorMat,
      ];

      for (const seg of segments) {
        const geo = new THREE.BoxGeometry(seg.width, seg.height, t);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const localX = seg.offsetX - len / 2;
        mesh.position.set(
          cx + localX * Math.cos(angle),
          seg.height / 2 + seg.offsetY + yOffset,
          cy + localX * Math.sin(angle)
        );
        mesh.rotation.y = -angle;
        group.add(mesh);
      }
    }
    
    // Simple floor slab
    if (floor.walls.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const w of floor.walls) {
        for (const p of [w.start, w.end]) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
        }
      }
      const slabGeo = new THREE.BoxGeometry(maxX - minX + 40, 5, maxZ - minZ + 40);
      const slabMat = transparentMat(0xcccccc, 0.95);
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set((minX + maxX) / 2, yOffset, (minZ + maxZ) / 2);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }
  
  function autoCenterCameraAllFloors(floorCount: number) {
    const box = new THREE.Box3().setFromObject(wallGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 400);
    controls.target.copy(center);
    camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 0.8, center.z + maxDim * 1.2);
    controls.update();
  }
  
  function rebuildScene() {
    if (showAllFloors) {
      buildAllFloorsStacked();
    } else if (currentFloor) {
      buildWalls(currentFloor);
    }
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
    // ESC exits edit mode
    if (event.code === 'Escape' && editMode && !walkthroughMode) {
      if (materialPickerWall) {
        materialPickerWall = null;
        materialPickerPos = null;
        return;
      }
      editMode = false;
      selectedElementId.set(null);
      return;
    }
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
  
  function toggleWallTransparency() {
    wallsTransparent = !wallsTransparent;
    wallGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.transparent = wallsTransparent;
        child.material.opacity = wallsTransparent ? 0.3 : 1.0;
        child.material.needsUpdate = true;
      }
    });
  }

  function viewTopDown() {
    // Calculate center of the plan
    const box = new THREE.Box3().setFromObject(wallGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, 500);
    
    // Animate camera to top-down position
    camera.position.set(center.x, maxDim * 1.5, center.z);
    controls.target.set(center.x, 0, center.z);
    controls.update();
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

  function takeScreenshot() {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'floorplan-3d.png';
    link.href = dataUrl;
    link.click();
  }

  onMount(() => {
    init();
    animate();

    // Rebuild 3D scene when photo textures finish loading
    setTextureLoadCallback(() => {
      if (currentFloor) rebuildScene();
    });

    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    const unsub = activeFloor.subscribe((f) => {
      currentFloor = f;
      if (f) rebuildScene();
    });

    const unsubRooms = detectedRoomsStore.subscribe((rooms) => {
      savedRooms = rooms;
    });

    // Highlight selected wall in 3D
    // Store original materials so we can restore them (shared materials must not be mutated)
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const unsubSel = selectedElementId.subscribe((id) => {
      // Restore previously highlighted meshes to their original materials
      for (const [mesh, origMat] of originalMaterials) {
        mesh.material = origMat;
      }
      originalMaterials.clear();
      originalEmissive.clear();
      selectedWallId3D = id;
      if (!id) return;
      // Highlight matching wall meshes by cloning their materials
      for (const [mesh, wallId] of wallMeshMap) {
        if (wallId === id && mesh instanceof THREE.Mesh) {
          originalMaterials.set(mesh, mesh.material);
          // Clone materials so we don't mutate shared instances
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m: THREE.Material) => {
              const cloned = m.clone();
              if (cloned instanceof THREE.MeshStandardMaterial) {
                cloned.emissive.set(0x3388ff);
                cloned.emissiveIntensity = 0.3;
              }
              return cloned;
            });
          } else {
            const cloned = mesh.material.clone();
            if (cloned instanceof THREE.MeshStandardMaterial) {
              cloned.emissive.set(0x3388ff);
              cloned.emissiveIntensity = 0.3;
            }
            mesh.material = cloned;
          }
        }
      }
    });

    return () => {
      resizeObs.disconnect();
      unsub();
      unsubRooms();
      unsubSel();
      cancelAnimationFrame(animId);
      document.removeEventListener('keydown', onKeyDown, false);
      document.removeEventListener('keyup', onKeyUp, false);
      renderer.dispose();
    };
  });
</script>

<div bind:this={container} class="w-full h-full relative">
  <!-- Multi-Floor Stacking Toggle -->
  <button
    onclick={() => { showAllFloors = !showAllFloors; rebuildScene(); }}
    class="absolute top-4 right-64 z-50 p-2 rounded-lg transition-colors {showAllFloors ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-black/70 text-white hover:bg-black/80'}"
    title={showAllFloors ? 'Active Floor Only' : 'Show All Floors Stacked'}
    aria-label={showAllFloors ? 'Active Floor Only' : 'Show All Floors Stacked'}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="4" y="14" width="16" height="4" rx="1"/>
      <rect x="4" y="8" width="16" height="4" rx="1" opacity="0.6"/>
      <rect x="4" y="2" width="16" height="4" rx="1" opacity="0.3"/>
    </svg>
  </button>

  <!-- Top-Down View Button -->
  <button
    onclick={viewTopDown}
    class="absolute top-4 right-52 z-50 bg-black/70 text-white p-2 rounded-lg hover:bg-black/80 transition-colors"
    title="Top-Down View"
    aria-label="Top-Down View"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  </button>

  <!-- Wall Transparency Toggle -->
  <button
    onclick={toggleWallTransparency}
    class="absolute top-4 right-40 z-50 p-2 rounded-lg transition-colors {wallsTransparent ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-black/70 text-white hover:bg-black/80'}"
    title={wallsTransparent ? 'Show Solid Walls' : 'Make Walls Transparent'}
    aria-label={wallsTransparent ? 'Show Solid Walls' : 'Make Walls Transparent'}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" opacity={wallsTransparent ? 0.3 : 1}/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="12" y1="3" x2="12" y2="21"/>
    </svg>
  </button>

  <!-- Edit Mode Toggle -->
  <button
    onclick={() => { editMode = !editMode; if (editMode && walkthroughMode) { exitWalkthroughMode(); } if (!editMode) { selectedElementId.set(null); materialPickerWall = null; materialPickerPos = null; } }}
    class="absolute top-4 right-28 z-50 p-2 rounded-lg transition-colors {editMode ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-black/70 text-white hover:bg-black/80'}"
    title={editMode ? 'Exit Edit Mode' : 'Edit Mode — click to select walls & change materials'}
    aria-label={editMode ? 'Exit Edit Mode' : 'Edit Mode'}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>

  <!-- 3D Screenshot Button -->
  <button
    onclick={takeScreenshot}
    class="absolute top-4 right-16 z-50 bg-black/70 text-white p-2 rounded-lg hover:bg-black/80 transition-colors"
    title="Save 3D Screenshot"
    aria-label="Save 3D Screenshot"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  </button>

  <!-- Walkthrough Mode Toggle Button -->
  <button
    onclick={toggleWalkthroughMode}
    class="absolute top-4 right-4 z-50 bg-black/70 text-white p-2 rounded-lg hover:bg-black/80 transition-colors"
    title={walkthroughMode ? 'Exit Walkthrough Mode' : 'Enter Walkthrough Mode'}
    aria-label={walkthroughMode ? 'Exit Walkthrough Mode' : 'Enter Walkthrough Mode'}
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

  {#if editMode && !walkthroughMode}
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div class="bg-blue-600/90 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        🪣 Click walls to paint materials • ESC to close picker or exit
      </div>
    </div>
  {/if}

  {#if materialPickerWall && materialPickerPos && editMode}
    <MaterialPicker
      wall={materialPickerWall}
      screenX={materialPickerPos.x}
      screenY={materialPickerPos.y}
      onclose={() => { materialPickerWall = null; materialPickerPos = null; }}
    />
  {/if}

  <!-- Lighting Controls Toggle Button -->
  <button
    onclick={() => { lightingPanelOpen = !lightingPanelOpen; }}
    class="absolute bottom-4 left-4 z-50 p-2 rounded-lg transition-colors {lightingPanelOpen ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-black/70 text-white hover:bg-black/80'}"
    title="Lighting Controls"
    aria-label="Lighting Controls"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  </button>

  <!-- Lighting Controls Panel -->
  {#if lightingPanelOpen}
    <div class="absolute bottom-14 left-4 z-50 bg-black/80 text-white text-xs rounded-lg backdrop-blur-sm p-3 space-y-3 min-w-[220px] select-none">
      <div class="font-semibold text-white/90 text-sm flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
        Lighting Controls
      </div>

      <!-- Time of Day Presets -->
      <div class="space-y-1">
        <span class="text-white/60 text-[10px] uppercase tracking-wide">Time of Day</span>
        <div class="flex gap-1">
          {#each (['morning', 'noon', 'evening', 'night'] as const) as preset}
            <button
              onclick={() => applyTimePreset(preset)}
              class="flex-1 px-1.5 py-1 rounded text-[11px] transition-colors {timeOfDay === preset ? 'bg-amber-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'}"
            >
              {preset === 'morning' ? '🌅' : preset === 'noon' ? '☀️' : preset === 'evening' ? '🌇' : '🌙'}
              <span class="block capitalize">{preset}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Sun Position -->
      <label class="block space-y-0.5">
        <div class="flex justify-between text-white/60">
          <span>Sun Position</span><span>{sunAzimuth}°</span>
        </div>
        <input type="range" min="0" max="360" bind:value={sunAzimuth} oninput={() => { timeOfDay = null; updateSunPosition(); }} class="w-full h-1 accent-amber-400" />
      </label>

      <!-- Sun Elevation -->
      <label class="block space-y-0.5">
        <div class="flex justify-between text-white/60">
          <span>Sun Elevation</span><span>{sunElevation}°</span>
        </div>
        <input type="range" min="0" max="90" bind:value={sunElevation} oninput={() => { timeOfDay = null; updateSunPosition(); }} class="w-full h-1 accent-amber-400" />
      </label>

      <!-- Ambient Intensity -->
      <label class="block space-y-0.5">
        <div class="flex justify-between text-white/60">
          <span>Ambient Light</span><span>{Math.round(ambientIntensity * 100)}%</span>
        </div>
        <input type="range" min="0" max="100" value={Math.round(ambientIntensity * 100)} oninput={(e) => { ambientIntensity = parseInt(e.currentTarget.value) / 100; timeOfDay = null; updateAmbientIntensity(); }} class="w-full h-1 accent-blue-400" />
      </label>
    </div>
  {/if}
</div>
