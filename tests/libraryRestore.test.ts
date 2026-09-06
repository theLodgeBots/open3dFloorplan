import { beforeEach, expect, it, vi } from 'vitest';
import { IDBObjectStore } from 'fake-indexeddb';
import { get } from 'svelte/store';
import { prepareLibraryRestore } from '$lib/services/libraryRestore';
import { libraryBackup, PROJECTS_STORAGE_KEY } from '$lib/services/localDatabase';
import { createLocalStore } from '$lib/services/datastore';
import { currentProject, loadProject, updateProjectName, undoHistoryStore } from '$lib/stores/project';
import { getSnapshots, restoreSnapshot } from '$lib/stores/versionHistory';
import { roomProject } from './fixtures/project';
import { mockStorage, rawRecords, putRaw, failWrites } from './fixtures/indexeddb';

let storage: Map<string, string>;
beforeEach(() => { storage = mockStorage(); });
const rawMap = (...projects: ReturnType<typeof roomProject>[]) => Object.fromEntries(projects.map(p => [p.id, JSON.stringify(p)]));
function bundle(projects = rawMap(roomProject()), extra: Record<string, unknown> = {}) {
  return JSON.stringify({ format: 'openplan3d-library', version: 1, projects, thumbnails: {}, history: {}, ...extra });
}
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const version = (project: ReturnType<typeof roomProject>, description = 'Before edit') => ({ timestamp: 123, description, data: JSON.stringify(project), annotation: 'Preserve snapshot metadata' });

it('previews a current backup without reading storage or changing the editor', () => {
  const project = roomProject(); loadProject(structuredClone(project)); updateProjectName('Pending current work');
  const current = get(currentProject), history = get(undoHistoryStore);
  const open = vi.spyOn(indexedDB, 'open'), read = vi.spyOn(localStorage, 'getItem');
  const preview = prepareLibraryRestore(bundle(rawMap(project)));
  expect(preview.projectCount).toBe(1); expect(preview.entries[0].name).toBe(project.name);
  expect(open).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  expect(get(currentProject)).toBe(current); expect(get(undoHistoryStore)).toEqual(history);
});

it('restores independent project, thumbnail and remapped history without overwriting the existing entry', async () => {
  const project = roomProject(), old = structuredClone(project), store = createLocalStore();
  old.floors[0].walls[0].thickness = 27.25;
  await store.save(project); const existing = (await rawRecords())[project.id];
  loadProject(structuredClone(project)); updateProjectName('Unsaved current plan');
  const current = get(currentProject), undo = get(undoHistoryStore);
  const preview = prepareLibraryRestore(bundle(rawMap(project), {
    thumbnails: { [project.id]: pixel }, history: { [project.id]: JSON.stringify([version(old)]) },
  }));
  const result = await preview.restore(), copy = result.projects[0];
  expect(copy.id).not.toBe(project.id); expect(copy.name).toBe('Regression plan (Restored copy)');
  expect((await rawRecords())[project.id]).toBe(existing);
  expect(await store.getThumbnail(copy.id)).toBe(pixel);
  const snapshots = await getSnapshots(copy.id);
  expect(snapshots[0]).toMatchObject({ timestamp: 123, annotation: 'Preserve snapshot metadata' });
  expect(JSON.parse(snapshots[0].data).id).toBe(copy.id);
  expect(get(currentProject)).toBe(current); expect(get(undoHistoryStore)).toEqual(undo);
  loadProject((await store.load(copy.id))!);
  expect(await restoreSnapshot(copy.id, 0, snapshots[0])).toBe(true);
  expect(get(currentProject)!.floors[0].walls[0].thickness).toBe(27.25);
});

it.each(['__proto__', 'constructor', 'toString', 'id?with#punctuation & spaces'])('restores a legacy map containing the source ID %s safely', async id => {
  const project = { ...roomProject(), id };
  const preview = prepareLibraryRestore(JSON.stringify(rawMap(project)));
  expect(preview.projectCount).toBe(1);
  const restored = await preview.restore();
  expect(restored.projects[0].id).not.toBe(id);
  expect((await createLocalStore().load(restored.projects[0].id))!.floors).toEqual(project.floors);
});

it('never selects a source, existing, or already-restored ID for another copy', async () => {
  const a = roomProject(), b = roomProject(), existing = roomProject(); await createLocalStore().save(existing);
  const preview = prepareLibraryRestore(bundle(rawMap(a, b)));
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce(a.id).mockReturnValueOnce(existing.id)
    .mockReturnValueOnce('copy-one').mockReturnValueOnce('copy-one').mockReturnValueOnce('copy-two').mockReturnValue('signal') });
  expect((await preview.restore()).projects.map(p => p.id)).toEqual(['copy-one', 'copy-two']);
  expect(await createLocalStore().list()).toHaveLength(3);
});

it('keeps damaged project/history bytes and orphan previews in downloadable recovery data', async () => {
  const project = roomProject(), broken = '{damaged project bytes', history = '{damaged history bytes';
  const preview = prepareLibraryRestore(bundle({ ...rawMap(project), broken }, {
    history: { [project.id]: history, orphan: '{orphan history' }, thumbnails: { orphan: 'original thumbnail bytes' },
    legacy: { original: { floorplan_projects: '{original legacy bytes' } }, note: { keep: true },
  }), 'Recovery source.json');
  expect(preview.projectCount).toBe(1); expect(preview.entries[1].restorable).toBe(false);
  const result = await preview.restore(); expect(result.projects).toHaveLength(1);
  const backup = JSON.parse(await libraryBackup());
  const recovery: any = JSON.parse(Object.values(backup.recovery)[0] as string);
  expect(recovery.projects.broken).toBe(broken); expect(recovery.history[project.id]).toBe(history);
  expect(recovery.thumbnails.orphan).toBe('original thumbnail bytes');
  expect(recovery.metadata.legacy.original.floorplan_projects).toBe('{original legacy bytes');
  expect(recovery.metadata.note).toEqual({ keep: true });
});

it('restores valid versions, retains damaged/mismatched ones raw, and bounds history at ten', async () => {
  const project = roomProject(), other = roomProject();
  const items = [null, version(other), ...Array.from({ length: 12 }, (_, i) => version(project, `Version ${i}`))];
  const original = JSON.stringify(items);
  const preview = prepareLibraryRestore(bundle(rawMap(project), { history: { [project.id]: original } }));
  expect(preview.entries[0].versions).toBe(10); expect(preview.entries[0].warnings).toHaveLength(2);
  const result = await preview.restore(), snapshots = await getSnapshots(result.projects[0].id);
  expect(snapshots[0].description).toBe('Version 2'); expect(snapshots).toHaveLength(10);
  const backup = JSON.parse(await libraryBackup());
  expect(JSON.parse(Object.values(backup.recovery)[0] as string).history[project.id]).toBe(original);
});

it('retains remote/SVG previews as recovery data instead of loading them into library cards', async () => {
  const a = roomProject(), b = roomProject();
  const preview = prepareLibraryRestore(bundle(rawMap(a, b), { thumbnails: { [a.id]: 'https://example.invalid/image.png', [b.id]: 'data:image/svg+xml,<svg/>' } }));
  expect(preview.entries.every(e => e.warnings.length === 1)).toBe(true);
  await preview.restore(); expect(await rawRecords('thumbnails')).toEqual({});
  expect(Object.keys(JSON.parse(await libraryBackup()).recovery)).toHaveLength(1);
});

it('carries prior recovery archives flat and preserves colliding archive IDs', async () => {
  await putRaw('meta', 'library-recovery:existing', '{existing raw recovery');
  const preview = prepareLibraryRestore(bundle({}, { recovery: { existing: '{different incoming recovery', same: '{other recovery' } }));
  const result = await preview.restore(); expect(result.projects).toHaveLength(0);
  const backup = JSON.parse(await libraryBackup());
  expect(Object.values(backup.recovery).sort()).toEqual(['{existing raw recovery', '{different incoming recovery', '{other recovery'].sort());
  await prepareLibraryRestore(JSON.stringify(backup)).restore();
  const again = JSON.parse(await libraryBackup());
  expect(again.recovery).toEqual(backup.recovery); // No recursive archive or duplicated payload.
});

it.each(['projects', 'thumbnails', 'history', 'meta'] as const)('rolls back the whole restore after a %s quota failure and supports retry', async failedStore => {
  const source = roomProject(), existing = roomProject(); await createLocalStore().save(existing);
  const before = await libraryBackup();
  const preview = prepareLibraryRestore(bundle({ ...rawMap(source), broken: '{raw' }, {
    history: { [source.id]: JSON.stringify([version(source)]) }, thumbnails: { [source.id]: pixel },
  }));
  const stop = failWrites(failedStore);
  await expect(preview.restore()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(await libraryBackup()).toBe(before);
  stop(); expect((await preview.restore()).projects).toHaveLength(1);
  expect(await createLocalStore().list()).toHaveLength(2);
});

it('rolls back an abort after successful project requests, including migration markers', async () => {
  const a = roomProject(), b = roomProject(), preview = prepareLibraryRestore(bundle(rawMap(a, b)));
  const before = await libraryBackup(), controller = new AbortController(), original = IDBObjectStore.prototype.add;
  let added = 0;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args) {
    const req = original.apply(this, args);
    if (this.name === 'projects' && ++added === 2) req.addEventListener('success', () => controller.abort());
    return req;
  });
  await expect(preview.restore(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(await libraryBackup()).toBe(before);
  spy.mockRestore(); expect((await preview.restore()).projects).toHaveLength(2);
});

it('shares a pending restore and never repeats an already committed preview', async () => {
  const preview = prepareLibraryRestore(bundle());
  const first = preview.restore(), second = preview.restore(); expect(first).toBe(second);
  const result = await first;
  expect(await preview.restore()).toBe(result); expect(await createLocalStore().list()).toHaveLength(1);
});

it('rejects a cancelled restore before opening storage', async () => {
  const preview = prepareLibraryRestore(bundle()), signal = AbortSignal.abort();
  const open = vi.spyOn(indexedDB, 'open');
  await expect(preview.restore(signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(open).not.toHaveBeenCalled();
});

it('preserves a damaged destination legacy map and can restore without losing existing database records', async () => {
  const existing = roomProject(); await createLocalStore().save(existing);
  storage.set(PROJECTS_STORAGE_KEY, '{damaged destination bytes');
  const preview = prepareLibraryRestore(bundle());
  const result = await preview.restore();
  expect(await createLocalStore().list()).toHaveLength(2);
  expect(storage.get(PROJECTS_STORAGE_KEY)).toBe('{damaged destination bytes');
  const backup = JSON.parse(await libraryBackup());
  expect(backup.legacy.current.floorplan_projects).toBe('{damaged destination bytes');
  expect(backup.projects[existing.id]).toBe(JSON.stringify(existing));
  expect(backup.projects[result.projects[0].id]).toBeTruthy();
});

it('does not advance a damaged destination migration marker when restore fails', async () => {
  storage.set(PROJECTS_STORAGE_KEY, '{damaged destination bytes');
  const preview = prepareLibraryRestore(bundle()), stop = failWrites();
  await expect(preview.restore()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(await libraryBackup()).toBe('{damaged destination bytes');
  stop(); await preview.restore();
  expect(await createLocalStore().list()).toHaveLength(1);
  expect(JSON.parse(await libraryBackup()).legacy.original.floorplan_projects).toBe('{damaged destination bytes');
});

it('shows damaged saved entries alongside restored projects and keeps their bytes downloadable', async () => {
  await putRaw('projects', 'damaged', '{original damaged bytes');
  await prepareLibraryRestore(bundle()).restore();
  const store = createLocalStore(), list = await store.list();
  expect(list).toHaveLength(2); expect(list.find(p => p.id === 'damaged')!.name).toContain('Unreadable project');
  await expect(store.load('damaged')).rejects.toThrow();
  expect(JSON.parse(await libraryBackup()).projects.damaged).toBe('{original damaged bytes');
});

it('preserves embedded images and unknown fields in a project larger than localStorage', async () => {
  const project = { ...roomProject(), extensions: { image: 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024) } };
  project.floors[0].backgroundImage = { dataUrl: pixel, position: { x: 1.25, y: -2.5 }, scale: 20, rotation: 0, opacity: 0.5, locked: true };
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  const result = await prepareLibraryRestore(bundle(rawMap(project))).restore();
  const restored = JSON.parse((await rawRecords())[result.projects[0].id]);
  expect(restored.extensions).toEqual(project.extensions); expect(restored.floors[0].backgroundImage).toEqual(project.floors[0].backgroundImage);
});

it.each(['{broken', 'null', '[]', '{"format":"openplan3d-library","version":2,"projects":{}}', '{"format":"openplan3d-library","version":1}', '{"entry":42}', '{"same":"one","same":"two"}', '{"same":"one","\\u0073ame":"two"}'])('rejects an invalid or ambiguous backup before touching storage: %s', raw => {
  const open = vi.spyOn(indexedDB, 'open');
  expect(() => prepareLibraryRestore(raw)).toThrow(); expect(open).not.toHaveBeenCalled();
});

it('rejects mismatched project IDs and malformed geometry while retaining each raw entry', async () => {
  const p = roomProject(), damaged: any = structuredClone(p); damaged.floors[0].walls[0].start = null;
  const originals = { wrong: JSON.stringify(p), [p.id]: JSON.stringify(damaged) };
  const preview = prepareLibraryRestore(bundle(originals));
  expect(preview.projectCount).toBe(0); expect(preview.entries.every(p => !p.restorable)).toBe(true);
  await preview.restore(); expect(await createLocalStore().list()).toEqual([]);
  const backup = JSON.parse(await libraryBackup());
  expect(JSON.parse(Object.values(backup.recovery)[0] as string).projects).toEqual(originals);
});
