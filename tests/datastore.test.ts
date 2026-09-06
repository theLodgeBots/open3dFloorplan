import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localStore } from '$lib/services/datastore';
import { createDefaultProject } from '$lib/stores/project';

const key = 'floorplan_projects';
let data: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  data = new Map();
  setItem = vi.fn((key: string, value: string) => { data.set(key, value); });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem,
    removeItem: (key: string) => data.delete(key),
  });
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
    const before = data.get(key);
    // A smaller retry would succeed, reproducing the old destructive fallback.
    setItem.mockImplementation((key: string, value: string) => {
      if (Object.keys(JSON.parse(value)).length > 1) throw new DOMException('Full', 'QuotaExceededError');
      data.set(key, value);
    });
    setItem.mockClear();
    second.name = 'Unsaved change';
    await expect(localStore.save(second)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(data.get(key)).toBe(before);
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
    const before = data.get(key);
    setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(localStore.duplicate(project.id)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(data.get(key)).toBe(before);
  });
});
