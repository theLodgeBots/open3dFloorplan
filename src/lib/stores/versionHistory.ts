import { writable, get } from 'svelte/store';
import { currentProject, loadProject } from './project';
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

export function getSnapshots(projectId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
  const snapshots = getSnapshots(project.id);
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
  const snapshots = getSnapshots(projectId);
  if (index < 0 || index >= snapshots.length) return false;
  try {
    const project = JSON.parse(snapshots[index].data) as Project;
    if (project.createdAt) project.createdAt = new Date(project.createdAt as any);
    if (project.updatedAt) project.updatedAt = new Date(project.updatedAt as any);
    loadProject(project);
    return true;
  } catch (e) {
    console.error('[VersionHistory] Failed to restore snapshot:', e);
    return false;
  }
}

export function deleteAllSnapshots(projectId: string) {
  localStorage.removeItem(storageKey(projectId));
  snapshotsStore.set([]);
}

// Reactive store for current project's snapshots
export const snapshotsStore = writable<Snapshot[]>([]);

// Refresh snapshots store for current project
export function refreshSnapshots() {
  const p = get(currentProject);
  if (p) snapshotsStore.set(getSnapshots(p.id));
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
