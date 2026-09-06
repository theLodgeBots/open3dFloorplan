import { readProject } from '$lib/utils/projectValidation';
import type { Project } from '$lib/models/types';

export interface DataStore {
  has(id: string): Promise<boolean>;
  assertCurrent(id: string): void;
  saveCopy(project: Project, suffix?: string): Promise<Project>;
  save(project: Project): Promise<void>;
  load(id: string): Promise<Project | null>;
  list(): Promise<{ id: string; name: string; updatedAt: string }[]>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<Project | null>;
  saveThumbnail(id: string, dataUrl: string): void;
  getThumbnail(id: string): string | null;
}

export const PROJECTS_STORAGE_KEY = 'floorplan_projects';
const KEY = PROJECTS_STORAGE_KEY;

export class ProjectConflictError extends Error {
  constructor() {
    super('This project changed or was deleted in another tab. Save your version as a copy or download a JSON backup to keep both versions.');
    this.name = 'ProjectConflictError';
  }
}

/** Current tabs share one lock because localStorage holds the entire library. */
async function mutateLibrary<T>(change: () => T): Promise<T> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('openplan3d-project-library', change);
  }
  // Older/insecure self-hosted contexts retain revision checks, but cannot
  // coordinate simultaneous writes across tabs without Web Locks.
  return change();
}

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

/** Each browser document remembers only revisions it actually opened or saved. */
export function createLocalStore(): DataStore {
  const opened = new Map<string, string | null>();
  const listed = new Map<string, string>();
  const generations = new Map<string, number>();
  const entry = (all: Record<string, string>, id: string) => all[id] ?? null;
  return {
    async has(id) { return Object.hasOwn(getAll(), id); },

    assertCurrent(id) {
      if (entry(getAll(), id) !== (opened.get(id) ?? null)) throw new ProjectConflictError();
    },

    async save(project) {
      // Freeze before waiting for a lock: callers can continue editing meanwhile.
      const id = project.id, raw = JSON.stringify(project);
      const generation = generations.get(id);
      await mutateLibrary(() => {
        const all = getAll();
        if (generation !== generations.get(id) || entry(all, id) !== (opened.get(id) ?? null)) {
          throw new ProjectConflictError();
        }
        all[id] = raw;
        // setItem is atomic on failure. Never evict another project to make space.
        localStorage.setItem(KEY, JSON.stringify(all));
        opened.set(id, raw);
      });
    },

    async saveCopy(project, suffix = 'Recovered copy') {
      const copy = readProject(project);
      copy.name = `${copy.name || 'Untitled Project'} (${suffix})`;
      copy.createdAt = copy.updatedAt = new Date();
      return mutateLibrary(() => {
        const all = getAll();
        let attempts = 0;
        do {
          if (++attempts > 5) throw new Error('Could not choose a new project ID. Try saving a copy again.');
          copy.id = globalThis.crypto?.randomUUID?.() ?? `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        } while (Object.hasOwn(all, copy.id));
        const raw = JSON.stringify(copy);
        all[copy.id] = raw;
        localStorage.setItem(KEY, JSON.stringify(all));
        opened.set(copy.id, raw);
        return copy;
      });
    },

    async load(id) {
      const all = getAll();
      const raw = all[id];
      if (raw === undefined) {
        opened.set(id, null);
        generations.set(id, (generations.get(id) ?? 0) + 1);
        return null;
      }
      const project = readProject(JSON.parse(raw));
      if (project.id !== id) throw new Error('The saved project ID does not match its library entry. Download a library backup before recovery.');
      opened.set(id, raw);
      generations.set(id, (generations.get(id) ?? 0) + 1);
      return project;
    },

    async list() {
      const all = getAll();
      const projects = Object.entries(all).map(([id, raw]) => {
        const p = JSON.parse(raw);
        return { id, name: p.name, updatedAt: p.updatedAt };
      });
      // Listing must not rebase an editor's separately loaded revision.
      listed.clear();
      for (const [id, raw] of Object.entries(all)) listed.set(id, raw);
      return projects;
    },

    async delete(id) {
      await mutateLibrary(() => {
        const all = getAll();
        const expected = listed.has(id) ? listed.get(id) : opened.get(id);
        if (entry(all, id) !== (expected ?? null)) throw new ProjectConflictError();
        delete all[id];
        localStorage.setItem(KEY, JSON.stringify(all));
        // Keep the old opened revision so a deleted editor cannot recreate it.
        listed.delete(id);
        try { localStorage.removeItem(`floorplan_thumb_${id}`); } catch {}
      });
    },

    async duplicate(id: string): Promise<Project | null> {
      const original = await this.load(id);
      if (!original) return null;
      const dup = await this.saveCopy(original, 'Copy');
      // Copy thumbnail if exists
      try {
        const thumb = localStorage.getItem(`floorplan_thumb_${id}`);
        if (thumb) localStorage.setItem(`floorplan_thumb_${dup.id}`, thumb);
      } catch {}
      return dup;
    },

    saveThumbnail(id: string, dataUrl: string) {
      try { this.assertCurrent(id); localStorage.setItem(`floorplan_thumb_${id}`, dataUrl); } catch {}
    },

    getThumbnail(id: string): string | null {
      try { return localStorage.getItem(`floorplan_thumb_${id}`); } catch { return null; }
    },
  };
}

export const localStore = createLocalStore();
