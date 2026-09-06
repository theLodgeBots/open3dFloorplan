import { Group } from 'three';
import type { Floor } from '$lib/models/types';
import { floorElevations } from './floors';

/** The active floor is already built at zero; move it before adding any other floors. */
export function assembleFloorStack(
  root: Group, floors: Floor[], activeFloorId: string,
  buildOther: (floor: Floor, group: Group, yOffset: number) => void,
): { floor: Floor; yOffset: number }[] {
  const entries = floorElevations(floors).map(({ floor, elevation }) => ({ floor, yOffset: elevation }));
  const active = entries.find(entry => entry.floor.id === activeFloorId);
  if (!active) return [];
  for (const child of root.children) child.position.y += active.yOffset;
  for (const entry of entries) {
    if (entry === active) continue;
    const group = new Group();
    buildOther(entry.floor, group, entry.yOffset);
    for (const child of [...group.children]) root.add(child);
  }
  return entries;
}
