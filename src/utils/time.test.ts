import { formatOvertime, formatTime, isSameDay } from './time';

describe('formatTime', () => {
  it('formats zero as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });
  it('formats 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30');
  });
  it('formats 25 minutes correctly', () => {
    expect(formatTime(1500)).toBe('25:00');
  });
  it('clamps negative values to 00:00', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});

describe('isSameDay', () => {
  it('returns true for same day', () => {
    expect(isSameDay('2024-01-15T12:00:00', '2024-01-15T14:00:00')).toBe(true);
  });
  it('returns false for different days', () => {
    expect(isSameDay('2024-01-15T10:00:00', '2024-01-16T10:00:00')).toBe(false);
  });
});

describe('formatOvertime', () => {
  it('prefixes a plus and drops the leading zero on minutes', () => {
    expect(formatOvertime(0)).toBe('+0:00');
    expect(formatOvertime(192)).toBe('+3:12');
    expect(formatOvertime(3725)).toBe('+62:05');
  });
  it('clamps negative values', () => {
    expect(formatOvertime(-4)).toBe('+0:00');
  });
});
