/**
 * A new day starts at 04:00 local time, not midnight, so a late evening session
 * stays part of the same day. Fixed for v1.
 */
export const DAY_START_HOUR = 4;

/** The "Saguaro day" a moment belongs to, as a local `YYYY-MM-DD` key. */
export function dayKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() - DAY_START_HOUR * 60 * 60 * 1000);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
