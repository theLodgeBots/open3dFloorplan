import { beforeEach, expect, it, vi } from 'vitest';
import { IDBObjectStore } from 'fake-indexeddb';
import { createLocalStore } from '$lib/services/datastore';
import { DATABASE_NAME, PROJECTS_STORAGE_KEY as key, libraryBackup, readRecord, updateRecord } from '$lib/services/localDatabase';
import { roomProject } from './fixtures/project';
import { mockStorage, rawRecords, failWrites } from './fixtures/indexeddb';

let data: Map<string, string>;
beforeEach(() => { data = mockStorage(); });

it('migrates project, preview, embedded image and unreadable history bytes together only once', async () => {
  const project = { ...roomProject(), extensions: { image: 'data:image/png;base64,original' } };
  const raw = JSON.stringify({ [project.id]: JSON.stringify(project), damaged: '{broken project bytes' });
  data.set(key, raw); data.set(`floorplan_thumb_${project.id}`, 'original preview'); data.set(`vh_${project.id}`, '{broken history bytes');
  const before = new Map(data), store = createLocalStore();
  expect((await store.load(project.id))!.floors).toEqual(project.floors);
  expect(await store.getThumbnail(project.id)).toBe('original preview');
  expect(await readRecord('history', project.id)).toBe('{broken history bytes');
  expect(await readRecord('projects', 'damaged')).toBe('{broken project bytes');
  expect(data).toEqual(before);
  await updateRecord('projects', 'damaged', () => null);
  await store.list(); await store.delete(project.id);
  expect(await createLocalStore().list()).toEqual([]);
  expect(await readRecord('history', project.id)).toBeNull();
  expect(await store.getThumbnail(project.id)).toBeNull();
  expect(data.get(key)).toBe(raw);
  const backup = JSON.parse(await libraryBackup());
  expect(backup.projects).toEqual({}); expect(backup.legacy.original[key]).toBe(raw);
});

it('aborts the entire migration on a preview quota failure, then retries from intact source bytes', async () => {
  const project = roomProject(), raw = JSON.stringify({ [project.id]: JSON.stringify(project) });
  data.set(key, raw); data.set(`floorplan_thumb_${project.id}`, 'preview');
  const restore = failWrites('thumbnails');
  await expect(createLocalStore().list()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  // Backup bypasses migration; no partially imported projects or marker survived.
  expect(await libraryBackup()).toBe(raw); expect(data.get(key)).toBe(raw);
  restore();
  expect(await createLocalStore().list()).toHaveLength(1);
  expect(await readRecord('thumbnails', project.id)).toBe('preview');
});

it('rejects an abort after a successful put request and retains its old revision for retry', async () => {
  const store = createLocalStore(), project = roomProject(); await store.save(project);
  const before = await rawRecords(), original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args) {
    const req = original.apply(this, args);
    if (this.name === 'projects') req.addEventListener('success', () => this.transaction.abort());
    return req;
  });
  project.name = 'Interrupted edit';
  await expect(store.save(project)).rejects.toMatchObject({ name: 'AbortError' });
  expect(await rawRecords()).toEqual(before);
  spy.mockRestore(); await store.save(project);
  expect((await store.load(project.id))!.name).toBe('Interrupted edit');
});

it('saves a project larger than localStorage allows even when notification writes are denied', async () => {
  const store = createLocalStore(), project = { ...roomProject(), extensions: { image: 'x'.repeat(6 * 1024 * 1024) } };
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await store.save(project);
  expect(JSON.parse((await rawRecords())[project.id]).extensions.image).toHaveLength(6 * 1024 * 1024);
  expect(data.has(key)).toBe(false);
});

it('preserves late old-release edits as a reusable independent copy without resurrecting deleted originals', async () => {
  const project = roomProject(); data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  const store = createLocalStore(); await store.load(project.id); await store.list(); await store.delete(project.id);
  project.name = 'Old tab first edit'; data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  let list = await store.list(); expect(list).toHaveLength(1); expect(list[0].id).not.toBe(project.id);
  const recoveryId = list[0].id;
  project.name = 'Old tab second edit'; data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  list = await store.list(); expect(list).toHaveLength(1); expect(list[0].id).toBe(recoveryId);
  expect(list[0].name).toBe('Old tab second edit (Recovered from older tab)');
  const recovered = (await store.load(recoveryId))!; recovered.name = 'Edited recovered version'; await store.save(recovered);
  project.name = 'Old tab third edit'; data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  list = await store.list(); expect(list).toHaveLength(2);
  expect((await store.load(recoveryId))!.name).toBe('Edited recovered version');
  expect(await store.has(project.id)).toBe(false);
});

it('migrates once when two fresh clients open simultaneously', async () => {
  const project = roomProject(); data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  const [a, b] = await Promise.all([createLocalStore().load(project.id), createLocalStore().load(project.id)]);
  expect(a).toEqual(b); expect(await createLocalStore().list()).toHaveLength(1);
});

it('retries recovery failures and supports self-hosted contexts without randomUUID', async () => {
  const project = roomProject(); data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  const store = createLocalStore(); await store.load(project.id);
  project.name = 'Old tab edit'; data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  const restore = failWrites();
  await expect(store.list()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  const backup = JSON.parse(await libraryBackup()); expect(Object.keys(backup.projects)).toEqual([project.id]);
  expect(JSON.parse(JSON.parse(backup.legacy.previous[key])[project.id]).name).not.toBe(project.name);
  restore(); vi.stubGlobal('crypto', undefined);
  expect(await store.list()).toHaveLength(2);
  expect((await store.load(project.id))!.name).not.toBe(project.name);
});

it('returns exact damaged legacy bytes for backup even when migration cannot parse them', async () => {
  data.set(key, '{unreadable library');
  await expect(createLocalStore().list()).rejects.toThrow('could not be read');
  expect(await libraryBackup()).toBe('{unreadable library');
});

it('backs up current projects, previews, history and untouched legacy originals together', async () => {
  const project = roomProject(); data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) }));
  const store = createLocalStore(); const next = (await store.load(project.id))!; next.name = 'Current IndexedDB version'; await store.save(next);
  await store.saveThumbnail(project.id, 'current preview'); await updateRecord('history', project.id, () => '{raw damaged history');
  const backup = JSON.parse(await libraryBackup());
  expect(JSON.parse(backup.projects[project.id]).name).toBe(next.name);
  expect(backup.thumbnails[project.id]).toBe('current preview'); expect(backup.history[project.id]).toBe('{raw damaged history');
  expect(JSON.parse(JSON.parse(backup.legacy.original[key])[project.id]).name).toBe(project.name);
});

it('reports denied IndexedDB access without writing or erasing legacy data', async () => {
  const project = roomProject(); data.set(key, JSON.stringify({ [project.id]: JSON.stringify(project) })); const before = new Map(data);
  vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
  await expect(createLocalStore().load(project.id)).rejects.toMatchObject({ name: 'SecurityError' });
  expect(data).toEqual(before);
});

it('closes its connections so a database upgrade is not blocked after a save', async () => {
  await createLocalStore().save(roomProject());
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DATABASE_NAME, 2);
    req.onblocked = () => reject(new Error('Connection leaked'));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { req.result.close(); resolve(); };
  });
});
