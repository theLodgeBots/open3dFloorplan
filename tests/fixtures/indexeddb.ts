import { beforeEach, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { withDatabase, transaction, request, records, type StoreName } from '$lib/services/localDatabase';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });

export function mockStorage(data = new Map<string, string>()) {
  vi.stubGlobal('localStorage', {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: (key: string) => data.delete(key),
  });
  return data;
}
export function rawRecords(store: StoreName = 'projects') {
  return withDatabase(db => transaction(db, [store], 'readonly', tx => records(tx, store)));
}
export function putRaw(store: StoreName, id: string, raw: string) {
  return withDatabase(db => transaction(db, [store], 'readwrite', async tx => { await request(tx.objectStore(store).put(raw, id)); }));
}
export function failWrites(store: StoreName = 'projects') {
  const originalPut = IDBObjectStore.prototype.put, originalAdd = IDBObjectStore.prototype.add;
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === store) throw new DOMException('Full', 'QuotaExceededError');
    return originalPut.apply(this, args);
  });
  const add = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === store) throw new DOMException('Full', 'QuotaExceededError');
    return originalAdd.apply(this, args);
  });
  return () => { put.mockRestore(); add.mockRestore(); };
}
