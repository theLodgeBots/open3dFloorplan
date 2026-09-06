import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWallStartHeight,
  getWallEndHeight,
  getWallHeightAt,
  type Wall
} from '$lib/models/types';
import {
  addWall,
  updateWall,
  reverseWall,
  splitWall,
  addDoor,
  addWindow,
  addFloor,
  undo,
  redo,
  createDefaultProject,
  currentProject
} from '$lib/stores/project';
import { get } from 'svelte/store';
import { createSlopedBoxGeometry } from '$lib/utils/slopedWallGeometry';

describe('Variable Height Wall Unit Tests', () => {

  beforeEach(() => {
    currentProject.set(createDefaultProject('Test Project'));
  });

  describe('1. Local Wall Height Calculations', () => {
    it('computes linear interpolation correctly between startHeight and endHeight', () => {
      const wall: Wall = {
        id: 'w1',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        thickness: 15,
        color: '#444444',
        startHeight: 200,
        endHeight: 300,
        height: 300
      };

      expect(getWallStartHeight(wall)).toBe(200);
      expect(getWallEndHeight(wall)).toBe(300);

      // Interpolation at parameter t
      expect(getWallHeightAt(wall, 0)).toBe(200);
      expect(getWallHeightAt(wall, 0.5)).toBe(250);
      expect(getWallHeightAt(wall, 0.25)).toBe(225);
      expect(getWallHeightAt(wall, 0.75)).toBe(275);
      expect(getWallHeightAt(wall, 1)).toBe(300);

      // Out-of-bounds t clamping
      expect(getWallHeightAt(wall, -0.5)).toBe(200);
      expect(getWallHeightAt(wall, 1.5)).toBe(300);
    });

    it('handles uniform wall when startHeight === endHeight', () => {
      const wall: Wall = {
        id: 'w_uniform',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        thickness: 15,
        color: '#444444',
        startHeight: 250,
        endHeight: 250,
        height: 250
      };

      expect(getWallHeightAt(wall, 0)).toBe(250);
      expect(getWallHeightAt(wall, 0.5)).toBe(250);
      expect(getWallHeightAt(wall, 1)).toBe(250);
    });
  });

  describe('2. Legacy Height Backward Compatibility & Default Values', () => {
    it('falls back to legacy wall.height when startHeight / endHeight are missing', () => {
      const legacyWall: Wall = {
        id: 'legacy1',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        thickness: 15,
        color: '#444444',
        height: 270
      };

      expect(getWallStartHeight(legacyWall)).toBe(270);
      expect(getWallEndHeight(legacyWall)).toBe(270);
      expect(getWallHeightAt(legacyWall, 0.5)).toBe(270);
    });

    it('falls back to default 280 when wall height is undefined', () => {
      const bareWall: Wall = {
        id: 'bare1',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        thickness: 15, color: '#444444', height: undefined as unknown as number
      };

      expect(getWallStartHeight(bareWall)).toBe(280);
      expect(getWallEndHeight(bareWall)).toBe(280);
      expect(getWallHeightAt(bareWall, 0.5)).toBe(280);
    });

    it('initializes new walls with default startHeight and endHeight of 280', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
      const p = get(currentProject)!;
      const floor = p.floors.find(f => f.id === p.activeFloorId)!;
      const wall = floor.walls.find(w => w.id === wallId)!;

      expect(wall.startHeight).toBe(280);
      expect(wall.endHeight).toBe(280);
      expect(wall.height).toBe(280);
    });
  });

  describe('3. Wall Updates & Legacy Height Synchronization', () => {
    it('synchronizes legacy height to Math.max(startHeight, endHeight) when updated', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
      updateWall(wallId, { startHeight: 180, endHeight: 350 });

      const p = get(currentProject)!;
      const floor = p.floors.find(f => f.id === p.activeFloorId)!;
      const wall = floor.walls.find(w => w.id === wallId)!;

      expect(wall.startHeight).toBe(180);
      expect(wall.endHeight).toBe(350);
      expect(wall.height).toBe(350);
    });

    it('sets both startHeight and endHeight when updating legacy height scalar alone', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
      updateWall(wallId, { height: 320 });

      const p = get(currentProject)!;
      const floor = p.floors.find(f => f.id === p.activeFloorId)!;
      const wall = floor.walls.find(w => w.id === wallId)!;

      expect(wall.startHeight).toBe(320);
      expect(wall.endHeight).toBe(320);
      expect(wall.height).toBe(320);
    });
  });

  describe('4. Splitting a Sloped Wall & Opening Re-parametrization', () => {
    it('splits a wall with continuous slope at arbitrary t and reassigns door/window positions', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 200, y: 0 });
      updateWall(wallId, { startHeight: 200, endHeight: 400 });

      // Add door at t = 0.8 (x = 160)
      const doorId = addDoor(wallId, 0.8, 'single');

      const p = get(currentProject)!;
      const floor = p.floors.find(f => f.id === p.activeFloorId)!;

      // Split wall at t = 0.5 (midpoint x = 100)
      const newWallId = splitWall(wallId, 0.5);
      expect(newWallId).not.toBeNull();

      const wall1 = floor.walls.find(w => w.id === wallId)!;
      const wall2 = floor.walls.find(w => w.id === newWallId)!;

      // Wall 1: 0..100, height 200 -> 300
      expect(getWallStartHeight(wall1)).toBe(200);
      expect(getWallEndHeight(wall1)).toBe(300);
      expect(wall1.height).toBe(300);

      // Wall 2: 100..200, height 300 -> 400
      expect(getWallStartHeight(wall2)).toBe(300);
      expect(getWallEndHeight(wall2)).toBe(400);
      expect(wall2.height).toBe(400);

      // Verify slope continuity at junction
      expect(getWallEndHeight(wall1)).toBe(getWallStartHeight(wall2));

      // Door at original t=0.8 should now belong to newWall2 at relative position t' = (0.8 - 0.5) / 0.5 = 0.6
      const door = floor.doors.find(d => d.id === doorId)!;
      expect(door.wallId).toBe(newWallId);
      expect(door.position).toBeCloseTo(0.6, 5);
    });
  });

  describe('5. Reversing Wall Direction & Flipping Openings', () => {
    it('swaps start/end points, startHeight/endHeight, and flips door/window positions', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
      updateWall(wallId, { startHeight: 210, endHeight: 350 });

      const doorId = addDoor(wallId, 0.25, 'single');
      const winId = addWindow(wallId, 0.85, 'standard');

      reverseWall(wallId);

      const p = get(currentProject)!;
      const floor = p.floors.find(f => f.id === p.activeFloorId)!;
      const wall = floor.walls.find(w => w.id === wallId)!;

      expect(wall.start).toEqual({ x: 100, y: 0 });
      expect(wall.end).toEqual({ x: 0, y: 0 });
      expect(getWallStartHeight(wall)).toBe(350);
      expect(getWallEndHeight(wall)).toBe(210);
      expect(wall.height).toBe(350);

      // Door position should flip from 0.25 to 0.75
      const door = floor.doors.find(d => d.id === doorId)!;
      expect(door.position).toBeCloseTo(0.75, 5);

      // Window position should flip from 0.85 to 0.15
      const win = floor.windows.find(w => w.id === winId)!;
      expect(win.position).toBeCloseTo(0.15, 5);
    });
  });

  describe('6. Duplication and Floor Copying', () => {
    it('preserves startHeight and endHeight when copying floor layouts', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
      updateWall(wallId, { startHeight: 190, endHeight: 310 });

      // Add new floor copying current layout
      addFloor('Second Floor', 'copy');

      const p = get(currentProject)!;
      const activeF = p.floors.find(f => f.id === p.activeFloorId)!;
      const copiedWall = activeF.walls[0];

      expect(copiedWall.startHeight).toBe(190);
      expect(copiedWall.endHeight).toBe(310);
      expect(copiedWall.height).toBe(310);
    });
  });

  describe('7. Undo and Redo History', () => {
    it('restores previous startHeight and endHeight on undo and redo', () => {
      const wallId = addWall({ x: 0, y: 0 }, { x: 100, y: 0 });

      // Initially 280 / 280
      let p = get(currentProject)!;
      let wall = p.floors[0].walls.find(w => w.id === wallId)!;
      expect(wall.startHeight).toBe(280);
      expect(wall.endHeight).toBe(280);

      // Edit wall heights to 200 / 350
      updateWall(wallId, { startHeight: 200, endHeight: 350 });
      p = get(currentProject)!;
      wall = p.floors[0].walls.find(w => w.id === wallId)!;
      expect(wall.startHeight).toBe(200);
      expect(wall.endHeight).toBe(350);

      // Undo edit -> restores 280 / 280
      undo();
      p = get(currentProject)!;
      wall = p.floors[0].walls.find(w => w.id === wallId)!;
      expect(wall.startHeight).toBe(280);
      expect(wall.endHeight).toBe(280);

      // Redo edit -> restores 200 / 350
      redo();
      p = get(currentProject)!;
      wall = p.floors[0].walls.find(w => w.id === wallId)!;
      expect(wall.startHeight).toBe(200);
      expect(wall.endHeight).toBe(350);
    });
  });

  describe('8. Serialization and Deserialization', () => {
    it('preserves startHeight and endHeight through JSON stringify/parse', () => {
      const wallId = addWall({ x: 10, y: 20 }, { x: 110, y: 20 });
      updateWall(wallId, { startHeight: 180, endHeight: 320 });

      const p = get(currentProject)!;
      const json = JSON.stringify(p);
      const restored = JSON.parse(json);

      const floor = restored.floors.find((f: any) => f.id === restored.activeFloorId);
      const restoredWall = floor.walls.find((w: any) => w.id === wallId);

      expect(restoredWall.startHeight).toBe(180);
      expect(restoredWall.endHeight).toBe(320);
      expect(restoredWall.height).toBe(320);
      expect(getWallHeightAt(restoredWall, 0.5)).toBe(250);
    });
  });

  describe('11. 3D Sloped Wall Geometry Topology & Bounding Box', () => {
    it('creates closed trapezoidal prism with valid indices, local bounds, and vertex normals', () => {
      const width = 200;
      const thickness = 15;
      const bottomY = 0;
      const topYLeft = 200;
      const topYRight = 350;

      const hw = width / 2;
      const ht = thickness / 2;
      const yb = bottomY;
      const ytl = topYLeft;
      const ytr = topYRight;

      const geo = createSlopedBoxGeometry(width, thickness, bottomY, topYLeft, topYRight);
      const positions = geo.getAttribute('position').array;
      const indices = Array.from(geo.getIndex()!.array);
      geo.computeBoundingBox();

      const numVertices = positions.length / 3; // 24
      expect(numVertices).toBe(24);
      expect(indices.length).toBe(36); // 12 triangles

      // 1. All indices point to valid vertices
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(numVertices);
      }

      // 2. Bounding box stays strictly within wall length, thickness, and height bounds
      const bbox = geo.boundingBox!;
      expect(bbox.min.x).toBeCloseTo(-hw, 5);
      expect(bbox.max.x).toBeCloseTo(hw, 5);
      expect(bbox.min.z).toBeCloseTo(-ht, 5);
      expect(bbox.max.z).toBeCloseTo(ht, 5);
      expect(bbox.min.y).toBeCloseTo(bottomY, 5);
      expect(bbox.max.y).toBeCloseTo(Math.max(topYLeft, topYRight), 5);
    });
  });

});
