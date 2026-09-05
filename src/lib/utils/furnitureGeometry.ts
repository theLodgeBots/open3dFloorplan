import type { Point, Wall, FurnitureItem } from '$lib/models/types';
import { getFurnitureSize, type FurnitureDef } from '$lib/utils/furnitureCatalog';
import { WALL_SNAP_DIST } from '$lib/utils/canvasInteraction';

/** Keep the back edge flush with a straight wall, using the placed item's real footprint. */
export function snapFurnitureToWalls(
  pos: Point,
  furniture: FurnitureItem | FurnitureDef,
  walls: Wall[],
  snapCoordinate: (value: number) => number = value => value,
): { position: Point; rotation: number; wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null {
    // A placed item carries per-item size overrides; a bare catalog def (placement
    // preview, before the item exists) is already its own effective size.
    const size = 'catalogId' in furniture ? getFurnitureSize(furniture) : furniture;

    // Furniture half-depth (the "back" dimension that goes against the wall)
    const halfDepth = size.depth / 2;
    const halfWidth = size.width / 2;

    let bestDist = WALL_SNAP_DIST;
    let bestResult: { position: Point; rotation: number; wallId: string; side: 'normal' | 'anti'; wallAngle: number } | null = null;

    for (const wall of walls) {
      const wx = wall.end.x - wall.start.x;
      const wy = wall.end.y - wall.start.y;
      const wLen = Math.hypot(wx, wy);
      if (wLen < 1 || size.width > wLen || wall.curvePoint) continue;

      // Unit vectors along wall and perpendicular (normal)
      const ux = wx / wLen, uy = wy / wLen;
      const nx = -uy, ny = ux; // normal pointing "left" of wall direction

      // Project furniture center onto wall line
      const dx = pos.x - wall.start.x;
      const dy = pos.y - wall.start.y;
      const along = dx * ux + dy * uy; // projection along wall
      const perp = dx * nx + dy * ny;  // signed distance from wall center-line

      // Check if projection falls within wall segment (with some margin)
      if (along < -halfWidth || along > wLen + halfWidth) continue;

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
        const clampedAlong = Math.max(halfWidth, Math.min(wLen - halfWidth, along));

        // Grid-snap the position, then keep only the part of that movement that runs along
        // the wall, so the distance to the wall stays exact and the item sits flush.
        const gx = snapCoordinate(wall.start.x + ux * clampedAlong + nx * targetPerp);
        const gy = snapCoordinate(wall.start.y + uy * clampedAlong + ny * targetPerp);
        const gridAlong = (gx - wall.start.x) * ux + (gy - wall.start.y) * uy;
        const finalAlong = Math.max(halfWidth, Math.min(wLen - halfWidth, gridAlong));
        const newX = wall.start.x + ux * finalAlong + nx * targetPerp;
        const newY = wall.start.y + uy * finalAlong + ny * targetPerp;
        // Align rotation: furniture "front" faces away from wall
        const wallAngle = Math.atan2(wy, wx) * 180 / Math.PI;
        // Furniture at 0° has depth along Y axis, so align perpendicular
        const targetRotation = perp >= 0 ? wallAngle : wallAngle + 180;

        bestResult = {
          position: { x: newX, y: newY },
          rotation: ((targetRotation % 360) + 360) % 360,
          wallId: wall.id,
          side,
          wallAngle: wallAngle
        };
      }
    }
    return bestResult;
}
