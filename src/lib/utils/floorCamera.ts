import type { Camera, Vector3Like } from 'three';

/** Camera coordinates are local to a floor, just like its walls and furniture. */
export function setFloorCameraPose(camera: Camera, elevation: number, position: Vector3Like, target: Vector3Like) {
  camera.position.set(position.x, position.y + elevation, position.z);
  camera.lookAt(target.x, target.y + elevation, target.z);
}
