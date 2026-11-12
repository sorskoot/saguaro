import { dayKey } from './day';

describe('dayKey', () => {
  it('uses the calendar date during the day', () => {
    expect(dayKey(new Date(2026, 10, 12, 9, 30))).toBe('2026-11-12');
    expect(dayKey(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12');
  });

  it('keeps the small hours with the previous day', () => {
    expect(dayKey(new Date(2026, 10, 13, 0, 5))).toBe('2026-11-12');
    expect(dayKey(new Date(2026, 10, 13, 3, 59))).toBe('2026-11-12');
  });

  it('starts the new day at 04:00', () => {
    expect(dayKey(new Date(2026, 10, 13, 4, 0))).toBe('2026-11-13');
  });

  it('rolls over month and year boundaries', () => {
    expect(dayKey(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31');
    expect(dayKey(new Date(2026, 11, 1, 3, 0))).toBe('2026-11-30');
  });

  it('does not drift on daylight-saving transition days', () => {
    // Local-time construction: holds in any zone, and 04:00 is always a new day.
    expect(dayKey(new Date(2026, 2, 8, 4, 0))).toBe('2026-03-08');
    expect(dayKey(new Date(2026, 10, 1, 3, 30))).toBe('2026-10-31');
    expect(dayKey(new Date(2026, 10, 1, 4, 0))).toBe('2026-11-01');
  });
});
