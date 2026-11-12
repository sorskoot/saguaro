/**
 * Thin promise wrapper around IndexedDB. Everything the app persists lives in
 * one database, `saguaro`, which is separate from the old localStorage keys
 * (D2: fresh start, nothing is migrated).
 */

export const DB_NAME = 'saguaro';
export const DB_VERSION = 1;

/** Object stores, one per kind of data. `settings` holds one record under {@link SETTINGS_KEY}. */
export const STORE_NAMES = ['tasks', 'sessions', 'settings', 'events', 'parkingLot'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const SETTINGS_KEY = 'current';

/** The small async surface the rest of the app needs from a database. */
export interface IStoreBackend {
  loadAll<T>(store: StoreName): Promise<T[]>;
  put<T>(store: StoreName, value: T, key?: IDBValidKey): Promise<void>;
  putMany<T>(store: StoreName, values: T[]): Promise<void>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

export function openDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (db.objectStoreNames.contains(name)) continue;
        // `settings` uses out-of-line keys; every other store is keyed by `id`.
        db.createObjectStore(name, name === 'settings' ? undefined : { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('Opening IndexedDB was blocked by another tab'));
  });
}

export class IdbBackend implements IStoreBackend {
  constructor(private readonly db: IDBDatabase) {}

  /** Runs `work` in one transaction and resolves with its result once the transaction commits. */
  private transact<R>(
    store: StoreName,
    mode: IDBTransactionMode,
    work: (objectStore: IDBObjectStore) => IDBRequest<R> | undefined,
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const request = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(request?.result as R);
      tx.onerror = () => reject(tx.error ?? request?.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  loadAll<T>(store: StoreName): Promise<T[]> {
    return this.transact<T[]>(store, 'readonly', (s) => s.getAll());
  }

  async put<T>(store: StoreName, value: T, key?: IDBValidKey): Promise<void> {
    await this.transact(store, 'readwrite', (s) => s.put(value, key));
  }

  async putMany<T>(store: StoreName, values: T[]): Promise<void> {
    await this.transact(store, 'readwrite', (s) => {
      for (const value of values) s.put(value);
      return undefined;
    });
  }

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    await this.transact(store, 'readwrite', (s) => s.delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    await this.transact(store, 'readwrite', (s) => s.clear());
  }
}

/**
 * Asks the browser not to evict the database under storage pressure.
 * Resolves to whether storage is persistent; never throws.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage?.persist) return false;
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
