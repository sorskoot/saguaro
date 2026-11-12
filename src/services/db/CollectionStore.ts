import type { IStoreBackend, StoreName } from './idb';
import { SETTINGS_KEY } from './idb';

/**
 * Tells other tabs that a store changed, so they can reload it. Without this a
 * second tab would keep working from a stale copy and could write it back over
 * newer data.
 */
export interface IChangeNotifier {
  /** Announce to the other tabs that `store` was written. */
  notify(store: StoreName): void;
  /** Call `listener` whenever another tab announces a change to `store`. */
  subscribe(store: StoreName, listener: () => void): void;
}

/** {@link IChangeNotifier} over a BroadcastChannel; does nothing where that is unavailable. */
export class BroadcastChangeNotifier implements IChangeNotifier {
  private readonly channel: BroadcastChannel | null;
  private readonly listeners = new Map<StoreName, Set<() => void>>();

  constructor(name = 'saguaro-data') {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name);
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<StoreName>) => {
        this.listeners.get(event.data)?.forEach((listener) => listener());
      };
    }
  }

  notify(store: StoreName): void {
    this.channel?.postMessage(store);
  }

  subscribe(store: StoreName, listener: () => void): void {
    const set = this.listeners.get(store) ?? new Set();
    set.add(listener);
    this.listeners.set(store, set);
  }
}

/**
 * Serialises writes so they reach the database in the order they were made.
 * A failed write is logged and remembered: later writes still run, and the
 * next {@link flush} rejects so callers can tell that something was not saved.
 */
class WriteQueue {
  private tail: Promise<void> = Promise.resolve();
  private failure: unknown = null;

  constructor(
    private readonly label: string,
    private readonly backend: IStoreBackend | null,
    private readonly onWritten?: () => void,
  ) {}

  enqueue(write: (backend: IStoreBackend) => Promise<void>): void {
    const backend = this.backend;
    if (!backend) return;
    this.tail = this.tail
      .then(() => write(backend))
      .then(() => this.onWritten?.())
      .catch((err) => {
        console.error(`${this.label}: failed to write to IndexedDB`, err);
        this.failure ??= err;
      });
  }

  /** Waits for queued writes without consuming a failure meant for {@link flush}. */
  drain(): Promise<void> {
    return this.tail;
  }

  /** Resolves once queued writes are done; rejects with the first failure since the last flush. */
  flush(): Promise<void> {
    return this.tail.then(() => {
      if (this.failure !== null) {
        const err = this.failure;
        this.failure = null;
        throw err;
      }
    });
  }
}

/**
 * Keeps one kind of record in memory and writes every change through to
 * IndexedDB. Reads are synchronous (served from memory after {@link hydrate});
 * writes are queued in order.
 *
 * Without a backend it is a plain in-memory store, which is what tests and the
 * fallback for browsers without IndexedDB use.
 *
 * Items must be treated as immutable: save a new object instead of mutating one.
 */
export class CollectionStore<T extends { id: string }> {
  private items: T[] = [];
  private readonly writes: WriteQueue;

  constructor(
    private readonly name: StoreName,
    private readonly backend: IStoreBackend | null = null,
    /** Order applied after loading, because IndexedDB returns records sorted by key. */
    private readonly order?: (a: T, b: T) => number,
    notifier?: IChangeNotifier,
  ) {
    this.writes = new WriteQueue(`CollectionStore(${name})`, backend, () => notifier?.notify(name));
    notifier?.subscribe(name, () => void this.refresh());
  }

  /** Loads everything stored in the database into memory. */
  async hydrate(): Promise<void> {
    if (!this.backend) return;
    const all = await this.backend.loadAll<T>(this.name);
    this.items = this.order ? all.sort(this.order) : all;
  }

  /**
   * Reloads after another tab wrote. Our own pending writes go first. A save
   * made in the instant between the read and the swap stays in the database but
   * is missing here until the next reload; that window is a few milliseconds.
   */
  private async refresh(): Promise<void> {
    try {
      await this.writes.drain();
      await this.hydrate();
    } catch (err) {
      console.error(`CollectionStore(${this.name}): failed to refresh from IndexedDB`, err);
    }
  }

  findAll(): T[] {
    return [...this.items];
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  save(item: T): void {
    const index = this.items.findIndex((existing) => existing.id === item.id);
    if (index >= 0) this.items[index] = item;
    else this.items.push(item);
    this.writes.enqueue((backend) => backend.put(this.name, item));
  }

  delete(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
    this.writes.enqueue((backend) => backend.delete(this.name, id));
  }

  /** Replaces the whole collection in one transaction, so a failed write keeps the old records. */
  replaceAll(items: T[]): void {
    this.items = [...items];
    const snapshot = [...items];
    this.writes.enqueue((backend) =>
      backend.replaceStores([{ store: this.name, values: snapshot }]),
    );
  }

  /** Replaces the in-memory copy only; the caller has already stored the items. */
  setItems(items: T[]): void {
    this.items = [...items];
  }

  clear(): void {
    this.replaceAll([]);
  }

  /** Resolves once every queued write has reached the database; rejects if one failed. */
  flush(): Promise<void> {
    return this.writes.flush();
  }
}

/** Same idea as {@link CollectionStore}, for a single record such as the settings. */
export class ValueStore<T> {
  private value: T | null = null;
  private readonly writes: WriteQueue;

  constructor(
    private readonly name: StoreName,
    private readonly backend: IStoreBackend | null = null,
    notifier?: IChangeNotifier,
  ) {
    this.writes = new WriteQueue(`ValueStore(${name})`, backend, () => notifier?.notify(name));
    notifier?.subscribe(name, () => void this.refresh());
  }

  async hydrate(): Promise<void> {
    if (!this.backend) return;
    const [stored] = await this.backend.loadAll<T>(this.name);
    this.value = stored ?? null;
  }

  private async refresh(): Promise<void> {
    try {
      await this.writes.drain();
      await this.hydrate();
    } catch (err) {
      console.error(`ValueStore(${this.name}): failed to refresh from IndexedDB`, err);
    }
  }

  get(): T | null {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.writes.enqueue((backend) => backend.put(this.name, value, SETTINGS_KEY));
  }

  /** Replaces the in-memory copy only; the caller has already stored the value. */
  setValue(value: T | null): void {
    this.value = value;
  }

  clear(): void {
    this.value = null;
    this.writes.enqueue((backend) => backend.clear(this.name));
  }

  flush(): Promise<void> {
    return this.writes.flush();
  }
}
