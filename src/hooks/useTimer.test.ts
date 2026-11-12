/**
 * Regression tests for the useTimer auto-start closure fix.
 *
 * The fix: advanceMode passes `() => tickRef.current()` to timerService.start
 * rather than capturing `tick` at call time. This guarantees the callback is
 * always a defined function — never undefined — when auto-start fires after a
 * session completes.
 *
 * Ticks are driven manually by capturing the callback from timerService.start,
 * keeping tests fully synchronous and deterministic without fake timers.
 */
import { renderHook, act } from '@testing-library/react';
import { useTimer } from './useTimer';
import { timerService } from '../services/TimerService';
import type { Settings } from '../types';
import type { TimerWorkerEvent } from '../types/timerWorker';

vi.mock('../services/TimerService', () => ({
    timerService: {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('../utils/sound', () => ({ playBeep: vi.fn() }));

class MockWorker {
    static lastInstance: MockWorker | null = null;
    onmessage: ((event: MessageEvent<TimerWorkerEvent>) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
        MockWorker.lastInstance = this;
    }
}

class MockNotification {
    static permission: NotificationPermission = 'granted';
    static requestPermission = vi.fn<() => Promise<NotificationPermission>>(
        async () => 'granted',
    );

    constructor(_title: string, _options?: NotificationOptions) {}
}

// 1-minute sessions → exactly 60 ticks to reach zero; fast to drive manually.
const FAST_SETTINGS: Settings = {
    spikeMinimum: 1,
    shortBreakDuration: 1,
    longBreakDuration: 1,
    longBreakInterval: 4,
    breakEndChime: false,
    bridgePairingCode: null,
};

/**
 * Drive a captured tick callback `count` times inside a single act so that
 * React flushes all batched state updates once the loop finishes.
 * The tick implementation reads/writes secondsLeftRef synchronously, so the
 * loop correctly traverses all seconds down to zero even inside one act call.
 */
function driveTicksToCompletion(capturedTick: () => void, count: number): void {
    act(() => {
        for (let i = 0; i < count; i++) {
            capturedTick();
        }
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timerService.isRunning).mockReturnValue(false);
    MockWorker.lastInstance = null;
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal(
        'Notification',
        MockNotification as unknown as typeof Notification,
    );
});

describe('useTimer — auto-start closure regression', () => {
    it('timerService.start receives a defined function callback on the initial start() call', () => {
        vi.stubGlobal('Worker', undefined as unknown as typeof Worker);

        const { result } = renderHook(() =>
            useTimer({ settings: FAST_SETTINGS }),
        );

        act(() => {
            result.current.start();
        });

        expect(timerService.start).toHaveBeenCalledTimes(1);

        const cb = vi.mocked(timerService.start).mock.calls[0][0];
        expect(typeof cb).toBe('function');
        expect(cb).not.toBeNull();
        expect(cb).not.toBeUndefined();
    });

    it('does not auto-start the break after a Spike completes', () => {
        vi.stubGlobal('Worker', undefined as unknown as typeof Worker);

        const { result } = renderHook(() => useTimer({ settings: FAST_SETTINGS }));

        act(() => {
            result.current.start();
        });

        const tick = vi.mocked(timerService.start).mock.calls[0][0];
        driveTicksToCompletion(tick, result.current.secondsLeft);

        // The break is waiting, not running: the next session starts by choice.
        expect(timerService.start).toHaveBeenCalledTimes(1);
        expect(result.current.mode).toBe('short-break');
        expect(result.current.isRunning).toBe(false);
    });

    it('does not auto-start the next Spike after a break completes', () => {
        vi.stubGlobal('Worker', undefined as unknown as typeof Worker);

        const { result } = renderHook(() => useTimer({ settings: FAST_SETTINGS }));

        act(() => {
            result.current.skip();
        });
        expect(result.current.mode).toBe('short-break');

        act(() => {
            result.current.start();
        });

        const tick = vi.mocked(timerService.start).mock.calls[0][0];
        driveTicksToCompletion(tick, result.current.secondsLeft);

        expect(timerService.start).toHaveBeenCalledTimes(1);
        expect(result.current.mode).toBe('spike');
        expect(result.current.isRunning).toBe(false);
    });

    it('handles worker complete event and advances mode', () => {
        const onComplete = vi.fn();
        const { result } = renderHook(() =>
            useTimer({ settings: FAST_SETTINGS, onComplete }),
        );

        act(() => {
            result.current.start();
        });

        const worker = MockWorker.lastInstance;
        expect(worker).not.toBeNull();

        act(() => {
            worker?.onmessage?.({
                data: { type: 'complete' },
            } as MessageEvent<TimerWorkerEvent>);
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith('spike');
        expect(result.current.mode).toBe('short-break');
        expect(result.current.isRunning).toBe(false);
    });
});
