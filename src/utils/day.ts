/**
 * A new day starts at 04:00 local time, not midnight, so a late evening session
 * stays part of the same day. Fixed for v1.
 */
export const DAY_START_HOUR = 4;

/** The "Saguaro day" a moment belongs to, as a local `YYYY-MM-DD` key. */
export function dayKey(date: Date = new Date()): string {
  // Compare the local hour rather than subtracting hours, which breaks on DST days.
  const shifted = new Date(date.getTime());
  if (shifted.getHours() < DAY_START_HOUR) shifted.setDate(shifted.getDate() - 1);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
