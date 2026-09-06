import { writable, get } from 'svelte/store';
import { currentProject, loadProject } from './project';
import { readProject } from '$lib/utils/projectValidation';
import type { Project } from '$lib/models/types';
import { readRecord, updateRecord } from '$lib/services/localDatabase';
import { storageErrorMessage } from '$lib/services/datastore';

export interface Snapshot {
  timestamp: number;
  description: string;
  data: string; // JSON-stringified project
}

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const snapshotError = writable<string | null>(null);

function parseSnapshots(raw: string | null): Snapshot[] {
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

export async function getSnapshots(projectId: string): Promise<Snapshot[]> {
  return parseSnapshots(await readRecord('history', projectId));
}

/** Keep the raw history bytes available even if a snapshot cannot be opened. */
export async function downloadSnapshotBackup(projectId: string) {
  const raw = await readRecord('history', projectId);
  if (raw === null) throw new Error('No saved version history was found.');
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'openplan3d-version-history-backup.json'; link.click();
  URL.revokeObjectURL(url);
}

export const snapshotsStore = writable<Snapshot[]>([]);
let refreshRequest = 0;
const writeErrors = new Map<string, string>();

export async function saveSnapshot(project: Project, description: string) {
  // Freeze now: the editor may keep changing while storage is busy.
  const snapshot = { timestamp: Date.now(), description, data: JSON.stringify(project) };
  try {
    await updateRecord('history', project.id, raw => {
      const snapshots = parseSnapshots(raw);
      return JSON.stringify([...snapshots, snapshot].slice(-MAX_SNAPSHOTS));
    });
    writeErrors.delete(project.id);
    if (get(currentProject)?.id === project.id) await refreshSnapshots();
    return true;
  } catch (error) {
    const message = storageErrorMessage(error);
    writeErrors.set(project.id, message);
    if (get(currentProject)?.id === project.id) snapshotError.set(message);
    return false; // Failed writes retain all previous versions, with no pruning retry.
  }
}

export async function restoreSnapshot(projectId: string, index: number, expected?: Snapshot): Promise<boolean> {
  const before = get(currentProject);
  try {
    const snapshots = await getSnapshots(projectId);
    if (get(currentProject) !== before || before?.id !== projectId) return false;
    if (!Number.isInteger(index) || index < 0 || index >= snapshots.length ||
        (expected && JSON.stringify(snapshots[index]) !== JSON.stringify(expected))) {
      throw new Error('This version changed. Close and reopen version history, then choose it again.');
    }
    const project = readProject(JSON.parse(snapshots[index].data));
    if (project.id !== projectId) throw new Error('This version belongs to a different project.');
    loadProject(project);
    snapshotError.set(null);
    return true;
  } catch (error) {
    if (get(currentProject) === before) snapshotError.set(`${error instanceof Error ? error.message : 'Could not read this version.'} Your current plan has not changed.`);
    return false;
  }
}

export async function deleteAllSnapshots(projectId: string) {
  await updateRecord('history', projectId, () => null);
  writeErrors.delete(projectId);
  if (get(currentProject)?.id === projectId) await refreshSnapshots();
}

export async function refreshSnapshots() {
  const request = ++refreshRequest, p = get(currentProject);
  try {
    const snapshots = p ? await getSnapshots(p.id) : [];
    if (request === refreshRequest && get(currentProject)?.id === p?.id) {
      snapshotsStore.set(snapshots);
      snapshotError.set(p ? writeErrors.get(p.id) ?? null : null);
    }
  } catch (error) {
    if (request !== refreshRequest || get(currentProject)?.id !== p?.id) return;
    snapshotsStore.set([]);
    snapshotError.set(storageErrorMessage(error));
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function initVersionHistory() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    const p = get(currentProject);
    if (p) void saveSnapshot(p, 'Auto-save');
  }, SNAPSHOT_INTERVAL_MS);
  const p = get(currentProject);
  if (p) void saveSnapshot(p, 'Session start');
}

export function stopVersionHistory() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

export function snapshotOnAction(description: string) {
  const p = get(currentProject);
  if (p) void saveSnapshot(p, description);
}
