import { ParkingLotRepository } from './ParkingLotRepository';
import { getDataStore } from './db/DataStore';
import { logEvent } from './eventLog';
import { generateId } from '../utils/id';
import type { ParkingLotItem } from '../types';

/** Dispatched on `window` after a thought is saved, so open lists can refresh. */
export const CAPTURE_EVENT = 'saguaro:capture';

/** The Spike that is running right now, so a captured thought can be linked to it. */
let activeSpikeSessionId: string | null = null;

export function setActiveSpikeSessionId(id: string | null): void {
  activeSpikeSessionId = id;
}

export function getActiveSpikeSessionId(): string | null {
  return activeSpikeSessionId;
}

/**
 * Saves a thought to the parking lot and logs a `capture` event linked to the
 * running Spike (if any). Blank text is ignored. No confirmation by design:
 * capturing must take under three seconds and leave the screen unchanged.
 * @returns the new item, or null when the text was blank.
 */
export function captureThought(text: string): ParkingLotItem | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const item: ParkingLotItem = {
    id: generateId(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    sessionId: activeSpikeSessionId,
  };
  new ParkingLotRepository(getDataStore().parkingLot).save(item);
  logEvent({ type: 'capture', itemId: item.id, sessionId: item.sessionId });
  window.dispatchEvent(new Event(CAPTURE_EVENT));
  return item;
}
