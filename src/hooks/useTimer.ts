import { useState, useRef, useCallback, useEffect } from 'react';
import { timerService } from '../services/TimerService';
import { playChime } from '../utils/sound';
import type { Settings } from '../types';
import type {
    TimerWorkerCommand,
    TimerWorkerEvent,
} from '../types/timerWorker';

/**
 * Where the focus loop is:
 * - idle: nothing running, the next Spike is ready to start
 * - spike: a Spike is running; past its minimum it keeps counting up (overtime)
 * - break: a fixed-length break is counting down
 * - reentry: the break is up (the chime has played) or was skipped; if it ran
 *   out, the clock keeps counting the overrun silently until the next Spike
 *   starts or Re-entry is dismissed
 */
export type TimerPhase = 'idle' | 'spike' | 'break' | 'reentry';

export type BreakType = 'short-break' | 'long-break';

export interface SpikeEndInfo {
    /** True when the Spike ended before its minimum (a partial Spike). */
    endedEarly: boolean;
    /** Seconds the Spike ran past its minimum; 0 for a partial Spike. */
    overtimeSeconds: number;
}

export interface UseTimerOptions {
    settings: Settings;
    onSpikeStart?: () => void;
    onSpikeEnd?: (info: SpikeEndInfo) => void;
    /** The Spike was cancelled: it is logged but never counted. */
    onSpikeCancel?: () => void;
    onBreakStart?: (breakType: BreakType) => void;
    onBreakEnd?: (info: { overrunSeconds: number }) => void;
}

export interface UseTimerResult {
    phase: TimerPhase;
    /** What the clock is for: a Spike, or the kind of break that is running. */
    mode: 'spike' | BreakType;
    /** Seconds left until the Spike minimum / the end of the break; never below 0. */
    secondsLeft: number;
    /** The full length the countdown started from, in seconds. */
    totalSeconds: number;
    /** Seconds past the Spike minimum, or past the end of the break. */
    overtimeSeconds: number;
    isRunning: boolean;
    /** Spikes finished so far, including ones ended early. Drives the long-break cycle. */
    spikeCount: number;
    /** Starts a Spike (from idle, or from Re-entry). */
    start: () => void;
    /** Ends the running Spike and starts the break. */
    endSpike: () => void;
    /** Cancels the running Spike: logged as cancelled, not counted, no break. */
    cancel: () => void;
    /** Ends a running break early and goes to Re-entry. */
    skipBreak: () => void;
    /** Leaves Re-entry without starting a Spike. */
    dismissReentry: () => void;
}

function breakSeconds(type: BreakType, settings: Settings): number {
    return (
        (type === 'short-break'
            ? settings.shortBreakDuration
            : settings.longBreakDuration) * 60
    );
}

export function useTimer({
    settings,
    onSpikeStart,
    onSpikeEnd,
    onSpikeCancel,
    onBreakStart,
    onBreakEnd,
}: UseTimerOptions): UseTimerResult {
    const [phase, setPhaseState] = useState<TimerPhase>('idle');
    const [breakType, setBreakType] = useState<BreakType>('short-break');
    const [elapsed, setElapsed] = useState(0);
    const [spikeCount, setSpikeCount] = useState(0);

    // Refs let the tick closure and the worker handler always see current values.
    const phaseRef = useRef(phase);
    const breakTypeRef = useRef(breakType);
    const breakOpenRef = useRef(false);
    const elapsedRef = useRef(0);
    const spikeCountRef = useRef(0);
    const startedAtRef = useRef(0);
    const settingsRef = useRef(settings);
    const callbacksRef = useRef({
        onSpikeStart,
        onSpikeEnd,
        onSpikeCancel,
        onBreakStart,
        onBreakEnd,
    });
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        settingsRef.current = settings;
        callbacksRef.current = {
            onSpikeStart,
            onSpikeEnd,
            onSpikeCancel,
            onBreakStart,
            onBreakEnd,
        };
    });

    const setPhase = useCallback((next: TimerPhase) => {
        phaseRef.current = next;
        setPhaseState(next);
    }, []);

    const setElapsedSeconds = useCallback((seconds: number) => {
        elapsedRef.current = seconds;
        setElapsed(seconds);
    }, []);

    /** Every clock source ends up here with the seconds since the session began. */
    const handleElapsed = useCallback(
        (seconds: number) => {
            const current = phaseRef.current;
            // In Re-entry the clock only runs while a break's overrun is being counted.
            if (current === 'idle') return;
            if (current === 'reentry' && !breakOpenRef.current) return;
            setElapsedSeconds(seconds);

            // The break is up: one soft chime, then Re-entry. The clock keeps counting.
            if (
                current === 'break' &&
                seconds >=
                    breakSeconds(breakTypeRef.current, settingsRef.current)
            ) {
                setPhase('reentry');
                if (settingsRef.current.breakEndChime) playChime();
            }
        },
        [setElapsedSeconds, setPhase],
    );

    const handleElapsedRef = useRef(handleElapsed);
    useEffect(() => {
        handleElapsedRef.current = handleElapsed;
    }, [handleElapsed]);

    const syncFromClock = useCallback(() => {
        handleElapsedRef.current(
            Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        );
    }, []);

    useEffect(() => {
        if (typeof Worker === 'undefined') return;

        const worker = new Worker(
            new URL('../workers/timerWorker.ts', import.meta.url),
            { type: 'module' },
        );
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<TimerWorkerEvent>) => {
            if (event.data.type === 'tick') {
                handleElapsedRef.current(event.data.elapsedSeconds);
            }
        };

        return () => {
            worker.postMessage({ type: 'stop' } satisfies TimerWorkerCommand);
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    // Catch up the moment the tab becomes visible again.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') syncFromClock();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () =>
            document.removeEventListener('visibilitychange', onVisible);
    }, [syncFromClock]);

    const stopClock = useCallback(() => {
        workerRef.current?.postMessage({
            type: 'stop',
        } satisfies TimerWorkerCommand);
        timerService.stop();
    }, []);

    /** Begin counting from zero for a new Spike or break. */
    const startClock = useCallback(() => {
        stopClock();
        startedAtRef.current = Date.now();
        setElapsedSeconds(0);
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'start',
                startedAt: startedAtRef.current,
            } satisfies TimerWorkerCommand);
        } else {
            timerService.start(syncFromClock);
        }
    }, [stopClock, setElapsedSeconds, syncFromClock]);

    /** Seconds since the session began, read from the clock rather than the last tick. */
    const liveElapsed = useCallback(
        () =>
            Math.max(
                elapsedRef.current,
                Math.floor((Date.now() - startedAtRef.current) / 1000),
            ),
        [],
    );

    /** Close the break that is running or over, recording any silent overrun. */
    const finishBreak = useCallback(
        (elapsedSeconds = liveElapsed()) => {
            if (!breakOpenRef.current) return;
            breakOpenRef.current = false;
            const overrunSeconds = Math.max(
                0,
                elapsedSeconds -
                    breakSeconds(breakTypeRef.current, settingsRef.current),
            );
            stopClock();
            callbacksRef.current.onBreakEnd?.({ overrunSeconds });
        },
        [liveElapsed, stopClock],
    );

    const beginBreak = useCallback(
        (type: BreakType) => {
            breakTypeRef.current = type;
            breakOpenRef.current = true;
            setBreakType(type);
            setPhase('break');
            startClock();
            callbacksRef.current.onBreakStart?.(type);
        },
        [setPhase, startClock],
    );

    const start = useCallback(() => {
        const current = phaseRef.current;
        if (current !== 'idle' && current !== 'reentry') return;
        finishBreak();
        setPhase('spike');
        startClock();
        callbacksRef.current.onSpikeStart?.();
    }, [finishBreak, setPhase, startClock]);

    const endSpike = useCallback(() => {
        if (phaseRef.current !== 'spike') return;
        const currentSettings = settingsRef.current;
        const minimum = currentSettings.spikeMinimum * 60;
        const elapsedSeconds = liveElapsed();
        const endedEarly = elapsedSeconds < minimum;
        const overtimeSeconds = Math.max(0, elapsedSeconds - minimum);

        // Ended-early Spikes still count toward the long-break cycle.
        const count = spikeCountRef.current + 1;
        spikeCountRef.current = count;
        setSpikeCount(count);

        callbacksRef.current.onSpikeEnd?.({ endedEarly, overtimeSeconds });
        beginBreak(
            count % currentSettings.longBreakInterval === 0
                ? 'long-break'
                : 'short-break',
        );
    }, [beginBreak, liveElapsed]);

    const cancel = useCallback(() => {
        if (phaseRef.current !== 'spike') return;
        stopClock();
        setPhase('idle');
        setElapsedSeconds(0);
        callbacksRef.current.onSpikeCancel?.();
    }, [stopClock, setPhase, setElapsedSeconds]);

    const skipBreak = useCallback(() => {
        if (phaseRef.current !== 'break') return;
        // Skipping is not overrunning: clear the clock before closing the break.
        setElapsedSeconds(0);
        finishBreak(0);
        setPhase('reentry');
    }, [finishBreak, setPhase, setElapsedSeconds]);

    const dismissReentry = useCallback(() => {
        if (phaseRef.current !== 'reentry') return;
        finishBreak();
        setPhase('idle');
        setElapsedSeconds(0);
    }, [finishBreak, setPhase, setElapsedSeconds]);

    useEffect(() => {
        return () => timerService.stop();
    }, []);

    const spikeTotal = settings.spikeMinimum * 60;
    const inBreak = phase === 'break' || phase === 'reentry';
    const totalSeconds = inBreak
        ? breakSeconds(breakType, settings)
        : spikeTotal;
    const secondsLeft =
        phase === 'idle' ? spikeTotal : Math.max(0, totalSeconds - elapsed);
    const overtimeSeconds =
        phase === 'idle' ? 0 : Math.max(0, elapsed - totalSeconds);

    return {
        phase,
        mode: inBreak ? breakType : 'spike',
        secondsLeft,
        totalSeconds,
        overtimeSeconds,
        isRunning: phase === 'spike' || phase === 'break',
        spikeCount,
        start,
        endSpike,
        cancel,
        skipBreak,
        dismissReentry,
    };
}
