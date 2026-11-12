import type { AppEvent, ParkingLotItem, Session, Settings, Task } from '../../types';
import { BroadcastChangeNotifier, CollectionStore, ValueStore } from './CollectionStore';
import type { IChangeNotifier } from './CollectionStore';
import { IdbBackend, openDatabase, requestPersistentStorage, SETTINGS_KEY } from './idb';
import type { IStoreBackend } from './idb';

const byCreatedAt = (a: Task | ParkingLotItem, b: Task | ParkingLotItem) =>
  a.createdAt.localeCompare(b.createdAt);

const bySessionStart = (a: Session, b: Session) => a.startTime.localeCompare(b.startTime);

/** Event ids sort chronologically (see generateEventId), which keeps the log in order. */
const byEventId = (a: AppEvent, b: AppEvent) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Everything the store holds, as handed to {@link DataStore.replaceAll}. */
export interface DataSnapshot {
  settings: Settings;
  tasks: Task[];
  sessions: Session[];
  events: AppEvent[];
  parkingLot: ParkingLotItem[];
}

/**
 * Everything the app stores, held in memory and mirrored to IndexedDB.
 * Repositories and hooks read from here synchronously.
 */
export class DataStore {
  readonly tasks: CollectionStore<Task>;
  readonly sessions: CollectionStore<Session>;
  readonly settings: ValueStore<Settings>;
  readonly events: CollectionStore<AppEvent>;
  readonly parkingLot: CollectionStore<ParkingLotItem>;

  /**
   * True when IndexedDB could not be opened, so this store keeps nothing
   * across reloads. Callers should not offer to restore backups into it.
   */
  readonly storageUnavailable: boolean;

  constructor(
    private readonly backend: IStoreBackend | null = null,
    options: { storageUnavailable?: boolean; notifier?: IChangeNotifier } = {},
  ) {
    this.storageUnavailable = options.storageUnavailable ?? false;
    this.notifier = options.notifier;
    const n = options.notifier;
    this.tasks = new CollectionStore<Task>('tasks', backend, byCreatedAt, n);
    this.sessions = new CollectionStore<Session>('sessions', backend, bySessionStart, n);
    this.settings = new ValueStore<Settings>('settings', backend, n);
    this.events = new CollectionStore<AppEvent>('events', backend, byEventId, n);
    this.parkingLot = new CollectionStore<ParkingLotItem>('parkingLot', backend, byCreatedAt, n);
  }

  private readonly notifier?: IChangeNotifier;

  async hydrate(): Promise<void> {
    await Promise.all([
      this.tasks.hydrate(),
      this.sessions.hydrate(),
      this.settings.hydrate(),
      this.events.hydrate(),
      this.parkingLot.hydrate(),
    ]);
  }

  /** Resolves once every queued write has reached the database; rejects if one failed. */
  async flush(): Promise<void> {
    const results = await Promise.allSettled([
      this.tasks.flush(),
      this.sessions.flush(),
      this.settings.flush(),
      this.events.flush(),
      this.parkingLot.flush(),
    ]);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }

  /**
   * Replaces all data, e.g. when restoring a backup. The database is changed in
   * one transaction, so if saving fails nothing is lost: the promise rejects and
   * both the database and the in-memory copy keep their previous contents.
   */
  async replaceAll(snapshot: DataSnapshot): Promise<void> {
    if (this.backend) {
      // Let earlier writes land first so they cannot overwrite the restore.
      await this.flush().catch(() => undefined);
      await this.backend.replaceStores([
        { store: 'tasks', values: snapshot.tasks },
        { store: 'sessions', values: snapshot.sessions },
        { store: 'settings', values: [snapshot.settings], key: SETTINGS_KEY },
        { store: 'events', values: snapshot.events },
        { store: 'parkingLot', values: snapshot.parkingLot },
      ]);
    }
    this.tasks.setItems(snapshot.tasks);
    this.sessions.setItems(snapshot.sessions);
    this.settings.setValue(snapshot.settings);
    this.events.setItems(snapshot.events);
    this.parkingLot.setItems(snapshot.parkingLot);
    for (const store of ['tasks', 'sessions', 'settings', 'events', 'parkingLot'] as const) {
      this.notifier?.notify(store);
    }
  }

  /** Deletes everything, including the event log. */
  async clearAll(): Promise<void> {
    this.tasks.clear();
    this.sessions.clear();
    this.settings.clear();
    this.events.clear();
    this.parkingLot.clear();
    await this.flush();
  }
}

let instance: DataStore | null = null;

/**
 * The app-wide store. Before {@link initDataStore} has run (tests, or a browser
 * without IndexedDB) this is an in-memory store that nothing persists.
 */
export function getDataStore(): DataStore {
  if (!instance) instance = new DataStore();
  return instance;
}

/** Replaces the app-wide store. Tests use this to start from a clean slate. */
export function setDataStore(store: DataStore | null): void {
  instance = store;
}

/**
 * Opens the database, loads everything into memory and asks the browser to
 * keep the data. Call once before rendering. If IndexedDB is unavailable the
 * app still runs, but nothing is saved.
 */
export async function initDataStore(): Promise<DataStore> {
  try {
    const db = await openDatabase();
    const store = new DataStore(new IdbBackend(db), { notifier: new BroadcastChangeNotifier() });
    await store.hydrate();
    instance = store;
    void requestPersistentStorage();
  } catch (err) {
    console.error('initDataStore: IndexedDB is unavailable, data will not be saved', err);
    instance = new DataStore(null, { storageUnavailable: true });
  }
  return instance;
}
