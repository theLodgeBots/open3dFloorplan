import { expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { frameScene } from '$lib/utils/frameScene';

it.each([390 / 852, 640 / 630, 1440 / 852])('fits a tall mixed-floor scene at aspect %s', aspect => {
  const camera = new PerspectiveCamera(60, aspect, 1, 100000);
  const bounds = new Box3(new Vector3(-250, -350, -150), new Vector3(800, 1425, 700));
  const target = new Vector3();
  frameScene(camera, bounds, target);
  expect(target.toArray()).toEqual([275, 537.5, 275]);
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  }
});

it('provides a finite useful camera for empty floors', () => {
  const camera = new PerspectiveCamera(60, 390 / 852, 1, 100000);
  const target = new Vector3();
  frameScene(camera, new Box3(), target);
  expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
  expect(target.toArray()).toEqual([0, 140, 0]);
  expect(camera.position.distanceTo(target)).toBeGreaterThan(400);
});
