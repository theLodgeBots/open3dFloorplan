import { Box3, PerspectiveCamera, Vector3 } from 'three';

/** Fit every corner using the camera's horizontal and vertical field of view. */
export function frameScene(camera: PerspectiveCamera, bounds: Box3, target: Vector3,
  { view = 'perspective', verticalInset = 0 }: { view?: 'perspective' | 'top-down'; verticalInset?: number } = {}) {
  const box = bounds.isEmpty()
    ? new Box3(new Vector3(-200, 0, -200), new Vector3(200, 280, 200))
    : bounds;
  box.getCenter(target);
  // Stay just off the pole so camera.up and the viewing direction have a stable
  // cross product, including after OrbitControls clamps its polar angle.
  const outward = (view === 'top-down' ? new Vector3(0, 1, 0.00001) : new Vector3(1.2, 0.8, 1.2)).normalize();
  const right = new Vector3().crossVectors(camera.up, outward).normalize();
  const up = new Vector3().crossVectors(outward, right).normalize();
  const tanY = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
  const tanX = tanY * camera.aspect;
  // Reserve a fraction of the viewport at both top and bottom for overlay UI.
  // Horizontal space is independent, so a portrait view still uses its width.
  const usableTanY = tanY * (1 - 2 * Math.max(0, Math.min(verticalInset, 0.45)));
  let distance = 400;
  let furthestDepth = 0;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const corner = new Vector3(x, y, z).sub(target);
        const depth = corner.dot(outward);
        furthestDepth = Math.max(furthestDepth, -depth);
        distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanX,
          depth + Math.abs(corner.dot(up)) / usableTanY, depth + camera.near);
      }
    }
  }
  camera.position.copy(target).addScaledVector(outward, distance * 1.15);
  // A narrow viewport can require a distance beyond the viewer's default far
  // plane. Include the back of the whole stack instead of clipping the plan.
  camera.far = Math.max(camera.far, (distance * 1.15 + furthestDepth + camera.near) * 1.1);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
}
