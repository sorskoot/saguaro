import type { IStoreBackend, StoreName } from './idb';
import { SETTINGS_KEY } from './idb';

/**
 * Serialises writes so they reach the database in the order they were made,
 * and reports (rather than throws) failures: the in-memory copy stays usable.
 */
class WriteQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly label: string,
    private readonly backend: IStoreBackend | null,
  ) {}

  enqueue(write: (backend: IStoreBackend) => Promise<void>): void {
    const backend = this.backend;
    if (!backend) return;
    this.tail = this.tail
      .then(() => write(backend))
      .catch((err) => {
        console.error(`${this.label}: failed to write to IndexedDB`, err);
      });
  }

  flush(): Promise<void> {
    return this.tail;
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
  ) {
    this.writes = new WriteQueue(`CollectionStore(${name})`, backend);
  }

  /** Loads everything stored in the database into memory. */
  async hydrate(): Promise<void> {
    if (!this.backend) return;
    const all = await this.backend.loadAll<T>(this.name);
    this.items = this.order ? all.sort(this.order) : all;
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

  /** Replaces the whole collection, e.g. when restoring a backup. */
  replaceAll(items: T[]): void {
    this.items = [...items];
    const snapshot = [...items];
    this.writes.enqueue(async (backend) => {
      await backend.clear(this.name);
      if (snapshot.length > 0) await backend.putMany(this.name, snapshot);
    });
  }

  clear(): void {
    this.replaceAll([]);
  }

  /** Resolves once every queued write has reached the database. */
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
  ) {
    this.writes = new WriteQueue(`ValueStore(${name})`, backend);
  }

  async hydrate(): Promise<void> {
    if (!this.backend) return;
    const [stored] = await this.backend.loadAll<T>(this.name);
    this.value = stored ?? null;
  }

  get(): T | null {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.writes.enqueue((backend) => backend.put(this.name, value, SETTINGS_KEY));
  }

  clear(): void {
    this.value = null;
    this.writes.enqueue((backend) => backend.clear(this.name));
  }

  flush(): Promise<void> {
    return this.writes.flush();
  }
}
