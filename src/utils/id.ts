export function generateId(): string {
  return crypto.randomUUID();
}

let eventSequence = 0;

/**
 * Id for an event-log entry. Ids sort in the order events were created:
 * a fixed-width base-36 timestamp, then a per-session counter for events in the
 * same millisecond, then random characters so ids from different tabs don't collide.
 */
export function generateEventId(now: number = Date.now()): string {
  eventSequence = (eventSequence + 1) % 36 ** 4;
  const time = now.toString(36).padStart(9, '0');
  const sequence = eventSequence.toString(36).padStart(4, '0');
  const random = crypto.randomUUID().slice(0, 8);
  return `${time}-${sequence}-${random}`;
}
