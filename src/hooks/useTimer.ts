import { useState, useRef, useCallback, useEffect } from 'react';
import { timerService } from '../services/TimerService';
import { playBeep } from '../utils/sound';
import type { Settings, SessionType } from '../types';
import type { TimerCallback } from '../services/interfaces/ITimerService';
import type {
    TimerWorkerCommand,
    TimerWorkerEvent,
} from '../types/timerWorker';

export interface UseTimerOptions {
    settings: Settings;
    onComplete?: (mode: SessionType) => void;
}

export interface UseTimerResult {
    secondsLeft: number;
    isRunning: boolean;
    mode: SessionType;
    pomodoroCount: number;
    start: () => void;
    pause: () => void;
    reset: () => void;
    skip: () => void;
    changeMode: (mode: SessionType) => void;
}

/** Returns the duration in seconds for the given mode and settings. */
function durationFor(mode: SessionType, settings: Settings): number {
    if (mode === 'work') return settings.workDuration * 60;
    if (mode === 'short-break') return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
}

/**
 * Determines the next mode after the current one completes.
 * After every `longBreakInterval` work sessions, a long break is inserted.
 * `pomodoroCount` is the number of *completed* work sessions so far (before
 * incrementing for the one that just finished).
 */
function nextMode(
    current: SessionType,
    pomodoroCount: number,
    settings: Settings,
): SessionType {
    if (current !== 'work') {
        // After any break, always go back to work.
        return 'work';
    }
    // Increment happens before this call in the effect, so we use the
    // already-updated count passed in.
    const newCount = pomodoroCount + 1;
    return newCount % settings.longBreakInterval === 0
        ? 'long-break'
        : 'short-break';
}

function notifyCompletion(mode: SessionType): void {
    if (typeof window === 'undefined' || typeof Notification === 'undefined')
        return;
    if (Notification.permission !== 'granted') return;

    const modeLabel =
        mode === 'work'
            ? 'Work session'
            : mode === 'short-break'
              ? 'Short break'
              : 'Long break';

    new Notification('Pomodoro finished', {
        body: `${modeLabel} completed.`,
        tag: 'pomodoro-complete',
    });
}

export function useTimer({
    settings,
    onComplete,
}: UseTimerOptions): UseTimerResult {
    const [mode, setMode] = useState<SessionType>('work');
    const [secondsLeft, setSecondsLeft] = useState<number>(
        durationFor('work', settings),
    );
    const [isRunning, setIsRunning] = useState(false);
    const [pomodoroCount, setPomodoroCount] = useState(0);

    // Keep stable refs so the tick closure always sees the latest values without
    // needing to restart the interval.
    const modeRef = useRef(mode);
    const secondsLeftRef = useRef(secondsLeft);
    const isRunningRef = useRef(isRunning);
    const pomodoroCountRef = useRef(pomodoroCount);
    const settingsRef = useRef(settings);
    const onCompleteRef = useRef(onComplete);
    // tickRef lets advanceMode always call the live tick without a forward-reference closure bug.
    const tickRef = useRef<TimerCallback>(() => {});
    const workerRef = useRef<Worker | null>(null);
    const endAtRef = useRef<number | null>(null);
    const usingWorkerRef = useRef(false);

    const setRunning = useCallback((running: boolean) => {
        isRunningRef.current = running;
        setIsRunning(running);
    }, []);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);
    useEffect(() => {
        secondsLeftRef.current = secondsLeft;
    }, [secondsLeft]);
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);
    useEffect(() => {
        pomodoroCountRef.current = pomodoroCount;
    }, [pomodoroCount]);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // When settings change, reset the timer to the new duration for the current mode
    // only if it is not currently running.
    useEffect(() => {
        if (!isRunning) {
            setSecondsLeft(durationFor(mode, settings));
        }
        // Intentional: only the three duration fields should trigger this reset.
        // Including `isRunning` would fire on every pause/resume (resetting a mid-session
        // timer); including `mode` would fire on every session transition. Neither is
        // desired. There is no isRunningRef to use as a workaround without adding new
        // logic, so the exhaustive-deps rule must be suppressed here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        settings.workDuration,
        settings.shortBreakDuration,
        settings.longBreakDuration,
    ]);

    /** Advance to the next mode, optionally auto-starting it. */
    const advanceMode = useCallback(
        (autoStart: boolean) => {
            const currentMode = modeRef.current;
            const currentCount = pomodoroCountRef.current;
            const currentSettings = settingsRef.current;

            let newCount = currentCount;
            if (currentMode === 'work') {
                newCount = currentCount + 1;
                setPomodoroCount(newCount);
                pomodoroCountRef.current = newCount;
            }

            const next = nextMode(currentMode, currentCount, currentSettings);
            const nextSeconds = durationFor(next, currentSettings);

            setMode(next);
            modeRef.current = next;
            setSecondsLeft(nextSeconds);
            secondsLeftRef.current = nextSeconds;

            if (autoStart) {
                timerService.stop();

                const nextEndAt = Date.now() + nextSeconds * 1000;
                endAtRef.current = nextEndAt;

                if (usingWorkerRef.current && workerRef.current) {
                    workerRef.current.postMessage({
                        type: 'start',
                        endAt: nextEndAt,
                    } satisfies TimerWorkerCommand);
                    setRunning(true);
                    return;
                }

                // Use tickRef so we always invoke the live tick, not the stale closure captured at creation time.
                timerService.start(() => tickRef.current());
                setRunning(true);
            } else {
                setRunning(false);
                endAtRef.current = null;
            }
        },
        [setRunning],
    );

    useEffect(() => {
        if (typeof Worker === 'undefined') {
            usingWorkerRef.current = false;
            return;
        }

        const worker = new Worker(
            new URL('../workers/timerWorker.ts', import.meta.url),
            { type: 'module' },
        );
        workerRef.current = worker;
        usingWorkerRef.current = true;

        worker.onmessage = (event: MessageEvent<TimerWorkerEvent>) => {
            const message = event.data;

            if (message.type === 'tick') {
                setSecondsLeft(message.secondsLeft);
                secondsLeftRef.current = message.secondsLeft;
                return;
            }

            if (message.type === 'complete') {
                setSecondsLeft(0);
                secondsLeftRef.current = 0;
                setRunning(false);
                endAtRef.current = null;

                const completedMode = modeRef.current;
                const currentSettings = settingsRef.current;

                onCompleteRef.current?.(completedMode);
                if (currentSettings.soundEnabled) {
                    playBeep();
                }
                notifyCompletion(completedMode);

                const shouldAutoStart =
                    completedMode === 'work'
                        ? currentSettings.autoStartBreaks
                        : currentSettings.autoStartPomodoros;

                advanceMode(shouldAutoStart);
            }
        };

        return () => {
            worker.postMessage({ type: 'stop' } satisfies TimerWorkerCommand);
            worker.terminate();
            workerRef.current = null;
            usingWorkerRef.current = false;
        };
    }, [advanceMode, setRunning]);

    /** Called every second by timerService. */
    const tick = useCallback(() => {
        const next = secondsLeftRef.current - 1;
        if (next > 0) {
            setSecondsLeft(next);
            secondsLeftRef.current = next;
            return;
        }

        // Timer hit zero — stop the service, then handle completion.
        timerService.stop();
        setSecondsLeft(0);
        secondsLeftRef.current = 0;
        setRunning(false);
        endAtRef.current = null;

        const completedMode = modeRef.current;
        const currentSettings = settingsRef.current;

        // Fire callback.
        onCompleteRef.current?.(completedMode);

        // Play sound.
        if (currentSettings.soundEnabled) {
            playBeep();
        }
        notifyCompletion(completedMode);

        // Determine whether to auto-advance.
        const shouldAutoStart =
            completedMode === 'work'
                ? currentSettings.autoStartBreaks
                : currentSettings.autoStartPomodoros;

        advanceMode(shouldAutoStart);
    }, [advanceMode, setRunning]);

    // Keep tickRef pointing at the live tick so advanceMode's auto-start path is never stale.
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    const stopActiveTimer = useCallback(() => {
        workerRef.current?.postMessage({
            type: 'pause',
        } satisfies TimerWorkerCommand);
        timerService.stop();
        setRunning(false);
        endAtRef.current = null;
    }, [setRunning]);

    const start = useCallback(() => {
        if (isRunningRef.current) return;

        const endAt = Date.now() + secondsLeftRef.current * 1000;
        endAtRef.current = endAt;

        if (usingWorkerRef.current && workerRef.current) {
            workerRef.current.postMessage({
                type: 'start',
                endAt,
            } satisfies TimerWorkerCommand);
            setRunning(true);
            return;
        }

        if (timerService.isRunning()) return;
        timerService.start(tick);
        setRunning(true);
    }, [setRunning, tick]);

    const pause = useCallback(() => {
        stopActiveTimer();
    }, [stopActiveTimer]);

    const reset = useCallback(() => {
        stopActiveTimer();
        const duration = durationFor(modeRef.current, settingsRef.current);
        setSecondsLeft(duration);
        secondsLeftRef.current = duration;
    }, [stopActiveTimer]);

    const skip = useCallback(() => {
        stopActiveTimer();
        // Advance without triggering callback or sound.
        const currentMode = modeRef.current;
        const currentCount = pomodoroCountRef.current;
        const currentSettings = settingsRef.current;

        let newCount = currentCount;
        if (currentMode === 'work') {
            newCount = currentCount + 1;
            setPomodoroCount(newCount);
            pomodoroCountRef.current = newCount;
        }

        const next = nextMode(currentMode, currentCount, currentSettings);
        const nextSeconds = durationFor(next, currentSettings);

        setMode(next);
        modeRef.current = next;
        setSecondsLeft(nextSeconds);
        secondsLeftRef.current = nextSeconds;
    }, [stopActiveTimer]);

    /** Stop the timer and jump directly to the given mode, resetting the clock. */
    const changeMode = useCallback(
        (newMode: SessionType) => {
            stopActiveTimer();
            const duration = durationFor(newMode, settingsRef.current);
            setMode(newMode);
            modeRef.current = newMode;
            setSecondsLeft(duration);
            secondsLeftRef.current = duration;
        },
        [stopActiveTimer],
    );

    // Clean up the interval when the component unmounts.
    useEffect(() => {
        return () => {
            timerService.stop();
        };
    }, []);

    return {
        secondsLeft,
        isRunning,
        mode,
        pomodoroCount,
        start,
        pause,
        reset,
        skip,
        changeMode,
    };
}
