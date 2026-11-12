/**
 * Tests for the Spike / break phase machine.
 *
 * Time comes from timestamps, so tests move the system clock and then fire the
 * tick callback captured from timerService.start, keeping everything
 * synchronous and deterministic.
 */
import { renderHook, act } from '@testing-library/react';
import { useTimer } from './useTimer';
import type { UseTimerOptions } from './useTimer';
import { timerService } from '../services/TimerService';
import { playChime } from '../utils/sound';
import type { Settings } from '../types';

vi.mock('../services/TimerService', () => ({
    timerService: {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('../utils/sound', () => ({ playChime: vi.fn() }));

const SETTINGS: Settings = {
    spikeMinimum: 1, // 60 s
    shortBreakDuration: 1, // 60 s
    longBreakDuration: 2, // 120 s
    longBreakInterval: 2,
    breakEndChime: true,
    bridgePairingCode: null,
};

const T0 = new Date('2026-11-12T10:00:00Z').getTime();

/** The moment the current session started: the clock restarts with every Spike and break. */
let sessionStart = T0;

/** Moves the clock `seconds` past the start of the current session and fires a tick. */
function tickAt(seconds: number) {
    vi.setSystemTime(sessionStart + seconds * 1000);
    const tick = vi.mocked(timerService.start).mock.lastCall![0];
    act(() => tick());
}

/** Starts the next session `after` seconds past the current one. */
function beginSession(action: () => void, after = 0) {
    vi.setSystemTime(sessionStart + after * 1000);
    act(action);
    sessionStart = Date.now();
}

function setup(overrides: Partial<UseTimerOptions> = {}, settings = SETTINGS) {
    return renderHook(() => useTimer({ settings, ...overrides }));
}

type Hook = { current: ReturnType<typeof useTimer> };

/** Runs a Spike for exactly its minimum, then takes the break. */
function spikeThenBreak(result: Hook) {
    beginSession(() => result.current.start());
    tickAt(60);
    beginSession(() => result.current.endSpike(), 60);
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    sessionStart = T0;
    vi.setSystemTime(T0);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Spike', () => {
    it('starts idle with the full minimum on the clock', () => {
        const { result } = setup();
        expect(result.current).toMatchObject({
            phase: 'idle',
            mode: 'spike',
            secondsLeft: 60,
            overtimeSeconds: 0,
            isRunning: false,
            spikeCount: 0,
        });
    });

    it('counts down and fires onSpikeStart', () => {
        const onSpikeStart = vi.fn();
        const { result } = setup({ onSpikeStart });
        beginSession(() => result.current.start());
        expect(onSpikeStart).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe('spike');
        expect(result.current.isRunning).toBe(true);

        tickAt(15);
        expect(result.current.secondsLeft).toBe(45);
        expect(result.current.overtimeSeconds).toBe(0);
    });

    it('reaches the minimum silently and keeps counting up', () => {
        const onSpikeEnd = vi.fn();
        const { result } = setup({ onSpikeEnd });
        beginSession(() => result.current.start());

        tickAt(60);
        expect(result.current.phase).toBe('spike');
        expect(result.current.secondsLeft).toBe(0);
        expect(result.current.overtimeSeconds).toBe(0);

        tickAt(60 + 192);
        expect(result.current.phase).toBe('spike');
        expect(result.current.overtimeSeconds).toBe(192);
        expect(onSpikeEnd).not.toHaveBeenCalled();
        expect(playChime).not.toHaveBeenCalled();
    });

    it('ending early is a partial Spike with no overtime and starts a break', () => {
        const onSpikeEnd = vi.fn();
        const onBreakStart = vi.fn();
        const { result } = setup({ onSpikeEnd, onBreakStart });
        beginSession(() => result.current.start());
        tickAt(20);

        beginSession(() => result.current.endSpike(), 20);
        expect(onSpikeEnd).toHaveBeenCalledWith({ endedEarly: true, overtimeSeconds: 0 });
        expect(onBreakStart).toHaveBeenCalledWith('short-break');
        expect(result.current.phase).toBe('break');
        expect(result.current.mode).toBe('short-break');
        expect(result.current.secondsLeft).toBe(60);
        expect(result.current.spikeCount).toBe(1);
    });

    it('ending after the minimum records the overtime', () => {
        const onSpikeEnd = vi.fn();
        const { result } = setup({ onSpikeEnd });
        beginSession(() => result.current.start());
        tickAt(60 + 900);
        beginSession(() => result.current.endSpike(), 60 + 900);
        expect(onSpikeEnd).toHaveBeenCalledWith({ endedEarly: false, overtimeSeconds: 900 });
    });

    it('works out overtime from the clock, not only from the last tick', () => {
        const onSpikeEnd = vi.fn();
        const { result } = setup({ onSpikeEnd });
        beginSession(() => result.current.start());
        tickAt(70);
        // Ten more seconds pass with no tick before the button is pressed.
        beginSession(() => result.current.endSpike(), 80);
        expect(onSpikeEnd).toHaveBeenCalledWith({ endedEarly: false, overtimeSeconds: 20 });
    });

    it('cancelling logs it, counts nothing and returns to idle without a break', () => {
        const onSpikeCancel = vi.fn();
        const onSpikeEnd = vi.fn();
        const onBreakStart = vi.fn();
        const { result } = setup({ onSpikeCancel, onSpikeEnd, onBreakStart });
        beginSession(() => result.current.start());
        tickAt(10);
        act(() => result.current.cancel());
        expect(onSpikeCancel).toHaveBeenCalledTimes(1);
        expect(onSpikeEnd).not.toHaveBeenCalled();
        expect(onBreakStart).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({ phase: 'idle', spikeCount: 0, secondsLeft: 60 });
        expect(timerService.stop).toHaveBeenCalled();
    });

    it('stays accurate when ticks are missed (throttled background tab)', () => {
        const { result } = setup();
        beginSession(() => result.current.start());
        tickAt(600);
        expect(result.current.overtimeSeconds).toBe(540);
    });
});

describe('breaks', () => {
    it('uses a long break after every longBreakInterval Spikes, ended-early ones included', () => {
        const onBreakStart = vi.fn();
        const { result } = setup({ onBreakStart });

        spikeThenBreak(result);
        act(() => result.current.skipBreak());
        beginSession(() => result.current.start());
        beginSession(() => result.current.endSpike(), 5); // second Spike ends early

        expect(onBreakStart.mock.calls.map((c) => c[0])).toEqual(['short-break', 'long-break']);
        expect(result.current.secondsLeft).toBe(120);
    });

    it('plays one chime when the break is up, moves to Re-entry and keeps counting silently', () => {
        const { result } = setup();
        spikeThenBreak(result);

        tickAt(59);
        expect(result.current.phase).toBe('break');
        expect(playChime).not.toHaveBeenCalled();

        tickAt(60);
        expect(result.current.phase).toBe('reentry');
        expect(playChime).toHaveBeenCalledTimes(1);

        tickAt(60 + 240);
        expect(result.current.overtimeSeconds).toBe(240);
        expect(playChime).toHaveBeenCalledTimes(1);
    });

    it('stays silent when the chime is turned off', () => {
        const { result } = setup({}, { ...SETTINGS, breakEndChime: false });
        spikeThenBreak(result);
        tickAt(60);
        expect(result.current.phase).toBe('reentry');
        expect(playChime).not.toHaveBeenCalled();
    });

    it('records the overrun when the next Spike starts from Re-entry', () => {
        const onBreakEnd = vi.fn();
        const onSpikeStart = vi.fn();
        const { result } = setup({ onBreakEnd, onSpikeStart });
        spikeThenBreak(result);
        tickAt(60 + 45);

        beginSession(() => result.current.start(), 60 + 45);
        expect(onBreakEnd).toHaveBeenCalledWith({ overrunSeconds: 45 });
        expect(onSpikeStart).toHaveBeenCalledTimes(2);
        expect(result.current.phase).toBe('spike');
    });

    it('skipping a break goes to Re-entry with no overrun and closes the break once', () => {
        const onBreakEnd = vi.fn();
        const { result } = setup({ onBreakEnd });
        spikeThenBreak(result);
        tickAt(10);

        act(() => result.current.skipBreak());
        expect(result.current.phase).toBe('reentry');
        expect(result.current.isRunning).toBe(false);
        expect(onBreakEnd).toHaveBeenCalledWith({ overrunSeconds: 0 });

        beginSession(() => result.current.start(), 10);
        expect(onBreakEnd).toHaveBeenCalledTimes(1);
        expect(playChime).not.toHaveBeenCalled();
    });

    it('dismissing Re-entry returns to idle and closes the break', () => {
        const onBreakEnd = vi.fn();
        const { result } = setup({ onBreakEnd });
        spikeThenBreak(result);
        tickAt(70);
        act(() => result.current.dismissReentry());
        expect(onBreakEnd).toHaveBeenCalledWith({ overrunSeconds: 10 });
        expect(result.current.phase).toBe('idle');
    });
});

describe('guards', () => {
    it('ignores actions in the wrong phase', () => {
        const onSpikeStart = vi.fn();
        const { result } = setup({ onSpikeStart });
        act(() => {
            result.current.endSpike();
            result.current.cancel();
            result.current.skipBreak();
            result.current.dismissReentry();
        });
        expect(result.current.phase).toBe('idle');

        act(() => result.current.start());
        act(() => result.current.start());
        expect(onSpikeStart).toHaveBeenCalledTimes(1);
    });

    it('stops the clock on unmount', () => {
        const { unmount } = setup();
        unmount();
        expect(timerService.stop).toHaveBeenCalled();
    });

    it('picks up a changed Spike minimum while idle', () => {
        const { result, rerender } = renderHook(
            ({ settings }) => useTimer({ settings }),
            { initialProps: { settings: SETTINGS } },
        );
        rerender({ settings: { ...SETTINGS, spikeMinimum: 30 } });
        expect(result.current.secondsLeft).toBe(1800);
    });
});
