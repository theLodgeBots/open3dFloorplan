import { writable, get } from 'svelte/store';
import { currentProject, loadProject } from './project';
import { readProject } from '$lib/utils/projectValidation';
import type { Project } from '$lib/models/types';

export interface Snapshot {
  timestamp: number;
  description: string;
  data: string; // JSON-stringified project
}

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function storageKey(projectId: string): string {
  return `vh_${projectId}`;
}

export const snapshotError = writable<string | null>(null);

export function getSnapshots(projectId: string): Snapshot[] {
  const raw = localStorage.getItem(storageKey(projectId));
  if (raw === null) return [];
  try {
    const snapshots = JSON.parse(raw);
    if (!Array.isArray(snapshots) || snapshots.some(item => !item ||
        typeof item.timestamp !== 'number' || !Number.isFinite(item.timestamp) ||
        typeof item.description !== 'string' || typeof item.data !== 'string')) throw new Error();
    return snapshots;
  } catch {
    throw new Error('Version history could not be read. Download a backup before clearing damaged versions.');
  }
}

/** Keep the raw history bytes available even if a snapshot cannot be opened. */
export function downloadSnapshotBackup(projectId: string) {
  const raw = localStorage.getItem(storageKey(projectId));
  if (raw === null) throw new Error('No saved version history was found.');
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'openplan3d-version-history-backup.json'; link.click();
  URL.revokeObjectURL(url);
}

function persistSnapshots(projectId: string, snapshots: Snapshot[]) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(snapshots));
  } catch (e) {
    // localStorage full — prune harder
    console.warn('[VersionHistory] Storage full, pruning to 5 snapshots');
    const pruned = snapshots.slice(-5);
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(pruned));
    } catch {
      console.error('[VersionHistory] Cannot save snapshots');
    }
  }
}

export function saveSnapshot(project: Project, description: string) {
  let snapshots: Snapshot[];
  try { snapshots = getSnapshots(project.id); }
  catch (error) {
    snapshotError.set(error instanceof Error ? error.message : 'Could not read version history.');
    return; // Never replace an unreadable history with a new, empty one.
  }
  snapshots.push({
    timestamp: Date.now(),
    description,
    data: JSON.stringify(project),
  });
  // Prune to keep last MAX_SNAPSHOTS
  while (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
  persistSnapshots(project.id, snapshots);
  snapshotsStore.set(snapshots);
}

export function restoreSnapshot(projectId: string, index: number): boolean {
  try {
    const snapshots = getSnapshots(projectId);
    if (!Number.isInteger(index) || index < 0 || index >= snapshots.length) throw new Error('This version is no longer available.');
    const project = readProject(JSON.parse(snapshots[index].data));
    if (project.id !== projectId) throw new Error('This version belongs to a different project.');
    loadProject(project);
    snapshotError.set(null);
    return true;
  } catch (error) {
    snapshotError.set(`${error instanceof Error ? error.message : 'Could not read this version.'} Your current plan has not changed.`);
    return false;
  }
}

export function deleteAllSnapshots(projectId: string) {
  localStorage.removeItem(storageKey(projectId));
  snapshotsStore.set([]);
  snapshotError.set(null);
}

// Reactive store for current project's snapshots
export const snapshotsStore = writable<Snapshot[]>([]);

// Refresh snapshots store for current project
export function refreshSnapshots() {
  snapshotError.set(null);
  const p = get(currentProject);
  try { snapshotsStore.set(p ? getSnapshots(p.id) : []); }
  catch (error) {
    snapshotsStore.set([]);
    snapshotError.set(error instanceof Error ? error.message : 'Could not read version history.');
  }
}

// Auto-snapshot timer
let intervalId: ReturnType<typeof setInterval> | null = null;

export function initVersionHistory() {
  if (intervalId) return;
  // Take a snapshot every 5 minutes
  intervalId = setInterval(() => {
    const p = get(currentProject);
    if (p) saveSnapshot(p, 'Auto-save');
  }, SNAPSHOT_INTERVAL_MS);
  // Initial snapshot
  const p = get(currentProject);
  if (p) {
    saveSnapshot(p, 'Session start');
  }
}

export function stopVersionHistory() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Create a snapshot on major actions (call manually) */
export function snapshotOnAction(description: string) {
  const p = get(currentProject);
  if (p) saveSnapshot(p, description);
}
