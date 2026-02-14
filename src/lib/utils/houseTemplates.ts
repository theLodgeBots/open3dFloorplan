import type { Project, Floor, Wall, Door, Window, FurnitureItem } from '$lib/models/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface HouseTemplate {
  name: string;
  description: string;
  icon: string;
  area: string;
  tags: string[];
  create: () => Project;
}

function makeProject(name: string, floor: Floor): Project {
  return {
    id: uid(),
    name,
    floors: [floor],
    activeFloorId: floor.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeFloor(walls: Wall[], doors: Door[], windows: Window[], furniture: FurnitureItem[] = []): Floor {
  const id = uid();
  return {
    id,
    name: 'Ground Floor',
    level: 0,
    walls,
    rooms: [],
    doors,
    windows,
    furniture,
    stairs: [],
    columns: [],
    guides: [],
    measurements: [],
    annotations: [],
    textAnnotations: [],
    groups: [],
  };
}

// Helper: create a rectangular room from walls, returning wall IDs for door/window placement
// All coordinates in cm. Origin top-left.
function rectWalls(x: number, y: number, w: number, h: number, thickness = 15, height = 280): Wall[] {
  const tl = { x, y };
  const tr = { x: x + w, y };
  const br = { x: x + w, y: y + h };
  const bl = { x, y: y + h };
  return [
    { id: uid(), start: tl, end: tr, thickness, height, color: '#444444' }, // top
    { id: uid(), start: tr, end: br, thickness, height, color: '#444444' }, // right
    { id: uid(), start: br, end: bl, thickness, height, color: '#444444' }, // bottom
    { id: uid(), start: bl, end: tl, thickness, height, color: '#444444' }, // left
  ];
}

function wall(x1: number, y1: number, x2: number, y2: number, thickness = 15, height = 280): Wall {
  return { id: uid(), start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, height, color: '#444444' };
}

function door(wallId: string, position: number, type: Door['type'] = 'single', width = 90): Door {
  return { id: uid(), wallId, position, width, height: 210, type, swingDirection: 'left', flipSide: false };
}

function win(wallId: string, position: number, type: Window['type'] = 'standard', width = 120): Window {
  return { id: uid(), wallId, position, width, height: 120, sillHeight: 90, type };
}

function furniture(catalogId: string, x: number, y: number, rotation = 0): FurnitureItem {
  return { id: uid(), catalogId, position: { x, y }, rotation, scale: { x: 1, y: 1, z: 1 } };
}

// ─── Template 1: Studio Apartment (~30m² = ~550x550cm) ───
function createStudioApartment(): Project {
  // Outer walls: 600x500
  const outer = rectWalls(0, 0, 600, 500);
  // Bathroom partition: bottom-left corner, 200x200
  const bathRight = wall(200, 300, 200, 500);
  const bathTop = wall(0, 300, 200, 300);
  // Closet partition: top-left corner 150x120
  const closetRight = wall(150, 0, 150, 120);
  const closetBottom = wall(0, 120, 150, 120);

  const walls = [...outer, bathRight, bathTop, closetRight, closetBottom];

  const doors: Door[] = [
    door(outer[2].id, 0.65),                    // front door (bottom wall)
    door(bathTop.id, 0.5),                       // bathroom door
    door(closetBottom.id, 0.5, 'sliding', 100),  // closet door
  ];

  const windows: Window[] = [
    win(outer[0].id, 0.6, 'standard', 150),     // top wall window
    win(outer[1].id, 0.3, 'standard', 100),     // right wall window
  ];

  const fur: FurnitureItem[] = [
    furniture('bed-single', 400, 80, 0),
    furniture('sofa-2seat', 300, 300, 0),
    furniture('dining-table-round', 480, 380, 0),
    furniture('toilet', 60, 400, 0),
    furniture('sink-single', 60, 340, 0),
  ];

  return makeProject('Studio Apartment', makeFloor(walls, doors, windows, fur));
}

// ─── Template 2: 1-Bedroom Apartment (~50m² = ~700x700) ───
function createOneBedroom(): Project {
  // Outer: 800x650
  const outer = rectWalls(0, 0, 800, 650);
  // Bedroom wall (left side, 350 wide)
  const bedroomRight = wall(350, 0, 350, 350);
  const bedroomBottom = wall(0, 350, 350, 350);
  // Bathroom (top-right corner, 200x250)
  const bathLeft = wall(600, 0, 600, 250);
  const bathBottom = wall(600, 250, 800, 250);
  // Kitchen divider (partial wall)
  const kitchenWall = wall(350, 450, 550, 450);

  const walls = [...outer, bedroomRight, bedroomBottom, bathLeft, bathBottom, kitchenWall];

  const doors: Door[] = [
    door(outer[2].id, 0.45),                     // front door
    door(bedroomBottom.id, 0.7),                  // bedroom door
    door(bathBottom.id, 0.5),                     // bathroom door
  ];

  const windows: Window[] = [
    win(outer[0].id, 0.2, 'standard', 140),      // bedroom window
    win(outer[0].id, 0.75, 'standard', 100),     // bathroom window
    win(outer[1].id, 0.5, 'standard', 150),      // living room window
    win(outer[2].id, 0.15, 'standard', 120),     // kitchen window
  ];

  const fur: FurnitureItem[] = [
    furniture('bed-double', 120, 120, 0),
    furniture('wardrobe', 50, 280, 0),
    furniture('sofa-3seat', 500, 350, 180),
    furniture('dining-table-rect', 420, 540, 0),
    furniture('toilet', 700, 60, 0),
    furniture('sink-single', 700, 170, 0),
  ];

  return makeProject('1-Bedroom Apartment', makeFloor(walls, doors, windows, fur));
}

// ─── Template 3: 2-Bedroom House (~80m² = ~1000x800) ───
function createTwoBedroom(): Project {
  // Outer: 1000x800
  const outer = rectWalls(0, 0, 1000, 800);
  // Hallway runs vertically at x=400, from y=0 to y=500
  const hallLeft = wall(400, 0, 400, 500);
  const hallRight = wall(520, 0, 520, 500);
  // Bedroom 1: top-left (400x400)
  const bed1Bottom = wall(0, 400, 400, 400);
  // Bedroom 2: top-right (480x400)
  const bed2Bottom = wall(520, 400, 1000, 400);
  // Bathroom: right side, 250x300 at bottom-right
  const bathLeft = wall(750, 500, 750, 800);
  const bathTop = wall(750, 500, 1000, 500);
  // Living/Kitchen: bottom area 750x300
  const livingTop = wall(0, 500, 750, 500);

  const walls = [...outer, hallLeft, hallRight, bed1Bottom, bed2Bottom, bathLeft, bathTop, livingTop];

  const doors: Door[] = [
    door(outer[2].id, 0.35),                      // front door
    door(bed1Bottom.id, 0.7),                      // bedroom 1
    door(bed2Bottom.id, 0.3),                      // bedroom 2
    door(bathTop.id, 0.4),                         // bathroom
    door(hallLeft.id, 0.9, 'single'),              // hall to living
  ];

  const windows: Window[] = [
    win(outer[0].id, 0.2, 'standard', 150),       // bed1 window
    win(outer[0].id, 0.75, 'standard', 150),      // bed2 window
    win(outer[3].id, 0.8, 'standard', 180),       // living window left
    win(outer[1].id, 0.8, 'standard', 150),       // living window right
    win(outer[2].id, 0.85, 'standard', 100),      // bathroom window
  ];

  const fur: FurnitureItem[] = [
    furniture('bed-double', 150, 150, 0),
    furniture('bed-single', 700, 150, 0),
    furniture('sofa-3seat', 200, 600, 0),
    furniture('dining-table-rect', 500, 650, 0),
    furniture('toilet', 850, 600, 0),
    furniture('sink-single', 850, 720, 0),
  ];

  return makeProject('2-Bedroom House', makeFloor(walls, doors, windows, fur));
}

// ─── Template 4: Open Concept (~100m² = ~1200x850) ───
function createOpenConcept(): Project {
  // Outer: 1200x850
  const outer = rectWalls(0, 0, 1200, 850);
  // Bedrooms on the right side
  // Bedroom 1: top-right 400x400
  const bed1Left = wall(800, 0, 800, 400);
  const bed1Bottom = wall(800, 400, 1200, 400);
  // Bedroom 2: bottom-right 400x350
  const bed2Left = wall(800, 500, 800, 850);
  const bed2Top = wall(800, 500, 1200, 500);
  // Bathroom 1 (en-suite for bed1): 200x200 at top-right inner
  const bath1Left = wall(1000, 0, 1000, 200);
  const bath1Bottom = wall(1000, 200, 1200, 200);
  // Bathroom 2: between bedrooms
  const bath2Top = wall(800, 400, 1000, 400); // shared with bed1Bottom
  const bath2Right = wall(1000, 400, 1000, 500);
  const bath2Bottom = wall(800, 500, 1000, 500); // shared with bed2Top

  const walls = [...outer, bed1Left, bed1Bottom, bed2Left, bed2Top,
    bath1Left, bath1Bottom, bath2Right];

  const doors: Door[] = [
    door(outer[3].id, 0.5),                        // front door (left wall)
    door(bed1Left.id, 0.6),                        // bedroom 1
    door(bed2Left.id, 0.4),                        // bedroom 2
    door(bath1Bottom.id, 0.5),                     // en-suite
    door(bed1Bottom.id, 0.6),                      // bathroom 2 from hallway side
  ];

  const windows: Window[] = [
    win(outer[0].id, 0.3, 'sliding', 250),        // large living window
    win(outer[3].id, 0.2, 'standard', 150),       // kitchen window
    win(outer[1].id, 0.2, 'standard', 140),       // bed1 window
    win(outer[1].id, 0.8, 'standard', 140),       // bed2 window
    win(outer[2].id, 0.3, 'standard', 180),       // dining window
  ];

  const fur: FurnitureItem[] = [
    furniture('sofa-3seat', 200, 250, 0),
    furniture('dining-table-rect', 350, 600, 0),
    furniture('bed-double', 880, 100, 0),
    furniture('bed-double', 880, 620, 0),
    furniture('toilet', 1080, 60, 0),
    furniture('sink-single', 1080, 140, 0),
    furniture('toilet', 880, 440, 0),
  ];

  return makeProject('Open Concept Home', makeFloor(walls, doors, windows, fur));
}

// ─── Template 5: L-Shaped House (~120m² = complex shape) ───
function createLShaped(): Project {
  // L-shape: main body 1400x600, extension 600x500 at bottom-left
  // Main outline
  const w1 = wall(0, 0, 1400, 0);         // top
  const w2 = wall(1400, 0, 1400, 600);    // right
  const w3 = wall(1400, 600, 600, 600);   // bottom-right
  const w4 = wall(600, 600, 600, 1100);   // inner corner down
  const w5 = wall(600, 1100, 0, 1100);    // bottom
  const w6 = wall(0, 1100, 0, 0);         // left

  // Interior walls
  // Garage: left portion 350x500 of bottom extension
  const garageRight = wall(350, 600, 350, 1100);
  const garageTop = wall(0, 600, 350, 600);  // partial top

  // Bedroom 1: top-left 400x350
  const bed1Right = wall(400, 0, 400, 350);
  const bed1Bottom = wall(0, 350, 400, 350);

  // Bedroom 2: top-middle 400x350
  const bed2Right = wall(800, 0, 800, 350);
  const bed2Bottom = wall(400, 350, 800, 350);

  // Bedroom 3: top-right 600x350
  const bed3Bottom = wall(800, 350, 1400, 350);

  // Bathroom 1: between bed1 and living, 200x250 at left
  const bath1Right = wall(200, 350, 200, 600);
  const bath1Top = wall(0, 350, 200, 350); // overlaps with bed1Bottom start... let's adjust
  // Actually bed1Bottom goes 0->400, bath1 is below it. Let's place bath at bottom-left of main
  // Simplify: bath1 at x=0,y=350 to x=200,y=600
  const bath1Bottom2 = wall(0, 600, 200, 600);

  // Bathroom 2: at x=800,y=350 to x=1000,y=600 
  const bath2Left = wall(800, 350, 800, 600);
  const bath2Top2 = wall(800, 350, 1000, 350); // overlap with bed3Bottom
  const bath2Right2 = wall(1000, 350, 1000, 600);

  // Hallway / living divider
  const hallWall = wall(200, 350, 200, 600);

  const walls = [w1, w2, w3, w4, w5, w6,
    garageRight, garageTop,
    bed1Right, bed1Bottom, bed2Right, bed2Bottom, bed3Bottom,
    bath1Right, bath1Bottom2,
    bath2Right2,
    hallWall];

  const doors: Door[] = [
    door(w3.id, 0.8),                              // front door
    door(garageTop.id, 0.5, 'double', 300),        // garage door (simplified)
    door(bed1Bottom.id, 0.6),                      // bed1
    door(bed2Bottom.id, 0.5),                      // bed2
    door(bed3Bottom.id, 0.3),                      // bed3
    door(bath1Right.id, 0.5),                      // bath1
    door(bath2Right2.id, 0.5),                     // bath2
    door(garageRight.id, 0.3),                     // garage interior door
  ];

  const windows: Window[] = [
    win(w1.id, 0.15, 'standard', 140),            // bed1 window
    win(w1.id, 0.45, 'standard', 140),            // bed2 window
    win(w1.id, 0.8, 'standard', 140),             // bed3 window
    win(w2.id, 0.3, 'standard', 120),             // bed3 side window
    win(w2.id, 0.7, 'standard', 180),             // living window
    win(w5.id, 0.7, 'standard', 150),             // extension window
    win(w6.id, 0.1, 'standard', 120),             // bed1 side
  ];

  const fur: FurnitureItem[] = [
    furniture('bed-double', 150, 120, 0),
    furniture('bed-double', 550, 120, 0),
    furniture('bed-single', 1050, 120, 0),
    furniture('sofa-3seat', 500, 450, 0),
    furniture('dining-table-rect', 1100, 470, 0),
    furniture('toilet', 80, 450, 0),
    furniture('sink-single', 80, 530, 0),
    furniture('toilet', 880, 450, 0),
    furniture('sink-single', 880, 530, 0),
  ];

  return makeProject('L-Shaped House', makeFloor(walls, doors, windows, fur));
}

export const houseTemplates: HouseTemplate[] = [
  {
    name: 'Studio Apartment',
    description: 'Open plan living/kitchen, bathroom, closet',
    icon: '🏢',
    area: '~30m²',
    tags: ['apartment', 'small', 'open-plan'],
    create: createStudioApartment,
  },
  {
    name: '1-Bedroom Apartment',
    description: 'Bedroom, living room, kitchen, bathroom',
    icon: '🏠',
    area: '~50m²',
    tags: ['apartment', 'medium'],
    create: createOneBedroom,
  },
  {
    name: '2-Bedroom House',
    description: '2 bedrooms, living room, kitchen, bathroom, hallway',
    icon: '🏡',
    area: '~80m²',
    tags: ['house', 'family'],
    create: createTwoBedroom,
  },
  {
    name: 'Open Concept Home',
    description: 'Large open living/kitchen/dining, 2 bedrooms, 2 bathrooms',
    icon: '✨',
    area: '~100m²',
    tags: ['house', 'modern', 'open-plan'],
    create: createOpenConcept,
  },
  {
    name: 'L-Shaped House',
    description: 'L-shaped layout with garage, 3 bedrooms, 2 bathrooms',
    icon: '🏘️',
    area: '~120m²',
    tags: ['house', 'large', 'garage'],
    create: createLShaped,
  },
];
