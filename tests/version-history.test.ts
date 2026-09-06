import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { currentProject, loadProject, updateWall, undo, redo, undoHistoryStore } from '$lib/stores/project';
import { getSnapshots, saveSnapshot, restoreSnapshot, refreshSnapshots, snapshotError, snapshotsStore } from '$lib/stores/versionHistory';
import { roomProject } from './fixtures/project';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  loadProject(roomProject()); refreshSnapshots();
});
const state = () => JSON.stringify(get(currentProject));
const key = () => `vh_${get(currentProject)!.id}`;

describe('version restoration safety', () => {
  it('restores a valid version with dates and keeps retained snapshot data intact', () => {
    const before = state(), id = get(currentProject)!.id;
    saveSnapshot(get(currentProject)!, 'Before edit'); const raw = data.get(key());
    updateWall('a-0', { thickness: 32.5 });
    expect(restoreSnapshot(id, 0)).toBe(true); expect(state()).toBe(before);
    expect(get(currentProject)!.createdAt).toBeInstanceOf(Date); expect(data.get(key())).toBe(raw);
    expect(get(snapshotError)).toBeNull();
  });
  it('rejects a malformed snapshot before replacing the plan or clearing redo', () => {
    const project = get(currentProject)!; updateWall('a-0', { thickness: 32.5 }); undo();
    const before = state(), history = get(undoHistoryStore), damaged: any = JSON.parse(before);
    damaged.floors[0].walls[0].start = null;
    const raw = JSON.stringify([{ timestamp: 1, description: 'Damaged', data: JSON.stringify(damaged) }]); data.set(key(), raw);
    expect(restoreSnapshot(project.id, 0)).toBe(false); expect(state()).toBe(before);
    expect(get(undoHistoryStore)).toEqual(history); expect(data.get(key())).toBe(raw);
    expect(get(snapshotError)).toContain('walls[0].start');
    redo(); expect(get(currentProject)!.floors[0].walls[0].thickness).toBe(32.5);
  });
  it('does not restore a version from another project', () => {
    const before = state(), other = roomProject();
    data.set(key(), JSON.stringify([{ timestamp: 1, description: 'Wrong project', data: JSON.stringify(other) }]));
    expect(restoreSnapshot(get(currentProject)!.id, 0)).toBe(false); expect(state()).toBe(before);
    expect(get(snapshotError)).toContain('different project');
  });
  it.each(['{broken', 'null', '{}', '[null]', '[{"timestamp":1,"description":{},"data":"{}"}]'])('keeps unreadable history bytes and exposes recovery: %s', raw => {
    data.set(key(), raw); expect(() => getSnapshots(get(currentProject)!.id)).toThrow('could not be read');
    refreshSnapshots(); expect(get(snapshotsStore)).toEqual([]); expect(get(snapshotError)).toContain('Download a backup');
    saveSnapshot(get(currentProject)!, 'Auto-save'); expect(data.get(key())).toBe(raw);
  });
  it('retains the existing ten-snapshot bound for readable history', () => {
    for (let i = 0; i < 12; i++) saveSnapshot(get(currentProject)!, `Version ${i}`);
    const entries = getSnapshots(get(currentProject)!.id);
    expect(entries).toHaveLength(10); expect(entries[0].description).toBe('Version 2');
  });
});
