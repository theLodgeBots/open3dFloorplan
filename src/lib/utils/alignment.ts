import { get } from 'svelte/store';
import { activeFloor, currentProject, beginUndoGroup, endUndoGroup } from '$lib/stores/project';
import { getFurnitureSize } from '$lib/utils/furnitureCatalog';
import type { FurnitureItem, Floor } from '$lib/models/types';

export type AlignmentOp =
  | 'align-left'
  | 'align-right'
  | 'align-top'
  | 'align-bottom'
  | 'align-center-h'
  | 'align-center-v'
  | 'distribute-h'
  | 'distribute-v';

interface Rect {
  item: FurnitureItem;
  x: number;
  y: number;
  w: number;
  d: number;
}

function getRect(item: FurnitureItem): Rect {
  const { width, depth } = getFurnitureSize(item);
  return { item, x: item.position.x, y: item.position.y, w: width, d: depth };
}

function getSelectedFurniture(ids: Set<string>): FurnitureItem[] {
  const floor = get(activeFloor);
  if (!floor) return [];
  return floor.furniture.filter(f => ids.has(f.id));
}

function applyPositions(updates: Map<string, { x: number; y: number }>) {
  const p = get(currentProject);
  if (!p) return;
  const floor = p.floors.find(f => f.id === p.activeFloorId);
  if (!floor) return;
  for (const fi of floor.furniture) {
    const pos = updates.get(fi.id);
    if (pos) fi.position = pos;
  }
  p.updatedAt = new Date();
  currentProject.set({ ...p });
}

export function alignElements(ids: Set<string>, op: AlignmentOp) {
  const items = getSelectedFurniture(ids);
  if (items.length < 2) return;

  const rects = items.map(getRect);
  const updates = new Map<string, { x: number; y: number }>();

  beginUndoGroup();

  switch (op) {
    case 'align-left': {
      const minX = Math.min(...rects.map(r => r.x - r.w / 2));
      for (const r of rects) updates.set(r.item.id, { x: minX + r.w / 2, y: r.y });
      break;
    }
    case 'align-right': {
      const maxX = Math.max(...rects.map(r => r.x + r.w / 2));
      for (const r of rects) updates.set(r.item.id, { x: maxX - r.w / 2, y: r.y });
      break;
    }
    case 'align-top': {
      const minY = Math.min(...rects.map(r => r.y - r.d / 2));
      for (const r of rects) updates.set(r.item.id, { x: r.x, y: minY + r.d / 2 });
      break;
    }
    case 'align-bottom': {
      const maxY = Math.max(...rects.map(r => r.y + r.d / 2));
      for (const r of rects) updates.set(r.item.id, { x: r.x, y: maxY - r.d / 2 });
      break;
    }
    case 'align-center-h': {
      const minX = Math.min(...rects.map(r => r.x - r.w / 2));
      const maxX = Math.max(...rects.map(r => r.x + r.w / 2));
      const cx = (minX + maxX) / 2;
      for (const r of rects) updates.set(r.item.id, { x: cx, y: r.y });
      break;
    }
    case 'align-center-v': {
      const minY = Math.min(...rects.map(r => r.y - r.d / 2));
      const maxY = Math.max(...rects.map(r => r.y + r.d / 2));
      const cy = (minY + maxY) / 2;
      for (const r of rects) updates.set(r.item.id, { x: r.x, y: cy });
      break;
    }
    case 'distribute-h': {
      const sorted = [...rects].sort((a, b) => a.x - b.x);
      if (sorted.length < 3) break;
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.x - first.x;
      const step = totalSpan / (sorted.length - 1);
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        updates.set(r.item.id, { x: first.x + step * i, y: r.y });
      }
      break;
    }
    case 'distribute-v': {
      const sorted = [...rects].sort((a, b) => a.y - b.y);
      if (sorted.length < 3) break;
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.y - first.y;
      const step = totalSpan / (sorted.length - 1);
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        updates.set(r.item.id, { x: r.x, y: first.y + step * i });
      }
      break;
    }
  }

  applyPositions(updates);
  endUndoGroup();
}
