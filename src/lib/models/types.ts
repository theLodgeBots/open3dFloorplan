export interface Point { x: number; y: number; }

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  color: string;
  /** Optional quadratic bezier control point for curved walls */
  curvePoint?: Point;
  texture?: string;
}

export interface Room {
  id: string;
  name: string;
  walls: string[];
  floorTexture: string;
  area: number;
}

export interface Door {
  id: string;
  wallId: string;
  position: number; // 0-1 along wall
  width: number;
  height: number;
  type: 'single' | 'double' | 'sliding' | 'french' | 'pocket' | 'bifold';
  swingDirection: 'left' | 'right';
  flipSide: boolean; // flip which side of wall the door opens to (vertical flip)
}

export interface Window {
  id: string;
  wallId: string;
  position: number; // 0-1 along wall
  width: number;
  height: number;
  sillHeight: number;
  type: 'standard' | 'fixed' | 'casement' | 'sliding' | 'bay';
}

export interface FurnitureItem {
  id: string;
  catalogId: string;
  position: Point;
  rotation: number;
  scale: { x: number; y: number; z: number };
  // Per-item overrides (optional — falls back to catalog defaults)
  color?: string;
  width?: number;   // cm
  depth?: number;   // cm
  height?: number;  // cm
  material?: string; // material name/id
}

export interface Stair {
  id: string;
  position: Point;
  rotation: number;
  width: number;   // default 100cm
  depth: number;   // default 300cm
  riserCount: number; // default 14
  direction: 'up' | 'down';
}

export interface BackgroundImage {
  dataUrl: string;
  position: Point;
  scale: number;
  opacity: number;
  rotation: number;
  locked: boolean;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: FurnitureItem[];
  stairs: Stair[];
  backgroundImage?: BackgroundImage;
}

export interface Project {
  id: string;
  name: string;
  floors: Floor[];
  activeFloorId: string;
  createdAt: Date;
  updatedAt: Date;
}
