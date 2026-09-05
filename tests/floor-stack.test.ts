import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { assembleFloorStack } from '$lib/utils/floorStack';
import { getFloorBelow, orderedFloors } from '$lib/utils/floors';
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
});
