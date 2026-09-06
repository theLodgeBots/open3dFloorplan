import { mockStorage, rawRecords, putRaw, failWrites } from './fixtures/indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { currentProject, loadProject, updateWall, undo, redo, undoHistoryStore } from '$lib/stores/project';
import { getSnapshots, saveSnapshot, restoreSnapshot, refreshSnapshots, snapshotError, snapshotsStore } from '$lib/stores/versionHistory';
import { roomProject } from './fixtures/project';

let data: Map<string, string>;
beforeEach(async () => {
  data = mockStorage();
  loadProject(roomProject()); await refreshSnapshots();
});
const state = () => JSON.stringify(get(currentProject));
const key = () => get(currentProject)!.id;

describe('version restoration safety', () => {
  it('restores a valid version with dates and keeps retained snapshot data intact', async () => {
    const before = state(), id = get(currentProject)!.id;
    await saveSnapshot(get(currentProject)!, 'Before edit'); const raw = (await rawRecords('history'))[key()];
    updateWall('a-0', { thickness: 32.5 });
    expect(await restoreSnapshot(id, 0)).toBe(true); expect(state()).toBe(before);
    expect(get(currentProject)!.createdAt).toBeInstanceOf(Date); expect((await rawRecords('history'))[key()]).toBe(raw);
    expect(get(snapshotError)).toBeNull();
  });
  it('rejects a malformed snapshot before replacing the plan or clearing redo', async () => {
    const project = get(currentProject)!; updateWall('a-0', { thickness: 32.5 }); undo();
    const before = state(), history = get(undoHistoryStore), damaged: any = JSON.parse(before);
    damaged.floors[0].walls[0].start = null;
    const raw = JSON.stringify([{ timestamp: 1, description: 'Damaged', data: JSON.stringify(damaged) }]); await putRaw('history', key(), raw);
    expect(await restoreSnapshot(project.id, 0)).toBe(false); expect(state()).toBe(before);
    expect(get(undoHistoryStore)).toEqual(history); expect((await rawRecords('history'))[key()]).toBe(raw);
    expect(get(snapshotError)).toContain('walls[0].start');
    redo(); expect(get(currentProject)!.floors[0].walls[0].thickness).toBe(32.5);
  });
  it('does not restore a version from another project', async () => {
    const before = state(), other = roomProject();
    await putRaw('history', key(), JSON.stringify([{ timestamp: 1, description: 'Wrong project', data: JSON.stringify(other) }]));
    expect(await restoreSnapshot(get(currentProject)!.id, 0)).toBe(false); expect(state()).toBe(before);
    expect(get(snapshotError)).toContain('different project');
  });
  it.each(['{broken', 'null', '{}', '[null]', '[{"timestamp":1,"description":{},"data":"{}"}]'])('keeps unreadable history bytes and exposes recovery: %s', async raw => {
    await putRaw('history', key(), raw); await expect(getSnapshots(get(currentProject)!.id)).rejects.toThrow('could not be read');
    await refreshSnapshots(); expect(get(snapshotsStore)).toEqual([]); expect(get(snapshotError)).toContain('Download a backup');
    await saveSnapshot(get(currentProject)!, 'Auto-save'); expect((await rawRecords('history'))[key()]).toBe(raw);
  });
  it('retains the existing ten-snapshot bound for readable history', async () => {
    for (let i = 0; i < 12; i++) await saveSnapshot(get(currentProject)!, `Version ${i}`);
    const entries = await getSnapshots(get(currentProject)!.id);
    expect(entries).toHaveLength(10); expect(entries[0].description).toBe('Version 2');
  });
});


it('retains all previous versions and the failure message after a quota error, then retries', async () => {
  const project = get(currentProject)!;
  for (let i = 0; i < 10; i++) await saveSnapshot(project, `Saved ${i}`);
  const before = await rawRecords('history'), restore = failWrites('history');
  expect(await saveSnapshot(project, 'Cannot fit')).toBe(false);
  expect(await rawRecords('history')).toEqual(before);
  await refreshSnapshots(); expect(get(snapshotError)).toContain('Browser storage is full');
  expect(get(snapshotsStore)).toHaveLength(10);
  restore(); expect(await saveSnapshot(project, 'Retry')).toBe(true);
  expect(get(snapshotError)).toBeNull(); expect((await getSnapshots(project.id)).at(-1)!.description).toBe('Retry');
});

it('retains simultaneous history appends in one transaction per update', async () => {
  const project = get(currentProject)!;
  await Promise.all([saveSnapshot(project, 'First tab'), saveSnapshot(project, 'Second tab')]);
  expect((await getSnapshots(project.id)).map(s => s.description).sort()).toEqual(['First tab', 'Second tab']);
});

it('does not restore an index that shifted after the version panel opened', async () => {
  const project = get(currentProject)!;
  for (let i = 0; i < 10; i++) await saveSnapshot(project, `Saved ${i}`);
  const selected = (await getSnapshots(project.id))[0];
  await saveSnapshot(project, 'Pushed first version out');
  expect(await restoreSnapshot(project.id, 0, selected)).toBe(false);
  expect(get(currentProject)).toBe(project); expect(get(snapshotError)).toContain('This version changed');
});
