import * as THREE from 'three';
import type { FurnitureDef } from './furnitureCatalog';

// Helper to darken/lighten colors
function adjustColor(color: string, factor: number): number {
  const tempColor = new THREE.Color(color);
  tempColor.multiplyScalar(factor);
  return tempColor.getHex();
}

// Helper to create standard material
function createMaterial(color: string, roughness = 0.7, metalness = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

// Helper to add shadow casting to all meshes in a group
function enableShadows(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function createFurnitureModel(catalogId: string, def: FurnitureDef): THREE.Group {
  const group = new THREE.Group();
  const { width, depth, height, color } = def;
  
  // Convert cm to Three.js units (assuming 1 unit = 1cm)
  const w = width;
  const d = depth; 
  const h = height;

  switch (catalogId) {
    case 'sofa':
      createSofa(group, w, d, h, color);
      break;
    case 'loveseat':
      createLoveseat(group, w, d, h, color);
      break;
    case 'chair':
      createArmchair(group, w, d, h, color);
      break;
    case 'coffee_table':
      createCoffeeTable(group, w, d, h, color);
      break;
    case 'tv_stand':
      createTVStand(group, w, d, h, color);
      break;
    case 'bookshelf':
      createBookshelf(group, w, d, h, color);
      break;
    case 'side_table':
      createSideTable(group, w, d, h, color);
      break;
    case 'bed_queen':
      createBed(group, w, d, h, color, 'queen');
      break;
    case 'bed_twin':
      createBed(group, w, d, h, color, 'twin');
      break;
    case 'nightstand':
      createNightstand(group, w, d, h, color);
      break;
    case 'dresser':
      createDresser(group, w, d, h, color);
      break;
    case 'wardrobe':
      createWardrobe(group, w, d, h, color);
      break;
    case 'stove':
      createStove(group, w, d, h, color);
      break;
    case 'fridge':
      createFridge(group, w, d, h, color);
      break;
    case 'sink_k':
      createKitchenSink(group, w, d, h, color);
      break;
    case 'counter':
      createCounter(group, w, d, h, color);
      break;
    case 'dishwasher':
      createDishwasher(group, w, d, h, color);
      break;
    case 'toilet':
      createToilet(group, w, d, h, color);
      break;
    case 'bathtub':
      createBathtub(group, w, d, h, color);
      break;
    case 'shower':
      createShower(group, w, d, h, color);
      break;
    case 'sink_b':
      createBathroomSink(group, w, d, h, color);
      break;
    case 'desk':
      createDesk(group, w, d, h, color);
      break;
    case 'office_chair':
      createOfficeChair(group, w, d, h, color);
      break;
    case 'dining_table':
      createDiningTable(group, w, d, h, color);
      break;
    case 'dining_chair':
      createDiningChair(group, w, d, h, color);
      break;
    default:
      // Fallback to simple box
      const geometry = new THREE.BoxGeometry(w, h, d);
      const material = createMaterial(color);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = h / 2;
      group.add(mesh);
      break;
  }

  enableShadows(group);
  return group;
}

// Living Room furniture
function createSofa(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const baseColor = createMaterial(color);
  const darkColor = createMaterial(color, 0.7, 0.1);
  darkColor.color.multiplyScalar(0.9);

  // Main seat base
  const seatGeo = new THREE.BoxGeometry(w * 0.9, h * 0.5, d * 0.7);
  const seatMesh = new THREE.Mesh(seatGeo, baseColor);
  seatMesh.position.set(0, h * 0.25, d * 0.05);
  group.add(seatMesh);

  // Back cushions (3 bumps) — at negative Z (back/top in 2D)
  const cushionWidth = w * 0.25;
  for (let i = 0; i < 3; i++) {
    const cushionGeo = new THREE.BoxGeometry(cushionWidth, h * 0.6, d * 0.25);
    const cushionMesh = new THREE.Mesh(cushionGeo, baseColor);
    cushionMesh.position.set(-w * 0.3 + i * cushionWidth, h * 0.55, -d * 0.3);
    group.add(cushionMesh);
  }

  // Left armrest
  const armGeo = new THREE.BoxGeometry(w * 0.15, h * 0.8, d * 0.8);
  const leftArm = new THREE.Mesh(armGeo, darkColor);
  leftArm.position.set(-w * 0.425, h * 0.4, 0);
  group.add(leftArm);

  // Right armrest
  const rightArm = new THREE.Mesh(armGeo, darkColor);
  rightArm.position.set(w * 0.425, h * 0.4, 0);
  group.add(rightArm);
}

function createLoveseat(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const baseColor = createMaterial(color);
  const darkColor = createMaterial(color, 0.7, 0.1);
  darkColor.color.multiplyScalar(0.9);

  // Main seat base
  const seatGeo = new THREE.BoxGeometry(w * 0.9, h * 0.5, d * 0.7);
  const seatMesh = new THREE.Mesh(seatGeo, baseColor);
  seatMesh.position.set(0, h * 0.25, d * 0.05);
  group.add(seatMesh);

  // Back cushions (2 bumps for loveseat) — at negative Z (back/top in 2D)
  const cushionWidth = w * 0.35;
  for (let i = 0; i < 2; i++) {
    const cushionGeo = new THREE.BoxGeometry(cushionWidth, h * 0.6, d * 0.25);
    const cushionMesh = new THREE.Mesh(cushionGeo, baseColor);
    cushionMesh.position.set(-w * 0.175 + i * cushionWidth, h * 0.55, -d * 0.3);
    group.add(cushionMesh);
  }

  // Armrests
  const armGeo = new THREE.BoxGeometry(w * 0.15, h * 0.8, d * 0.8);
  const leftArm = new THREE.Mesh(armGeo, darkColor);
  leftArm.position.set(-w * 0.425, h * 0.4, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, darkColor);
  rightArm.position.set(w * 0.425, h * 0.4, 0);
  group.add(rightArm);
}

function createArmchair(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const baseColor = createMaterial(color);
  const darkColor = createMaterial(color, 0.7, 0.1);
  darkColor.color.multiplyScalar(0.9);

  // Seat
  const seatGeo = new THREE.BoxGeometry(w * 0.7, h * 0.4, d * 0.7);
  const seatMesh = new THREE.Mesh(seatGeo, baseColor);
  seatMesh.position.set(0, h * 0.2, d * 0.05);
  group.add(seatMesh);

  // Back — at negative Z (back/top in 2D)
  const backGeo = new THREE.BoxGeometry(w * 0.7, h * 0.6, d * 0.15);
  const backMesh = new THREE.Mesh(backGeo, baseColor);
  backMesh.position.set(0, h * 0.5, -d * 0.35);
  group.add(backMesh);

  // Armrests
  const armGeo = new THREE.BoxGeometry(w * 0.2, h * 0.5, d * 0.6);
  const leftArm = new THREE.Mesh(armGeo, darkColor);
  leftArm.position.set(-w * 0.35, h * 0.35, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, darkColor);
  rightArm.position.set(w * 0.35, h * 0.35, 0);
  group.add(rightArm);
}

function createCoffeeTable(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const topColor = createMaterial(color);
  const legColor = createMaterial(color, 0.7, 0.1);
  legColor.color.multiplyScalar(0.8);

  // Table top
  const topGeo = new THREE.BoxGeometry(w, h * 0.2, d);
  const topMesh = new THREE.Mesh(topGeo, topColor);
  topMesh.position.set(0, h * 0.9, 0);
  group.add(topMesh);

  // 4 legs
  const legGeo = new THREE.BoxGeometry(w * 0.05, h * 0.8, d * 0.05);
  const positions = [
    [-w * 0.4, h * 0.4, -d * 0.4],
    [w * 0.4, h * 0.4, -d * 0.4],
    [-w * 0.4, h * 0.4, d * 0.4],
    [w * 0.4, h * 0.4, d * 0.4]
  ];

  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legColor);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  });
}

function createTVStand(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const cabinetColor = createMaterial(color);
  const screenColor = createMaterial('#1a1a1a', 0.1, 0.8);

  // Cabinet base
  const cabinetGeo = new THREE.BoxGeometry(w, h * 0.8, d);
  const cabinetMesh = new THREE.Mesh(cabinetGeo, cabinetColor);
  cabinetMesh.position.set(0, h * 0.4, 0);
  group.add(cabinetMesh);

  // TV screen on top
  const screenGeo = new THREE.BoxGeometry(w * 0.7, h * 0.8, d * 0.05);
  const screenMesh = new THREE.Mesh(screenGeo, screenColor);
  screenMesh.position.set(0, h * 1.2, -d * 0.1);
  group.add(screenMesh);
}

function createBookshelf(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const shelfColor = createMaterial(color);
  const darkColor = createMaterial(color, 0.7, 0.1);
  darkColor.color.multiplyScalar(0.9);

  // Main frame
  const frameGeo = new THREE.BoxGeometry(w, h, d);
  const frameMesh = new THREE.Mesh(frameGeo, shelfColor);
  frameMesh.position.set(0, h / 2, 0);
  group.add(frameMesh);

  // 5 horizontal shelves
  const shelfThickness = h * 0.05;
  for (let i = 0; i < 5; i++) {
    const shelfGeo = new THREE.BoxGeometry(w * 0.95, shelfThickness, d * 0.9);
    const shelf = new THREE.Mesh(shelfGeo, darkColor);
    shelf.position.set(0, (i + 0.5) * (h / 5), 0);
    group.add(shelf);
  }
}

function createSideTable(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const topColor = createMaterial(color);
  const legColor = createMaterial(color, 0.7, 0.1);
  legColor.color.multiplyScalar(0.8);

  // Table top (round)
  const topGeo = new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h * 0.15);
  const topMesh = new THREE.Mesh(topGeo, topColor);
  topMesh.position.set(0, h * 0.925, 0);
  group.add(topMesh);

  // Central leg
  const legGeo = new THREE.CylinderGeometry(w * 0.05, w * 0.05, h * 0.85);
  const legMesh = new THREE.Mesh(legGeo, legColor);
  legMesh.position.set(0, h * 0.425, 0);
  group.add(legMesh);
}

// Bedroom furniture
function createBed(group: THREE.Group, w: number, d: number, h: number, color: string, type: 'queen' | 'twin'): void {
  const mattressColor = createMaterial(color);
  const headboardColor = createMaterial(color, 0.7, 0.1);
  headboardColor.color.multiplyScalar(0.8);
  const pillowColor = createMaterial('#ffffff', 0.9, 0.0);

  // Mattress
  const mattressGeo = new THREE.BoxGeometry(w, h, d);
  const mattressMesh = new THREE.Mesh(mattressGeo, mattressColor);
  mattressMesh.position.set(0, h / 2, 0);
  group.add(mattressMesh);

  // Headboard — at negative Z (top/back in 2D)
  const headboardGeo = new THREE.BoxGeometry(w, h * 1.8, d * 0.1);
  const headboardMesh = new THREE.Mesh(headboardGeo, headboardColor);
  headboardMesh.position.set(0, h * 0.9, -d * 0.45);
  group.add(headboardMesh);

  // Pillows — near headboard (negative Z)
  const pillowCount = type === 'queen' ? 2 : 1;
  const pillowWidth = w / (pillowCount + 1);
  for (let i = 0; i < pillowCount; i++) {
    const pillowGeo = new THREE.BoxGeometry(pillowWidth * 0.8, h * 0.4, d * 0.3);
    const pillowMesh = new THREE.Mesh(pillowGeo, pillowColor);
    const xOffset = pillowCount === 1 ? 0 : (i - 0.5) * pillowWidth;
    pillowMesh.position.set(xOffset, h * 0.7, -d * 0.25);
    group.add(pillowMesh);
  }
}

function createNightstand(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color);
  const drawerColor = createMaterial(color, 0.7, 0.1);
  drawerColor.color.multiplyScalar(0.9);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // Drawer line
  const drawerGeo = new THREE.BoxGeometry(w * 0.9, h * 0.05, d * 0.02);
  const drawerMesh = new THREE.Mesh(drawerGeo, drawerColor);
  drawerMesh.position.set(0, h * 0.7, d * 0.5);
  group.add(drawerMesh);

  // Drawer handle
  const handleGeo = new THREE.BoxGeometry(w * 0.1, h * 0.03, d * 0.02);
  const handleMesh = new THREE.Mesh(handleGeo, drawerColor);
  handleMesh.position.set(0, h * 0.7, d * 0.51);
  group.add(handleMesh);
}

function createDresser(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color);
  const drawerColor = createMaterial(color, 0.7, 0.1);
  drawerColor.color.multiplyScalar(0.9);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // 4 drawer lines
  for (let i = 0; i < 4; i++) {
    const drawerY = h * (0.2 + i * 0.2);
    const drawerGeo = new THREE.BoxGeometry(w * 0.9, h * 0.03, d * 0.02);
    const drawerMesh = new THREE.Mesh(drawerGeo, drawerColor);
    drawerMesh.position.set(0, drawerY, d * 0.5);
    group.add(drawerMesh);

    // Handle
    const handleGeo = new THREE.BoxGeometry(w * 0.1, h * 0.02, d * 0.02);
    const handleMesh = new THREE.Mesh(handleGeo, drawerColor);
    handleMesh.position.set(0, drawerY, d * 0.51);
    group.add(handleMesh);
  }
}

function createWardrobe(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color);
  const doorColor = createMaterial(color, 0.7, 0.1);
  doorColor.color.multiplyScalar(0.95);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // Vertical split line (2 doors)
  const splitGeo = new THREE.BoxGeometry(w * 0.02, h * 0.9, d * 0.02);
  const splitMesh = new THREE.Mesh(splitGeo, doorColor);
  splitMesh.position.set(0, h / 2, d * 0.5);
  group.add(splitMesh);

  // Door knobs
  const knobGeo = new THREE.SphereGeometry(w * 0.02);
  const knobMaterial = createMaterial('#333333', 0.3, 0.8);
  
  const leftKnob = new THREE.Mesh(knobGeo, knobMaterial);
  leftKnob.position.set(-w * 0.3, h * 0.6, d * 0.52);
  group.add(leftKnob);

  const rightKnob = new THREE.Mesh(knobGeo, knobMaterial);
  rightKnob.position.set(w * 0.3, h * 0.6, d * 0.52);
  group.add(rightKnob);
}

// Kitchen furniture
function createStove(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color, 0.5, 0.3);
  const burnerColor = createMaterial('#1a1a1a', 0.3, 0.7);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // 4 burners on top
  const burnerRadius = Math.min(w, d) * 0.12;
  const burnerGeo = new THREE.CylinderGeometry(burnerRadius, burnerRadius, h * 0.02);
  
  const positions = [
    [-w * 0.25, h, -d * 0.25],
    [w * 0.25, h, -d * 0.25],
    [-w * 0.25, h, d * 0.25],
    [w * 0.25, h, d * 0.25]
  ];

  positions.forEach(pos => {
    const burner = new THREE.Mesh(burnerGeo, burnerColor);
    burner.position.set(pos[0], pos[1], pos[2]);
    group.add(burner);
  });
}

function createFridge(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color, 0.4, 0.3);
  const handleColor = createMaterial('#333333', 0.3, 0.8);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // Horizontal line splitting upper/lower
  const splitGeo = new THREE.BoxGeometry(w * 0.95, h * 0.02, d * 0.02);
  const splitMesh = new THREE.Mesh(splitGeo, handleColor);
  splitMesh.position.set(0, h * 0.7, d * 0.5);
  group.add(splitMesh);

  // Handle
  const handleGeo = new THREE.BoxGeometry(w * 0.05, h * 0.15, d * 0.03);
  const handleMesh = new THREE.Mesh(handleGeo, handleColor);
  handleMesh.position.set(w * 0.4, h * 0.8, d * 0.52);
  group.add(handleMesh);
}

function createKitchenSink(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const counterColor = createMaterial(color, 0.6, 0.2);
  const basinColor = createMaterial('#e5e7eb', 0.2, 0.7);

  // Counter base
  const counterGeo = new THREE.BoxGeometry(w, h, d);
  const counterMesh = new THREE.Mesh(counterGeo, counterColor);
  counterMesh.position.set(0, h / 2, 0);
  group.add(counterMesh);

  // Basin (oval/elliptical)
  const basinGeo = new THREE.CylinderGeometry(w * 0.3, w * 0.3, h * 0.2, 8);
  basinGeo.scale(1, 1, 0.7); // Make it more oval
  const basinMesh = new THREE.Mesh(basinGeo, basinColor);
  basinMesh.position.set(0, h * 0.8, 0);
  group.add(basinMesh);
}

function createCounter(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color);
  const topColor = createMaterial(color, 0.5, 0.2);
  topColor.color.multiplyScalar(1.1);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h * 0.9, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h * 0.45, 0);
  group.add(bodyMesh);

  // Top surface
  const topGeo = new THREE.BoxGeometry(w, h * 0.1, d);
  const topMesh = new THREE.Mesh(topGeo, topColor);
  topMesh.position.set(0, h * 0.95, 0);
  group.add(topMesh);
}

function createDishwasher(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const bodyColor = createMaterial(color, 0.4, 0.3);
  const handleColor = createMaterial('#333333', 0.3, 0.8);

  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyColor);
  bodyMesh.position.set(0, h / 2, 0);
  group.add(bodyMesh);

  // Horizontal handle line
  const handleGeo = new THREE.BoxGeometry(w * 0.8, h * 0.03, d * 0.02);
  const handleMesh = new THREE.Mesh(handleGeo, handleColor);
  handleMesh.position.set(0, h * 0.8, d * 0.51);
  group.add(handleMesh);
}

// Bathroom furniture
function createToilet(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const toiletColor = createMaterial('#f8fafc', 0.2, 0.1);

  // Bowl (elliptical)
  const bowlGeo = new THREE.CylinderGeometry(w * 0.4, w * 0.35, h, 12);
  bowlGeo.scale(1, 1, 1.3); // Make it more oval
  const bowlMesh = new THREE.Mesh(bowlGeo, toiletColor);
  bowlMesh.position.set(0, h / 2, 0);
  group.add(bowlMesh);

  // Tank behind — at negative Z (back in 2D)
  const tankGeo = new THREE.BoxGeometry(w * 0.7, h * 1.8, d * 0.25);
  const tankMesh = new THREE.Mesh(tankGeo, toiletColor);
  tankMesh.position.set(0, h * 0.9, -d * 0.35);
  group.add(tankMesh);

  // Seat rim
  const seatGeo = new THREE.TorusGeometry(w * 0.35, w * 0.05, 8, 16);
  const seatMesh = new THREE.Mesh(seatGeo, toiletColor);
  seatMesh.position.set(0, h * 0.9, 0);
  seatMesh.rotation.x = -Math.PI / 2;
  group.add(seatMesh);
}

function createBathtub(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const tubColor = createMaterial('#f8fafc', 0.2, 0.1);

  // Outer shell
  const outerGeo = new THREE.BoxGeometry(w, h, d);
  const outerMesh = new THREE.Mesh(outerGeo, tubColor);
  outerMesh.position.set(0, h / 2, 0);
  group.add(outerMesh);

  // Inner hollow (smaller and lower)
  const innerColor = createMaterial('#e2e8f0', 0.3, 0.1);
  const innerGeo = new THREE.BoxGeometry(w * 0.85, h * 0.6, d * 0.85);
  const innerMesh = new THREE.Mesh(innerGeo, innerColor);
  innerMesh.position.set(0, h * 0.3, 0);
  group.add(innerMesh);
}

function createShower(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const glassColor = createMaterial('#bfdbfe', 0.1, 0.0);
  glassColor.transparent = true;
  glassColor.opacity = 0.3;

  const frameColor = createMaterial('#64748b', 0.5, 0.8);

  // Glass panels (corner enclosure)
  const panel1Geo = new THREE.BoxGeometry(w, h * 0.9, d * 0.05);
  const panel1 = new THREE.Mesh(panel1Geo, glassColor);
  panel1.position.set(0, h * 0.45, -d * 0.475);
  group.add(panel1);

  const panel2Geo = new THREE.BoxGeometry(w * 0.05, h * 0.9, d);
  const panel2 = new THREE.Mesh(panel2Geo, glassColor);
  panel2.position.set(-w * 0.475, h * 0.45, 0);
  group.add(panel2);

  // Shower head
  const headGeo = new THREE.CylinderGeometry(w * 0.05, w * 0.05, h * 0.02);
  const headMesh = new THREE.Mesh(headGeo, frameColor);
  headMesh.position.set(-w * 0.3, h * 0.85, -d * 0.3);
  group.add(headMesh);
}

function createBathroomSink(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const sinkColor = createMaterial('#f8fafc', 0.2, 0.1);

  // Pedestal
  const pedestalGeo = new THREE.CylinderGeometry(w * 0.3, w * 0.35, h * 0.8);
  const pedestalMesh = new THREE.Mesh(pedestalGeo, sinkColor);
  pedestalMesh.position.set(0, h * 0.4, 0);
  group.add(pedestalMesh);

  // Basin on top
  const basinGeo = new THREE.CylinderGeometry(w * 0.4, w * 0.35, h * 0.15);
  const basinMesh = new THREE.Mesh(basinGeo, sinkColor);
  basinMesh.position.set(0, h * 0.875, 0);
  group.add(basinMesh);
}

// Office furniture
function createDesk(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const topColor = createMaterial(color);
  const legColor = createMaterial(color, 0.7, 0.1);
  legColor.color.multiplyScalar(0.8);

  // Desktop
  const topGeo = new THREE.BoxGeometry(w, h * 0.1, d);
  const topMesh = new THREE.Mesh(topGeo, topColor);
  topMesh.position.set(0, h * 0.95, 0);
  group.add(topMesh);

  // 4 legs
  const legGeo = new THREE.BoxGeometry(w * 0.04, h * 0.9, d * 0.04);
  const positions = [
    [-w * 0.45, h * 0.45, -d * 0.45],
    [w * 0.45, h * 0.45, -d * 0.45],
    [-w * 0.45, h * 0.45, d * 0.45],
    [w * 0.45, h * 0.45, d * 0.45]
  ];

  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legColor);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  });
}

function createOfficeChair(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const seatColor = createMaterial(color);
  const baseColor = createMaterial('#333333', 0.5, 0.8);

  // Seat
  const seatGeo = new THREE.CylinderGeometry(w * 0.4, w * 0.4, h * 0.1);
  const seatMesh = new THREE.Mesh(seatGeo, seatColor);
  seatMesh.position.set(0, h * 0.5, 0);
  group.add(seatMesh);

  // Backrest — at negative Z (back in 2D)
  const backGeo = new THREE.BoxGeometry(w * 0.7, h * 0.4, d * 0.1);
  const backMesh = new THREE.Mesh(backGeo, seatColor);
  backMesh.position.set(0, h * 0.7, -d * 0.35);
  group.add(backMesh);

  // Central pedestal
  const pedestalGeo = new THREE.CylinderGeometry(w * 0.05, w * 0.05, h * 0.4);
  const pedestalMesh = new THREE.Mesh(pedestalGeo, baseColor);
  pedestalMesh.position.set(0, h * 0.2, 0);
  group.add(pedestalMesh);

  // Base (simplified as cylinder)
  const baseGeo = new THREE.CylinderGeometry(w * 0.35, w * 0.35, h * 0.05);
  const baseMesh = new THREE.Mesh(baseGeo, baseColor);
  baseMesh.position.set(0, h * 0.025, 0);
  group.add(baseMesh);
}

// Dining furniture
function createDiningTable(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const topColor = createMaterial(color);
  const legColor = createMaterial(color, 0.7, 0.1);
  legColor.color.multiplyScalar(0.8);

  // Table top
  const topGeo = new THREE.BoxGeometry(w, h * 0.1, d);
  const topMesh = new THREE.Mesh(topGeo, topColor);
  topMesh.position.set(0, h * 0.95, 0);
  group.add(topMesh);

  // 4 legs
  const legGeo = new THREE.BoxGeometry(w * 0.05, h * 0.9, d * 0.05);
  const positions = [
    [-w * 0.4, h * 0.45, -d * 0.35],
    [w * 0.4, h * 0.45, -d * 0.35],
    [-w * 0.4, h * 0.45, d * 0.35],
    [w * 0.4, h * 0.45, d * 0.35]
  ];

  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legColor);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  });
}

function createDiningChair(group: THREE.Group, w: number, d: number, h: number, color: string): void {
  const seatColor = createMaterial(color);
  const legColor = createMaterial(color, 0.7, 0.1);
  legColor.color.multiplyScalar(0.8);

  // Seat
  const seatGeo = new THREE.BoxGeometry(w * 0.9, h * 0.1, d * 0.9);
  const seatMesh = new THREE.Mesh(seatGeo, seatColor);
  seatMesh.position.set(0, h * 0.5, 0);
  group.add(seatMesh);

  // Back — at negative Z (back in 2D)
  const backGeo = new THREE.BoxGeometry(w * 0.9, h * 0.4, d * 0.1);
  const backMesh = new THREE.Mesh(backGeo, seatColor);
  backMesh.position.set(0, h * 0.7, -d * 0.4);
  group.add(backMesh);

  // 4 legs
  const legGeo = new THREE.BoxGeometry(w * 0.05, h * 0.5, d * 0.05);
  const positions = [
    [-w * 0.35, h * 0.25, -d * 0.35],
    [w * 0.35, h * 0.25, -d * 0.35],
    [-w * 0.35, h * 0.25, d * 0.35],
    [w * 0.35, h * 0.25, d * 0.35]
  ];

  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, legColor);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  });
}