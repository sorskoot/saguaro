import type { CollectionStore } from './db/CollectionStore';
import type { AppEvent, AppEventType, NewAppEvent } from '../types';
import { generateEventId } from '../utils/id';

/**
 * The raw, append-only event log. Events can be added and read but never
 * changed or removed, so any metric can be derived from them later.
 */
export class EventLogRepository {
  constructor(private readonly store: CollectionStore<AppEvent>) {}

  /** Records an event, stamping it with an id and the current time. */
  append(event: NewAppEvent, at: Date = new Date()): AppEvent {
    const full = {
      ...event,
      id: generateEventId(at.getTime()),
      timestamp: at.toISOString(),
    } as AppEvent;
    this.store.save(full);
    return full;
  }

  /** Every event, oldest first. */
  findAll(): AppEvent[] {
    return this.store.findAll();
  }

  findByType<T extends AppEventType>(type: T): Extract<AppEvent, { type: T }>[] {
    return this.store.findAll().filter((e): e is Extract<AppEvent, { type: T }> => e.type === type);
  }

  /** Events at or after the given ISO timestamp. */
  findSince(timestamp: string): AppEvent[] {
    return this.store.findAll().filter((e) => e.timestamp >= timestamp);
  }
}
