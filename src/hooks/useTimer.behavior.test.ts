/**
 * Behavioral tests for the useTimer hook.
 *
 * Covers: initial state, start / pause / reset / skip / changeMode,
 * mode transitions, sound, onComplete callback, settings updates while
 * paused, and cleanup on unmount.
 *
 * Ticks are driven manually by capturing the callback passed to
 * timerService.start, keeping every test synchronous and deterministic
 * without relying on fake timers.
 */
import { renderHook, act } from '@testing-library/react';
import { useTimer } from './useTimer';
import { timerService } from '../services/TimerService';
import { playBeep } from '../utils/sound';
import { DEFAULT_SETTINGS } from '../types';
import type { Settings } from '../types';

vi.mock('../services/TimerService', () => ({
  timerService: {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../utils/sound', () => ({ playBeep: vi.fn() }));

// 1-minute durations → 60 ticks per session, fast to drive manually.
const SHORT_SETTINGS: Settings = {
  spikeMinimum: 1,
  shortBreakDuration: 1,
  longBreakDuration: 1,
  longBreakInterval: 4,
  breakEndChime: true,
  bridgePairingCode: null,
};

/**
 * Drive a captured tick callback `count` times inside a single act block.
 * The hook's tick implementation updates secondsLeftRef synchronously on every
 * call, so looping inside one act correctly counts down to zero before React
 * flushes the batched state updates.
 */
function driveToCompletion(capturedTick: () => void, count: number): void {
  act(() => {
    for (let i = 0; i < count; i++) {
      capturedTick();
    }
  });
}

/**
 * Call result.current.start() and return the callback that was passed to
 * timerService.start so callers can drive ticks manually.
 */
function startAndCaptureTick(
  result: { current: ReturnType<typeof useTimer> },
): () => void {
  act(() => {
    result.current.start();
  });
  return vi.mocked(timerService.start).mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(timerService.isRunning).mockReturnValue(false);
});

describe('useTimer — behavioral tests', () => {
  // ── 1. Initial state ───────────────────────────────────────────────────────

  it('initial state: mode=work, secondsLeft=spikeMinimum*60, isRunning=false, pomodoroCount=0', () => {
    const { result } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS }));

    expect(result.current.mode).toBe('spike');
    expect(result.current.secondsLeft).toBe(DEFAULT_SETTINGS.spikeMinimum * 60);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.pomodoroCount).toBe(0);
  });

  // ── 2. start() ─────────────────────────────────────────────────────────────

  it('start() sets isRunning to true and calls timerService.start with a callback', () => {
    const { result } = renderHook(() => useTimer({ settings: SHORT_SETTINGS }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
    expect(timerService.start).toHaveBeenCalledTimes(1);
    expect(typeof vi.mocked(timerService.start).mock.calls[0][0]).toBe('function');
  });

  // ── 3. pause() ─────────────────────────────────────────────────────────────

  it('pause() sets isRunning to false and calls timerService.stop', () => {
    const { result } = renderHook(() => useTimer({ settings: SHORT_SETTINGS }));

    act(() => { result.current.start(); });
    act(() => { result.current.pause(); });

    expect(result.current.isRunning).toBe(false);
    expect(timerService.stop).toHaveBeenCalled();
  });

  // ── 4. reset() ─────────────────────────────────────────────────────────────

  it('reset() restores secondsLeft to the current mode full duration and sets isRunning false', () => {
    const { result } = renderHook(() => useTimer({ settings: SHORT_SETTINGS }));

    // Advance a few ticks so secondsLeft is no longer the full duration.
    const tick = startAndCaptureTick(result);
    act(() => { tick(); tick(); tick(); }); // 3 ticks → 57 seconds remaining

    expect(result.current.secondsLeft).toBe(SHORT_SETTINGS.spikeMinimum * 60 - 3);

    act(() => { result.current.reset(); });

    expect(result.current.secondsLeft).toBe(SHORT_SETTINGS.spikeMinimum * 60);
    expect(result.current.isRunning).toBe(false);
  });

  // ── 5. skip() work → short-break ───────────────────────────────────────────

  it('skip() from work advances to short-break, increments pomodoroCount, and sets correct secondsLeft', () => {
    const { result } = renderHook(() => useTimer({ settings: SHORT_SETTINGS }));

    expect(result.current.mode).toBe('spike');
    expect(result.current.pomodoroCount).toBe(0);

    act(() => { result.current.skip(); });

    expect(result.current.mode).toBe('short-break');
    expect(result.current.pomodoroCount).toBe(1);
    expect(result.current.secondsLeft).toBe(SHORT_SETTINGS.shortBreakDuration * 60);
    expect(result.current.isRunning).toBe(false);
  });

  // ── 6. skip() → long-break after longBreakInterval work sessions ───────────

  it('skip() advances to long-break once longBreakInterval work sessions have been completed', () => {
    // Use longBreakInterval: 2 so only one full work+break cycle is needed.
    // nextMode logic: newCount % longBreakInterval === 0 → 'long-break'
    // Cycle 1: skip work (count 0→1, 1%2≠0) → short-break
    // Cycle 2: skip short-break → work (no count change)
    // Cycle 3: skip work (count 1→2, 2%2=0) → long-break
    const settings: Settings = { ...SHORT_SETTINGS, longBreakInterval: 2 };
    const { result } = renderHook(() => useTimer({ settings }));

    // Cycle 1 — first work session skipped.
    act(() => { result.current.skip(); });
    expect(result.current.mode).toBe('short-break');
    expect(result.current.pomodoroCount).toBe(1);

    // Short-break skipped → back to work.
    act(() => { result.current.skip(); });
    expect(result.current.mode).toBe('spike');

    // Cycle 2 — second work session skipped; should now produce a long-break.
    act(() => { result.current.skip(); });
    expect(result.current.mode).toBe('long-break');
    expect(result.current.pomodoroCount).toBe(2);
    expect(result.current.secondsLeft).toBe(settings.longBreakDuration * 60);
  });

  // ── 7. changeMode() ────────────────────────────────────────────────────────

  it('changeMode("short-break") sets mode, resets secondsLeft to shortBreakDuration, and stops the timer', () => {
    const { result } = renderHook(() => useTimer({ settings: DEFAULT_SETTINGS }));

    act(() => { result.current.changeMode('short-break'); });

    expect(result.current.mode).toBe('short-break');
    expect(result.current.secondsLeft).toBe(DEFAULT_SETTINGS.shortBreakDuration * 60);
    expect(result.current.isRunning).toBe(false);
  });

  // ── 8. onComplete callback ─────────────────────────────────────────────────

  it('onComplete callback is fired with the completed mode when the timer reaches zero', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTimer({ settings: SHORT_SETTINGS, onComplete }),
    );

    const tick = startAndCaptureTick(result);
    const initialSeconds = result.current.secondsLeft;

    driveToCompletion(tick, initialSeconds);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('spike');
  });

  // ── 9. playBeep when breakEndChime ─────────────────────────────────────────

  it('playBeep is called when breakEndChime is true and a break completes', () => {
    const settings: Settings = { ...SHORT_SETTINGS, breakEndChime: true };
    const { result } = renderHook(() => useTimer({ settings }));

    act(() => {
      result.current.changeMode('short-break');
    });
    const tick = startAndCaptureTick(result);
    driveToCompletion(tick, result.current.secondsLeft);

    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it('playBeep is NOT called when a Spike completes, even with breakEndChime on', () => {
    const settings: Settings = { ...SHORT_SETTINGS, breakEndChime: true };
    const { result } = renderHook(() => useTimer({ settings }));

    const tick = startAndCaptureTick(result);
    driveToCompletion(tick, result.current.secondsLeft);

    expect(playBeep).not.toHaveBeenCalled();
  });

  // ── 10. no playBeep when breakEndChime is false ────────────────────────────

  it('playBeep is NOT called when breakEndChime is false and a break completes', () => {
    const settings: Settings = { ...SHORT_SETTINGS, breakEndChime: false };
    const { result } = renderHook(() => useTimer({ settings }));

    act(() => {
      result.current.changeMode('short-break');
    });
    const tick = startAndCaptureTick(result);
    driveToCompletion(tick, result.current.secondsLeft);

    expect(playBeep).not.toHaveBeenCalled();
  });

  // ── 11. settings change while not running ─────────────────────────────────

  it('changing spikeMinimum while not running updates secondsLeft to the new duration', () => {
    const { result, rerender } = renderHook(
      ({ settings }: { settings: Settings }) => useTimer({ settings }),
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    expect(result.current.secondsLeft).toBe(DEFAULT_SETTINGS.spikeMinimum * 60);

    const updatedSettings: Settings = { ...DEFAULT_SETTINGS, spikeMinimum: 30 };
    act(() => {
      rerender({ settings: updatedSettings });
    });

    // The settings-change effect fires because spikeMinimum dependency changed
    // and isRunning is false, so secondsLeft is updated to the new duration.
    expect(result.current.secondsLeft).toBe(30 * 60);
  });

  // ── 12. cleanup on unmount ────────────────────────────────────────────────

  it('timerService.stop is called when the hook unmounts', () => {
    const { result, unmount } = renderHook(() =>
      useTimer({ settings: SHORT_SETTINGS }),
    );

    act(() => { result.current.start(); });

    // Reset call counts so only the unmount-triggered stop is counted.
    vi.clearAllMocks();

    unmount();

    expect(timerService.stop).toHaveBeenCalledTimes(1);
  });
});
