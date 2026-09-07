import type { DetailKind, DetailTarget, ItemDetails, Project } from '$lib/models/types';
import { safePackagePath } from './projectPackageZip';

export const WALL_MATERIALS = ['wood', 'brick', 'stone', 'drywall', 'concrete', 'glass'];
export const ROOM_TYPES = ['livingRoom', 'bedroom', 'kitchen', 'bathroom', 'diningRoom', 'laundryRoom', 'office', 'hallway', 'garage', 'closet', 'pantry', 'entryway'];
const fields: Record<DetailKind, (keyof ItemDetails)[]> = {
  walls: ['note', 'material'], doors: ['price'], windows: ['price'],
  furniture: ['note', 'price', 'photos'], rooms: ['note', 'photos', 'roomType', 'ceilingHeight'],
};
export function validateItemDetails(value: unknown, kind: DetailKind): asserts value is ItemDetails {
  const fail = () => { throw new Error('Invalid item details. Check notes, costs, room metadata and photo references.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const details = value as ItemDetails;
  for (const field of fields[kind]) {
    const v = details[field];
    if (v == null && field !== 'photos') continue;
    if (v === undefined) continue;
    if (field === 'photos') {
      if (!Array.isArray(v) || v.length > 512 || v.some(name => typeof name !== 'string' || !safePackagePath(name))) fail();
    } else if (field === 'price' || field === 'ceilingHeight') {
      if (typeof v !== 'number' || !Number.isFinite(v) || (field === 'price' ? v < 0 : v <= 0 || v > 1_000_000)) fail();
    } else if (typeof v !== 'string' || field === 'roomType' && !ROOM_TYPES.includes(v)) fail();
  }
}
/** Canonical empty values let a baseline detect explicit native deletions. */
export function nativeItemDetails(item: Record<string, any>, kind: DetailKind): ItemDetails {
  return Object.fromEntries(fields[kind].map(field => [field,
    field === 'photos' ? [...(item.photos ?? [])] : field === 'roomType' ? item.type ?? null :
    field === 'ceilingHeight' ? item.ceilingHeight == null ? null : item.ceilingHeight * 100 : item[field] ?? null]));
}
export function withNativeDetails(item: Record<string, any>, details: ItemDetails | undefined, kind: DetailKind) {
  if (!details) return item;
  validateItemDetails(details, kind);
  for (const field of fields[kind]) if (Object.hasOwn(details, field)) {
    const nativeField = field === 'roomType' ? 'type' : field;
    const value = details[field];
    if (value == null) delete item[nativeField];
    else item[nativeField] = field === 'ceilingHeight' ? Number(value) / 100 : structuredClone(value);
  }
  return item;
}
export function detailItem(project: Project, target: DetailTarget) {
  return project.floors.find(floor => floor.id === target.floorId)?.[target.kind].find(item => item.id === target.id);
}
export function validateRetainedDetailState(value: any) {
  const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  const fail = () => { throw new Error('Invalid retained project-package data. Keep a JSON backup before recovery.'); };
  if (!object(value) || value.version !== 1 || !object(value.native) || !object(value.assets) || !Array.isArray(value.mapping)) fail();
  if (value.mapping.length > 5000 || value.mapping.some((m: any) => !object(m) || typeof m.id !== 'string' || typeof m.kind !== 'string' || typeof m.webId !== 'string' || m.floorId !== undefined && typeof m.floorId !== 'string')) fail();
  let size = 0;
  for (const [name, data] of Object.entries(value.assets)) {
    if (!name.startsWith('assets/') || !safePackagePath(name) || typeof data !== 'string') fail();
    size += (data as string).length;
    if (size > 64 * 1024 * 1024 * 4 / 3) fail();
  }
  for (const [kind, nativeKind] of [['walls', 'walls'], ['doors', 'openings'], ['furniture', 'furniture'], ['rooms', 'rooms']] as const) {
    const items = value.native[nativeKind];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.length > 5000) fail();
    for (const item of items) {
      if (!object(item) || typeof item.id !== 'string' || item.photos != null && !Array.isArray(item.photos)) fail();
      validateItemDetails(nativeItemDetails(item, kind), kind);
    }
  }
}
/** Older saved packages predate web detail fields. Resolve their retained data
 * without changing the project merely by opening a properties panel. */
export function itemDetails(project: Project, target: DetailTarget): ItemDetails {
  const state = project.projectPackage;
  const candidates = state?.mapping?.filter(m => m.kind === target.kind && m.webId === target.id) ?? [];
  const mapped = candidates.find(m => m.floorId === target.floorId) ?? (candidates.length === 1 ? candidates[0] : undefined);
  const nativeKind = ['doors', 'windows'].includes(target.kind) ? 'openings' : target.kind;
  const native = mapped && state?.native?.[nativeKind]?.find((item: any) => typeof item.id === 'string' && item.id.toLowerCase() === mapped.id.toLowerCase());
  return { ...nativeItemDetails(native ?? {}, target.kind), ...detailItem(project, target)?.details };
}
