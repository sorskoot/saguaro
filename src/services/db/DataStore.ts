import type { AppEvent, ParkingLotItem, Session, Settings, Task } from '../../types';
import { CollectionStore, ValueStore } from './CollectionStore';
import { IdbBackend, openDatabase, requestPersistentStorage } from './idb';
import type { IStoreBackend } from './idb';

const byCreatedAt = (a: Task | ParkingLotItem, b: Task | ParkingLotItem) =>
  a.createdAt.localeCompare(b.createdAt);

const bySessionStart = (a: Session, b: Session) => a.startTime.localeCompare(b.startTime);

/** Event ids sort chronologically (see generateEventId), which keeps the log in order. */
const byEventId = (a: AppEvent, b: AppEvent) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

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

  constructor(backend: IStoreBackend | null = null) {
    this.tasks = new CollectionStore<Task>('tasks', backend, byCreatedAt);
    this.sessions = new CollectionStore<Session>('sessions', backend, bySessionStart);
    this.settings = new ValueStore<Settings>('settings', backend);
    this.events = new CollectionStore<AppEvent>('events', backend, byEventId);
    this.parkingLot = new CollectionStore<ParkingLotItem>('parkingLot', backend, byCreatedAt);
  }

  async hydrate(): Promise<void> {
    await Promise.all([
      this.tasks.hydrate(),
      this.sessions.hydrate(),
      this.settings.hydrate(),
      this.events.hydrate(),
      this.parkingLot.hydrate(),
    ]);
  }

  /** Resolves once every queued write has reached the database. */
  async flush(): Promise<void> {
    await Promise.all([
      this.tasks.flush(),
      this.sessions.flush(),
      this.settings.flush(),
      this.events.flush(),
      this.parkingLot.flush(),
    ]);
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
    const store = new DataStore(new IdbBackend(db));
    await store.hydrate();
    instance = store;
    void requestPersistentStorage();
  } catch (err) {
    console.error('initDataStore: IndexedDB is unavailable, data will not be saved', err);
    instance = new DataStore();
  }
  return instance;
}
