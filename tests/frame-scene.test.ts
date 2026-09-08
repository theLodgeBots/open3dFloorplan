import { expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { frameScene } from '$lib/utils/frameScene';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

// Use the actual controls' pole clamping and camera update, without a renderer or
// DOM. A fit must survive that update, not merely look correct before it.
const scenes = [
  { name: 'furnished home', min: [-200, 0, -200], max: [2000, 280, 2000] },
  { name: 'tall stack with basement', min: [-600, -425.5, -150], max: [1900, 2100, 1500] },
  { name: 'long building beyond the original far plane', min: [-15000, -50, -200], max: [15000, 450, 800] },
];
for (const view of ['perspective', 'top-down'] as const) for (const aspect of [390 / 852, 1440 / 852, 844 / 342]) {
  for (const scene of scenes) it(`${view} fits ${scene.name} at aspect ${aspect} after orbit updates`, () => {
    const camera = new PerspectiveCamera(50, aspect, 1, 20000);
    camera.position.set(800, 600, 800);
    const controls = new OrbitControls(camera);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    const bounds = new Box3(new Vector3(...scene.min), new Vector3(...scene.max));
    frameScene(camera, bounds, controls.target, { view });
    for (let frame = 0; frame < 60; frame++) controls.update();
    camera.updateMatrixWorld(true);
    expect(controls.target.distanceTo(bounds.getCenter(new Vector3()))).toBeLessThan(1e-9);
    if (view === 'top-down') expect(camera.getWorldDirection(new Vector3()).y).toBeCloseTo(-1, 8);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.99);
      expect(Math.abs(projected.y)).toBeLessThan(0.99);
      expect(projected.z).toBeGreaterThan(-1); expect(projected.z).toBeLessThan(1);
    }
  });
}

it('refits top-down after resize and zoom changes, with a useful empty-floor fallback', () => {
  const camera = new PerspectiveCamera(50, 2, 1, 20000), target = new Vector3();
  const bounds = new Box3(new Vector3(-1000, -350, -500), new Vector3(1000, 280, 500));
  frameScene(camera, bounds, target, { view: 'top-down' });
  const wideDistance = camera.position.distanceTo(target);
  camera.aspect = 0.35;
  camera.zoom = 1.5;
  frameScene(camera, bounds, target, { view: 'top-down' });
  expect(camera.position.distanceTo(target)).toBeGreaterThan(wideDistance);
  for (const x of [-1000, 1000]) for (const z of [-500, 500]) {
    const projected = new Vector3(x, 280, z).project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1);
  }
  frameScene(camera, new Box3(), target, { view: 'top-down' });
  expect(target.toArray()).toEqual([0, 140, 0]);
  expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
  expect(camera.position.y).toBeGreaterThan(280);
});

it('reserves vertical overlay space on a short landscape viewport', () => {
  const camera = new PerspectiveCamera(50, 844 / 342, 1, 20000), target = new Vector3();
  const bounds = new Box3(new Vector3(-200, -350, -200), new Vector3(2000, 825.5, 2000));
  frameScene(camera, bounds, target, { view: 'top-down', verticalInset: 64 / 342 });
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const projected = new Vector3(x, y, z).project(camera);
    expect(Math.abs(projected.y)).toBeLessThan(1 - 2 * 64 / 342);
  }
});
