import { mockStorage, rawRecords, failWrites } from './fixtures/indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localStore } from '$lib/services/datastore';
import { createDefaultProject } from '$lib/stores/project';

const key = 'floorplan_projects';
let data: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  data = mockStorage();
  setItem = vi.mocked(localStorage.setItem);
});

describe('local project persistence', () => {
  it('round trips a project and its dates without changing other projects', async () => {
    const first = createDefaultProject('First');
    const second = createDefaultProject('Second');
    second.floors[0].elevation = -325.5;
    await localStore.save(first);
    await localStore.save(second);
    second.name = 'Renamed';
    await localStore.save(second);
    expect(await localStore.load(first.id)).toEqual(first);
    expect(await localStore.load(second.id)).toEqual(second);
    expect(await localStore.list()).toHaveLength(2);
  });

  it('rejects a quota failure and preserves every previously saved byte', async () => {
    const first = createDefaultProject('First');
    const second = createDefaultProject('Second');
    await localStore.save(first);
    await localStore.save(second);
    const before = await rawRecords();
    const restore = failWrites();
    second.name = 'Unsaved change';
    await expect(localStore.save(second)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await rawRecords()).toEqual(before);
    restore();
  });

  it.each(['{broken', 'null', '[]', '{"existing":42}'])('refuses to overwrite an unreadable library: %s', async (raw) => {
    data.set(key, raw);
    await expect(localStore.save(createDefaultProject())).rejects.toThrow('could not be read');
    await expect(localStore.delete('existing')).rejects.toThrow('could not be read');
    expect(data.get(key)).toBe(raw);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('propagates denied storage access', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new DOMException('Denied', 'SecurityError'); } });
    await expect(localStore.save(createDefaultProject())).rejects.toMatchObject({ name: 'SecurityError' });
  });

  it('does not create a partial duplicate when storage fills up', async () => {
    const project = createDefaultProject();
    await localStore.save(project);
    const before = await rawRecords();
    failWrites();
    await expect(localStore.duplicate(project.id)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await rawRecords()).toEqual(before);
  });
});

it('rejects damaged nested geometry on load and duplicate without rewriting the library', async () => {
  const project = createDefaultProject('Damaged');
  const damaged: any = JSON.parse(JSON.stringify(project));
  damaged.floors[0].walls = [{ id: 'wall', start: null, end: { x: 200, y: 0 }, thickness: 15 }];
  const raw = JSON.stringify({ [project.id]: JSON.stringify(damaged) }); data.set(key, raw);
  await expect(localStore.load(project.id)).rejects.toThrow('walls[0].start');
  await expect(localStore.duplicate(project.id)).rejects.toThrow('walls[0].start');
  expect(data.get(key)).toBe(raw); expect(setItem).not.toHaveBeenCalled();
});

it('does not load a project under another library entry ID', async () => {
  const project = createDefaultProject();
  data.set(key, JSON.stringify({ wrong: JSON.stringify(project) }));
  await expect(localStore.load('wrong')).rejects.toThrow('does not match');
  expect(setItem).not.toHaveBeenCalled();
});

it.each(['__proto__', 'constructor', 'toString', 'a project?with#punctuation&spaces'])('round trips an imported project ID as data: %s', async id => {
  const neighbor = createDefaultProject('Keep me'); await localStore.save(neighbor);
  const project = { ...createDefaultProject('Imported'), id };
  await localStore.save(project);
  expect(await localStore.load(id)).toEqual(project);
  expect(await localStore.load(neighbor.id)).toEqual(neighbor);
  expect(await localStore.list()).toHaveLength(2);
  await localStore.delete(id); expect(await localStore.load(id)).toBeNull();
  expect(await localStore.load(neighbor.id)).toEqual(neighbor);
});

it('does not mistake inherited object properties for saved projects', async () => {
  await expect(localStore.load('constructor')).resolves.toBeNull();
  await expect(localStore.load('__proto__')).resolves.toBeNull();
});
