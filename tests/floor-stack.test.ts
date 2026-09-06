import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3, PerspectiveCamera, Plane, Raycaster } from 'three';
import { assembleFloorStack } from '$lib/utils/floorStack';
import { getFloorBelow, orderedFloors, floorElevations } from '$lib/utils/floors';
import { setFloorCameraPose } from '$lib/utils/floorCamera';
import { createDefaultFloor, createDefaultProject } from '$lib/stores/project';

it.each([0, 1, 2])('keeps all floors at their own elevation with floor %s active', active => {
  const floors = [0, 1, 2].map(createDefaultFloor);
  const root = new Group();
  const meshes = new Map<string, Mesh>();
  const add = (id: string, target: Group, y: number) => {
    const mesh = new Mesh(new BoxGeometry(100, 280, 10), new MeshBasicMaterial());
    mesh.position.y = y + 140;
    meshes.set(id, mesh);
    target.add(mesh);
  };
  add(floors[active].id, root, 0);
  assembleFloorStack(root, [...floors].reverse(), floors[active].id, (f, group, offset) => add(f.id, group, offset));
  root.updateMatrixWorld(true);
  expect(floors.map(f => meshes.get(f.id)!.getWorldPosition(new Vector3()).y)).toEqual([140, 440, 740]);
  expect(root.children).toHaveLength(3);
});

it('uses the same level order for stacking and the lower-floor reference, including gaps and basements', () => {
  const project = createDefaultProject();
  project.floors = [4, -1, 0, 2].map(createDefaultFloor);
  project.activeFloorId = project.floors[0].id;
  expect(getFloorBelow(project)?.level).toBe(2);
  const offsets = assembleFloorStack(new Group(), project.floors, project.activeFloorId, () => {});
  expect(offsets.map(entry => entry.yOffset)).toEqual([-300, 0, 600, 1200]);
  project.activeFloorId = project.floors[1].id;
  expect(getFloorBelow(project)).toBeNull();
});

it('keeps legacy floors without level metadata in array order without mutating the document', () => {
  const floors = [createDefaultFloor(), createDefaultFloor()];
  for (const floor of floors) delete (floor as Partial<typeof floor>).level;
  expect(orderedFloors(floors).map(entry => entry.level)).toEqual([0, 1]);
  expect(floors[0]).not.toHaveProperty('level');
  expect(floorElevations(floors).map(entry => entry.elevation)).toEqual([0, 300]);
});

it.each([0, 1, 2, 3])('aligns mixed-height geometry, placement and floor cameras with floor %s active', active => {
  const floors = [-1, 0, 1, 3].map(createDefaultFloor);
  const elevations = [-350, 0, 425.5, 1125.5];
  floors.forEach((floor, i) => { floor.elevation = elevations[i]; });
  const root = new Group();
  const meshes = new Map<string, Mesh>();
  const add = (floorId: string, target: Group, y: number) => {
    const mesh = new Mesh(new BoxGeometry(400, 280, 20), new MeshBasicMaterial());
    mesh.position.set(0, y + 140, -200);
    meshes.set(floorId, mesh);
    target.add(mesh);
  };
  add(floors[active].id, root, 0);
  const entries = assembleFloorStack(root, [...floors].reverse(), floors[active].id,
    (floor, group, y) => add(floor.id, group, y));
  root.updateMatrixWorld(true);
  expect(entries.map(entry => entry.yOffset)).toEqual(elevations);
  expect(floors.map(floor => meshes.get(floor.id)!.getWorldPosition(new Vector3()).y))
    .toEqual(elevations.map(elevation => elevation + 140));

  const elevation = entries.find(entry => entry.floor.id === floors[active].id)!.yOffset;
  const camera = new PerspectiveCamera();
  setFloorCameraPose(camera, elevation, { x: 0, y: 160, z: 0 }, { x: 0, y: 160, z: -100 });
  expect(camera.position.y).toBe(elevation + 160);
  const ray = new Raycaster(camera.position, camera.getWorldDirection(new Vector3()));
  // Eye-level view intersects the selected floor's wall, even on a basement/upper storey.
  expect(ray.intersectObjects(root.children)[0]?.object).toBe(meshes.get(floors[active].id));
  const down = new Raycaster(camera.position, new Vector3(0, -1, 0));
  expect(down.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -elevation), new Vector3())?.y).toBe(elevation);
});

it('keeps an interior camera pitch and direction unchanged when the floor moves', () => {
  const camera = new PerspectiveCamera();
  const position = { x: 80, y: 180, z: 120 };
  const target = { x: 280, y: 130, z: -200 };
  setFloorCameraPose(camera, 0, position, target);
  const direction = camera.getWorldDirection(new Vector3());
  setFloorCameraPose(camera, 750, position, target);
  expect(camera.position.toArray()).toEqual([80, 930, 120]);
  expect(camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-12);
});

it('falls back for malformed imported elevations without changing the source document', () => {
  const floors = [0, 1, 3, -1].map(createDefaultFloor);
  [NaN, Infinity, '450', null].forEach((value, i) => { floors[i].elevation = value as number; });
  expect(floorElevations(floors).map(entry => entry.elevation)).toEqual([-300, 0, 300, 900]);
  expect(floors[2].elevation).toBe('450');
});
