import { Box3, PerspectiveCamera, Vector3 } from 'three';

/** Fit every corner using the camera's horizontal and vertical field of view. */
export function frameScene(camera: PerspectiveCamera, bounds: Box3, target: Vector3) {
  const box = bounds.isEmpty()
    ? new Box3(new Vector3(-200, 0, -200), new Vector3(200, 280, 200))
    : bounds;
  box.getCenter(target);
  const outward = new Vector3(1.2, 0.8, 1.2).normalize();
  const right = new Vector3().crossVectors(camera.up, outward).normalize();
  const up = new Vector3().crossVectors(outward, right).normalize();
  const tanY = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
  const tanX = tanY * camera.aspect;
  let distance = 400;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const corner = new Vector3(x, y, z).sub(target);
        const depth = corner.dot(outward);
        distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanX,
          depth + Math.abs(corner.dot(up)) / tanY, depth + camera.near);
      }
    }
  }
  camera.position.copy(target).addScaledVector(outward, distance * 1.15);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
}
