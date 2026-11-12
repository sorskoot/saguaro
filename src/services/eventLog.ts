import { getDataStore } from './db/DataStore';
import { EventLogRepository } from './EventLogRepository';
import type { AppEvent, NewAppEvent } from '../types';

/**
 * Appends an event to the app-wide event log. Hooks call this at the moment
 * something happens, so the log can later be replayed to derive metrics.
 */
export function logEvent(event: NewAppEvent): AppEvent {
  return new EventLogRepository(getDataStore().events).append(event);
}
