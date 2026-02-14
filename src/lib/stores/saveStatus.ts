import { writable, get } from 'svelte/store';
import { currentProject } from './project';
import { localStore } from '$lib/services/datastore';
import { saveSnapshot } from '$lib/stores/versionHistory';

export type SaveState = 'saved' | 'unsaved' | 'saving';

export const saveState = writable<SaveState>('saved');
export const lastSavedAt = writable<Date | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let skipNext = false;

/** Call once to start watching project changes */
export function initAutoSave() {
  if (initialized) return;
  initialized = true;

  let first = true;
  currentProject.subscribe((_p) => {
    // Skip the initial subscription fire and loadProject calls
    if (first) { first = false; return; }
    if (skipNext) { skipNext = false; return; }
    if (!_p) return;
    markDirty();
  });
}

/** Mark project as dirty (unsaved). */
export function markDirty() {
  saveState.set('unsaved');
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    autoSave();
  }, 5000);
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

async function autoSave() {
  const p = get(currentProject);
  if (!p) return;
  saveState.set('saving');
  try {
    await localStore.save(p);
    captureThumbnail(p.id);
    saveState.set('saved');
    lastSavedAt.set(new Date());
  } catch (e) {
    console.error('[AutoSave] Failed:', e);
    saveState.set('unsaved');
  }
}

/** Manual save */
export async function manualSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  const p = get(currentProject);
  if (!p) return;
  saveState.set('saving');
  try {
    await localStore.save(p);
    captureThumbnail(p.id);
    saveSnapshot(p, 'Manual save');
    saveState.set('saved');
    lastSavedAt.set(new Date());
  } catch (e) {
    console.error('[Save] Failed:', e);
    saveState.set('unsaved');
    throw e;
  }
}

/** Mark as saved without triggering dirty (e.g. after loadProject) */
export function markClean() {
  if (debounceTimer) clearTimeout(debounceTimer);
  saveState.set('saved');
  skipNext = true;
}
