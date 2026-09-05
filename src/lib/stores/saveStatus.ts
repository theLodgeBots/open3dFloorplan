import { writable, get } from 'svelte/store';
import { currentProject } from './project';
import { localStore, storageErrorMessage } from '$lib/services/datastore';
import { saveSnapshot } from '$lib/stores/versionHistory';

export type SaveState = 'saved' | 'unsaved' | 'saving';

export const saveState = writable<SaveState>('saved');
export const lastSavedAt = writable<Date | null>(null);
export const saveError = writable<string | null>(null);

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
    }
    markDirty();
  });
  const stop = () => {
    unsubscribe();
    clearSaveTimer();
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

/** Saves remain local; failures leave the current project available for export. */
async function persist(manual: boolean): Promise<boolean> {
  clearSaveTimer();
  const p = get(currentProject);
  if (!p) return false;
  if (lastProjectId !== p.id) {
    lastSavedAt.set(null);
    saveError.set(null);
    lastProjectId = p.id;
  }
  const savingRevision = revision;
  const attempt = ++saveAttempt;
  saveState.set('saving');
  try {
    await localStore.save(p);
    // A completed write must not mark newer edits or another project as saved.
    if (attempt === saveAttempt && savingRevision === revision && get(currentProject) === p) {
      captureThumbnail(p.id);
      if (manual) saveSnapshot(p, 'Manual save');
      saveState.set('saved');
      saveError.set(null);
      lastSavedAt.set(new Date());
    }
    return true;
  } catch (e) {
    if (attempt === saveAttempt && get(currentProject) === p) {
      saveState.set('unsaved');
      saveError.set(storageErrorMessage(e));
    }
    return false;
  }
}

export function autoSave() { return persist(false); }

/** Manual save */
export function manualSave() { return persist(true); }

/** Call after loading a project that is already persisted. */
export function markClean() {
  clearSaveTimer();
  revision++;
  saveAttempt++;
  saveState.set('saved');
  saveError.set(null);
  lastSavedAt.set(null);
  lastProjectId = get(currentProject)?.id;
}
