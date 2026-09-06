import { writable, get } from 'svelte/store';
import { currentProject, loadProject } from './project';
import { localStore, storageErrorMessage, ProjectConflictError, PROJECTS_STORAGE_KEY, LIBRARY_CHANGE_KEY } from '$lib/services/datastore';
import { saveSnapshot } from '$lib/stores/versionHistory';
import type { Project } from '$lib/models/types';

export type SaveState = 'saved' | 'unsaved' | 'saving';

export const saveState = writable<SaveState>('saved');
export const lastSavedAt = writable<Date | null>(null);
export const saveError = writable<string | null>(null);
export const saveConflict = writable(false);
export const savingCopy = writable(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatching: (() => void) | null = null;
let revision = 0;
let saveAttempt = 0;
let lastProjectId: string | undefined;

/** One autosave owner per mounted editor. The caller must dispose on unmount. */
export function initAutoSave() {
  stopWatching?.();

  let first = true;
  let projectId = get(currentProject)?.id;
  const unsubscribe = currentProject.subscribe((_p) => {
    if (first) { first = false; return; }
    if (!_p) return;
    if (_p.id !== projectId) {
      projectId = _p.id;
      lastSavedAt.set(null);
      saveError.set(null);
      saveConflict.set(false);
    }
    markDirty();
  });
  let disposed = false;
  const checkCurrent = async () => {
    const project = get(currentProject);
    if (!project) return;
    const attempt = saveAttempt;
    try { await localStore.assertCurrent(project.id); }
    catch (error) {
      if (disposed || get(currentProject) !== project || attempt !== saveAttempt) return;
      clearSaveTimer();
      saveAttempt++;
      saveState.set('unsaved');
      saveError.set(storageErrorMessage(error));
      saveConflict.set(error instanceof ProjectConflictError);
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== PROJECTS_STORAGE_KEY && event.key !== LIBRARY_CHANGE_KEY) return;
    if (event.storageArea && event.storageArea !== localStorage) return;
    void checkCurrent();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkCurrent);
  }
  const stop = () => {
    disposed = true;
    unsubscribe();
    clearSaveTimer();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkCurrent);
    }
    if (stopWatching === stop) stopWatching = null;
  };
  stopWatching = stop;
  return stop;
}

function clearSaveTimer() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
}

/** Mark project as dirty (unsaved). */
export function markDirty() {
  revision++;
  saveState.set('unsaved');
  clearSaveTimer();
  if (get(saveConflict)) return;
  debounceTimer = setTimeout(() => {
    void autoSave();
  }, 1000);
}

function captureThumbnail(projectId: string) {
  try {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const size = 300;
    const tmp = document.createElement('canvas');
    tmp.width = size;
    tmp.height = Math.round(size * (canvas.height / canvas.width));
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    const dataUrl = tmp.toDataURL('image/jpeg', 0.6);
    localStore.saveThumbnail(projectId, dataUrl);
  } catch {}
}

function scheduleThumbnail(project: Project) {
  const renderedRevision = revision, attempt = saveAttempt;
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (attempt === saveAttempt && renderedRevision === revision && get(currentProject) === project) {
      captureThumbnail(project.id);
    }
  }));
}

/** Saves remain local; failures leave the current project available for export. */
async function persist(manual: boolean): Promise<boolean> {
  clearSaveTimer();
  const p = get(currentProject);
  if (!p) return false;
  if (lastProjectId !== p.id) {
    lastSavedAt.set(null);
    saveError.set(null);
    saveConflict.set(false);
    lastProjectId = p.id;
  }
  const savingRevision = revision;
  const attempt = ++saveAttempt;
  saveState.set('saving');
  try {
    await localStore.save(p);
    // A completed write must not mark newer edits or another project as saved.
    if (attempt === saveAttempt && savingRevision === revision && get(currentProject) === p) {
      // The canvas may still show the previous plan immediately after an import.
      // Let reactive updates, zoom-to-fit and a paint finish before taking a preview.
      // Preview work must not delay the save or capture a newer revision/project.
      scheduleThumbnail(p);
      if (manual) saveSnapshot(p, 'Manual save');
      saveState.set('saved');
      saveError.set(null);
      saveConflict.set(false);
      lastSavedAt.set(new Date());
    }
    return true;
  } catch (e) {
    if (attempt === saveAttempt && get(currentProject) === p) {
      saveState.set('unsaved');
      saveError.set(storageErrorMessage(e));
      saveConflict.set(e instanceof ProjectConflictError);
    }
    return false;
  }
}

export function autoSave() { return persist(false); }

/** Manual save */
export function manualSave() { return persist(true); }

/** Preserve this tab's version under a fresh ID before changing editor state. */
export async function saveCurrentAsCopy(): Promise<boolean> {
  if (get(savingCopy)) return false;
  const project = get(currentProject);
  if (!project) return false;
  clearSaveTimer();
  saveAttempt++;
  const copyingRevision = revision;
  savingCopy.set(true);
  try {
    const copy = await localStore.saveCopy(project);
    if (get(currentProject)?.id !== project.id) return false;
    if (revision !== copyingRevision || get(currentProject) !== project) {
      if (get(saveState) !== 'saved') saveError.set('A copy was saved, but you made more edits while it was saving. Save another copy to keep the latest version.');
      return false;
    }
    loadProject(copy);
    markClean();
    lastSavedAt.set(new Date());
    scheduleThumbnail(copy);
    return true;
  } catch (error) {
    if (get(currentProject)?.id === project.id) saveError.set(storageErrorMessage(error));
    return false;
  } finally { savingCopy.set(false); }
}

/** Call after loading a project that is already persisted. */
export function markClean() {
  clearSaveTimer();
  revision++;
  saveAttempt++;
  saveState.set('saved');
  saveError.set(null);
  saveConflict.set(false);
  lastSavedAt.set(null);
  lastProjectId = get(currentProject)?.id;
}
