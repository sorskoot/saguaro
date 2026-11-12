import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  IdbBackend,
  openDatabase,
  requestPersistentStorage,
  SETTINGS_KEY,
  STORE_NAMES,
} from './idb';
import { CollectionStore, ValueStore } from './CollectionStore';
import type { IChangeNotifier } from './CollectionStore';
import { DataStore } from './DataStore';

interface Item {
  id: string;
  n: number;
}

async function freshBackend(): Promise<IdbBackend> {
  return new IdbBackend(await openDatabase(new IDBFactory()));
}

describe('openDatabase', () => {
  it('creates every object store', async () => {
    const db = await openDatabase(new IDBFactory());
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
  });
});

describe('IdbBackend', () => {
  it('puts, loads, deletes and clears records', async () => {
    const backend = await freshBackend();
    await backend.put('tasks', { id: 'b', n: 2 });
    await backend.put('tasks', { id: 'a', n: 1 });
    await backend.put('tasks', { id: 'a', n: 3 });

    expect(await backend.loadAll<Item>('tasks')).toEqual([
      { id: 'a', n: 3 },
      { id: 'b', n: 2 },
    ]);

    await backend.delete('tasks', 'a');
    expect(await backend.loadAll<Item>('tasks')).toEqual([{ id: 'b', n: 2 }]);

    await backend.putMany('tasks', [
      { id: 'c', n: 4 },
      { id: 'd', n: 5 },
    ]);
    expect(await backend.loadAll('tasks')).toHaveLength(3);

    await backend.clear('tasks');
    expect(await backend.loadAll('tasks')).toEqual([]);
  });

  it('keeps stores separate and stores settings under a fixed key', async () => {
    const backend = await freshBackend();
    await backend.put('tasks', { id: 'x', n: 1 });
    await backend.put('settings', { spikeMinimum: 30 }, SETTINGS_KEY);
    await backend.put('settings', { spikeMinimum: 40 }, SETTINGS_KEY);

    expect(await backend.loadAll('sessions')).toEqual([]);
    expect(await backend.loadAll('settings')).toEqual([{ spikeMinimum: 40 }]);
  });
});

describe('CollectionStore', () => {
  it('works in memory without a backend', () => {
    const store = new CollectionStore<Item>('tasks');
    store.save({ id: 'a', n: 1 });
    store.save({ id: 'b', n: 2 });
    store.save({ id: 'a', n: 3 });

    expect(store.findAll()).toEqual([
      { id: 'a', n: 3 },
      { id: 'b', n: 2 },
    ]);
    expect(store.findById('b')).toEqual({ id: 'b', n: 2 });

    store.delete('a');
    expect(store.findAll()).toEqual([{ id: 'b', n: 2 }]);
  });

  it('returns a copy of the list so callers cannot reorder the store', () => {
    const store = new CollectionStore<Item>('tasks');
    store.save({ id: 'a', n: 1 });
    store.findAll().pop();
    expect(store.findAll()).toHaveLength(1);
  });

  it('writes through to IndexedDB and rehydrates in the configured order', async () => {
    const backend = await freshBackend();
    const byN = (a: Item, b: Item) => a.n - b.n;
    const store = new CollectionStore<Item>('tasks', backend, byN);
    store.save({ id: 'z', n: 1 });
    store.save({ id: 'a', n: 2 });
    store.save({ id: 'm', n: 3 });
    store.delete('m');
    await store.flush();

    const reopened = new CollectionStore<Item>('tasks', backend, byN);
    await reopened.hydrate();
    expect(reopened.findAll()).toEqual([
      { id: 'z', n: 1 },
      { id: 'a', n: 2 },
    ]);
  });

  it('replaceAll swaps the persisted contents', async () => {
    const backend = await freshBackend();
    const store = new CollectionStore<Item>('tasks', backend);
    store.save({ id: 'old', n: 1 });
    store.replaceAll([{ id: 'new', n: 2 }]);
    await store.flush();

    expect(await backend.loadAll('tasks')).toEqual([{ id: 'new', n: 2 }]);

    store.clear();
    await store.flush();
    expect(await backend.loadAll('tasks')).toEqual([]);
  });

  it('reports failed writes through flush() and keeps later writes going', async () => {
    const backend = await freshBackend();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = backend.put.bind(backend);
    const put = vi
      .spyOn(backend, 'put')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(original);

    const store = new CollectionStore<Item>('tasks', backend);
    store.save({ id: 'a', n: 1 });
    store.save({ id: 'b', n: 2 });

    await expect(store.flush()).rejects.toThrow('disk full');
    expect(put).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
    expect(await backend.loadAll('tasks')).toEqual([{ id: 'b', n: 2 }]);

    // The failure is reported once; after that the queue is healthy again.
    await expect(store.flush()).resolves.toBeUndefined();
    error.mockRestore();
  });

  it('keeps the old records when replaceAll cannot store a new one', async () => {
    const backend = await freshBackend();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = new CollectionStore<Item>('tasks', backend);
    store.save({ id: 'keep', n: 1 });
    await store.flush();

    // Functions cannot be stored in IndexedDB.
    store.replaceAll([{ id: 'new', n: 2 }, { id: 'bad', n: () => 1 } as unknown as Item]);
    await expect(store.flush()).rejects.toBeDefined();

    expect(await backend.loadAll('tasks')).toEqual([{ id: 'keep', n: 1 }]);
    error.mockRestore();
  });
});

describe('DataStore.replaceAll', () => {
  const settings = { spikeMinimum: 25 } as never;

  it('replaces every store in one transaction and updates memory', async () => {
    const backend = await freshBackend();
    const data = new DataStore(backend);
    data.tasks.save({ id: 'old', name: 'Old', color: '#000', state: 'open', createdAt: 'x' });
    await data.flush();

    const task = { id: 'new', name: 'New', color: '#000', state: 'open', createdAt: 'y' } as const;
    await data.replaceAll({ settings, tasks: [task], sessions: [], events: [], parkingLot: [] });

    expect(data.tasks.findAll()).toEqual([task]);
    expect(data.settings.get()).toEqual(settings);
    expect(await backend.loadAll('tasks')).toEqual([task]);
    expect(await backend.loadAll('settings')).toEqual([settings]);
  });

  it('rejects and keeps both database and memory unchanged when saving fails', async () => {
    const backend = await freshBackend();
    const data = new DataStore(backend);
    const keep = { id: 'keep', name: 'Keep', color: '#000', state: 'open', createdAt: 'x' } as const;
    data.tasks.save(keep);
    await data.flush();

    const bad = { id: 'bad', n: () => 1 } as never;
    await expect(
      data.replaceAll({ settings, tasks: [bad], sessions: [], events: [], parkingLot: [] }),
    ).rejects.toBeDefined();

    expect(data.tasks.findAll()).toEqual([keep]);
    expect(await backend.loadAll('tasks')).toEqual([keep]);
  });
});

describe('cross-tab refresh', () => {
  /** Two notifiers wired together like two tabs sharing a BroadcastChannel. */
  function pairedNotifiers(): [IChangeNotifier, IChangeNotifier] {
    const listeners: [Map<string, Array<() => void>>, Map<string, Array<() => void>>] = [
      new Map(),
      new Map(),
    ];
    const make = (me: 0 | 1): IChangeNotifier => ({
      notify: (store) => listeners[1 - me].get(store)?.forEach((l) => l()),
      subscribe: (store, l) => listeners[me].set(store, [...(listeners[me].get(store) ?? []), l]),
    });
    return [make(0), make(1)];
  }

  it('reloads a store when another tab writes to it', async () => {
    const backend = await freshBackend();
    const [a, b] = pairedNotifiers();
    const tabA = new CollectionStore<Item>('tasks', backend, undefined, a);
    const tabB = new CollectionStore<Item>('tasks', backend, undefined, b);

    tabA.save({ id: 'x', n: 1 });
    await tabA.flush();
    await vi.waitFor(() => expect(tabB.findAll()).toEqual([{ id: 'x', n: 1 }]));

    // Tab B now merges against the latest record, not a stale copy.
    tabB.save({ id: 'x', n: 2 });
    await tabB.flush();
    await vi.waitFor(() => expect(tabA.findById('x')).toEqual({ id: 'x', n: 2 }));
  });

  it('reloads settings and tells other tabs after a restore', async () => {
    const backend = await freshBackend();
    const [a, b] = pairedNotifiers();
    const tabA = new DataStore(backend, { notifier: a });
    const tabB = new DataStore(backend, { notifier: b });

    await tabA.replaceAll({
      settings: { spikeMinimum: 40 } as never,
      tasks: [{ id: 't', name: 'T', color: '#000', state: 'open', createdAt: 'x' }],
      sessions: [],
      events: [],
      parkingLot: [],
    });

    await vi.waitFor(() => expect(tabB.tasks.findAll()).toHaveLength(1));
    await vi.waitFor(() => expect(tabB.settings.get()).toEqual({ spikeMinimum: 40 }));
  });
});

describe('ValueStore', () => {
  it('holds one value and persists it', async () => {
    const backend = await freshBackend();
    const store = new ValueStore<{ a: number }>('settings', backend);
    expect(store.get()).toBeNull();

    store.set({ a: 1 });
    store.set({ a: 2 });
    await store.flush();

    const reopened = new ValueStore<{ a: number }>('settings', backend);
    await reopened.hydrate();
    expect(reopened.get()).toEqual({ a: 2 });

    reopened.clear();
    await reopened.flush();
    expect(await backend.loadAll('settings')).toEqual([]);
  });
});

describe('requestPersistentStorage', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original);
    else Reflect.deleteProperty(navigator, 'storage');
  });

  function stubStorage(storage: unknown) {
    Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
  }

  it('asks the browser for persistent storage', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn();
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false when the API is missing or throws', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
    stubStorage({ persist: vi.fn().mockRejectedValue(new Error('nope')) });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
