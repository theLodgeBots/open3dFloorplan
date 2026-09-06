import { readProject } from '$lib/utils/projectValidation';

export const DATABASE_NAME = 'openplan3d-local';
export const PROJECTS_STORAGE_KEY = 'floorplan_projects';
export const LIBRARY_CHANGE_KEY = 'openplan3d-library-change';
export const STORES = ['projects', 'thumbnails', 'history', 'meta'] as const;
export type StoreName = typeof STORES[number];
type Legacy = Record<string, string>;

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('Browser storage is unavailable. Allow site storage or download your project as JSON.');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    req.onupgradeneeded = () => {
      if (blocked) { req.transaction?.abort(); return; }
      for (const name of STORES) req.result.createObjectStore(name);
    };
    req.onblocked = () => {
      blocked = true;
      reject(new Error('Close other OpenPlan3D tabs, then retry loading to update browser storage. Your saved projects have not been removed.'));
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

/** Only await IndexedDB requests inside run: other work can let a transaction expire. */
export async function transaction<T>(db: IDBDatabase, stores: StoreName[], mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException('The storage transaction was interrupted. Try saving again.', 'AbortError'));
    tx.onerror = () => {}; // Request errors abort; completion, not request success, confirms a save.
  });
  // Observe aborts even when a synchronous validation error stops run first.
  void done.catch(() => {});
  try {
    const value = await run(tx);
    await done;
    return value;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

function legacyStorage(): Legacy {
  const result: Legacy = Object.create(null);
  const library = localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (library !== null) result[PROJECTS_STORAGE_KEY] = library;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('floorplan_thumb_') || key?.startsWith('vh_')) {
      const raw = localStorage.getItem(key);
      if (raw !== null) result[key] = raw;
    }
  }
  return result;
}

function library(raw?: string): Record<string, string> {
  try {
    const value = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(v => typeof v !== 'string')) throw new Error();
    return Object.assign(Object.create(null), value);
  } catch {
    throw new Error('The saved project library could not be read. Download a backup before attempting recovery.');
  }
}

/** Import once in a single transaction; leave all source bytes untouched for recovery.
 * Older releases may still write localStorage. Preserve their subsequent changes as
 * separate copies, never overwrite or resurrect a project in the new library.
 */
async function migrate(db: IDBDatabase) {
  await transaction(db, [...STORES], 'readwrite', async tx => {
    const meta = tx.objectStore('meta');
    const previous: Legacy | undefined = await request(meta.get('legacy-current'));
    const current = legacyStorage();
    if (previous && JSON.stringify(previous) === JSON.stringify(current)) return;
    const projects = tx.objectStore('projects');
    const entries = library(current[PROJECTS_STORAGE_KEY]);
    if (!previous) {
      for (const [id, raw] of Object.entries(entries)) projects.add(raw, id);
      for (const [key, raw] of Object.entries(current)) {
        if (key.startsWith('floorplan_thumb_')) tx.objectStore('thumbnails').add(raw, key.slice(16));
        if (key.startsWith('vh_')) tx.objectStore('history').add(raw, key.slice(3));
      }
      meta.add(current, 'legacy-original');
    } else {
      const before = library(previous[PROJECTS_STORAGE_KEY]);
      for (const [id, raw] of Object.entries(entries)) {
        if (before[id] === raw || await request(projects.get(id)) === raw) continue;
        // Invalid bytes stay available in the full backup. Valid old-tab edits are
        // immediately visible in the library, with their own independent history.
        try {
          const copy = readProject(JSON.parse(raw));
          const link: { id: string; raw: string } | undefined = await request(meta.get(`recovered:${id}`));
          // Continuing work in an old tab updates its untouched recovery copy.
          // Editing/deleting that copy in the new app makes the next recovery independent.
          const reuse = link && await request(projects.get(link.id)) === link.raw;
          copy.id = reuse ? link.id : crypto.randomUUID();
          copy.name = `${copy.name || 'Untitled Project'} (Recovered from older tab)`;
          const recoveredRaw = JSON.stringify(copy);
          if (reuse) projects.put(recoveredRaw, copy.id); else projects.add(recoveredRaw, copy.id);
          meta.put({ id: copy.id, raw: recoveredRaw }, `recovered:${id}`);
          const thumb = current[`floorplan_thumb_${id}`];
          if (thumb) tx.objectStore('thumbnails').put(thumb, copy.id);
        } catch (error) {
          // Parsing failures must not make the existing IndexedDB library unavailable.
          // IDB failures, however, must abort migration and leave its marker unchanged.
          if (error instanceof DOMException) throw error;
        }
      }
    }
    meta.put(current, 'legacy-current');
  });
}

export async function withDatabase<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try { await migrate(db); return await run(db); }
  finally { db.close(); }
}

export function readRecord(store: StoreName, id: string): Promise<string | null> {
  return withDatabase(db => transaction(db, [store], 'readonly', async tx =>
    (await request(tx.objectStore(store).get(id))) ?? null));
}

export function updateRecord(store: StoreName, id: string, update: (raw: string | null) => string | null): Promise<void> {
  return withDatabase(db => transaction(db, [store], 'readwrite', async tx => {
    const records = tx.objectStore(store);
    const raw = update((await request(records.get(id))) ?? null);
    if (raw === null) records.delete(id); else records.put(raw, id);
  }));
}

export async function records(tx: IDBTransaction, name: StoreName): Promise<Record<string, string>> {
  const store = tx.objectStore(name);
  const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
  return Object.fromEntries(keys.map((key, index) => [String(key), values[index]]));
}

/** Recovery deliberately bypasses migration and validation, including damaged bytes. */
export async function libraryBackup(): Promise<string> {
  const db = await openDatabase();
  try {
    return await transaction(db, [...STORES], 'readonly', async tx => {
      const [projects, thumbnails, history, original, previous] = await Promise.all([
        records(tx, 'projects'), records(tx, 'thumbnails'), records(tx, 'history'),
        request(tx.objectStore('meta').get('legacy-original')), request(tx.objectStore('meta').get('legacy-current')),
      ]);
      const current = legacyStorage();
      if (!original && !Object.keys(projects).length && current[PROJECTS_STORAGE_KEY] !== undefined) return current[PROJECTS_STORAGE_KEY];
      return JSON.stringify({ format: 'openplan3d-library', version: 1, projects, thumbnails, history,
        legacy: { original, previous, current } });
    });
  } finally { db.close(); }
}

export function notifyLibraryChange(id: string) {
  // A tiny optional signal, never project data. Commit correctness does not depend
  // on notifications or localStorage quota; focus and saves recheck the database.
  try { localStorage.setItem(LIBRARY_CHANGE_KEY, JSON.stringify({ id, nonce: crypto.randomUUID() })); } catch {}
}
