import { readProject } from '$lib/utils/projectValidation';
import type { Project } from '$lib/models/types';

export interface DataStore {
  has(id: string): Promise<boolean>;
  save(project: Project): Promise<void>;
  load(id: string): Promise<Project | null>;
  list(): Promise<{ id: string; name: string; updatedAt: string }[]>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<Project | null>;
  saveThumbnail(id: string, dataUrl: string): void;
  getThumbnail(id: string): string | null;
}

const KEY = 'floorplan_projects';

function getAll(): Record<string, string> {
  const raw = localStorage.getItem(KEY);
  try {
    const all = JSON.parse(raw ?? '{}');
    if (!all || typeof all !== 'object' || Array.isArray(all) ||
        Object.values(all).some(value => typeof value !== 'string')) {
      throw new Error('Invalid project library');
    }
    // Imported IDs are data, including names such as "__proto__" and "constructor".
    return Object.assign(Object.create(null), all);
  } catch {
    throw new Error('The saved project library could not be read. Download a backup before attempting recovery.');
  }
}

export function storageErrorMessage(error: unknown): string {
  const e = error as { name?: string; code?: number; message?: string } | null;
  if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014) {
    return 'Browser storage is full. Download your project as JSON, then free space by deleting projects you have backed up.';
  }
  if (e?.name === 'SecurityError') {
    return 'Browser storage is unavailable. Allow site storage or download your project as JSON.';
  }
  return e?.message || 'Could not save to browser storage. Download your project as JSON to keep a copy.';
}

/** Preserve the original bytes, including a damaged library, for manual recovery. */
export function downloadLibraryBackup() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) throw new Error('No saved project library was found.');
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'openplan3d-library-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

export const localStore: DataStore = {
  async has(id) { return Object.hasOwn(getAll(), id); },

  async save(project) {
    const all = getAll();
    all[project.id] = JSON.stringify(project);
    // setItem is atomic on failure. Never evict another project to make space.
    localStorage.setItem(KEY, JSON.stringify(all));
  },

  async load(id) {
    const all = getAll();
    const raw = all[id];
    if (!raw) return null;
    const project = readProject(JSON.parse(raw));
    if (project.id !== id) throw new Error('The saved project ID does not match its library entry. Download a library backup before recovery.');
    return project;
  },

  async list() {
    const all = getAll();
    return Object.values(all).map((raw) => {
      const p = JSON.parse(raw as string);
      return { id: p.id, name: p.name, updatedAt: p.updatedAt };
    });
  },

  async delete(id) {
    const all = getAll();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
    // Also remove thumbnail
    try { localStorage.removeItem(`floorplan_thumb_${id}`); } catch {}
  },

  async duplicate(id: string): Promise<Project | null> {
    const original = await this.load(id);
    if (!original) return null;
    const newId = Math.random().toString(36).slice(2, 10);
    const dup: Project = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.save(dup);
    // Copy thumbnail if exists
    try {
      const thumb = localStorage.getItem(`floorplan_thumb_${id}`);
      if (thumb) localStorage.setItem(`floorplan_thumb_${newId}`, thumb);
    } catch {}
    return dup;
  },

  saveThumbnail(id: string, dataUrl: string) {
    try { localStorage.setItem(`floorplan_thumb_${id}`, dataUrl); } catch {}
  },

  getThumbnail(id: string): string | null {
    try { return localStorage.getItem(`floorplan_thumb_${id}`); } catch { return null; }
  },
};
