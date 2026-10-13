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
    /**
     * Current timer settings that define durations and auto-start behavior.
     */
      settings: Settings;

    /**
     * Optional callback invoked when a session completes.
     * @param mode The completed session type.
     */
      onComplete?: (mode: SessionType) => void;
}

export interface UseTimerResult {
    /**
     * Seconds remaining for the active session.
     */
    secondsLeft: number;

    /**
     * Whether the timer service is actively running.
     */
    isRunning: boolean;

    /**
     * Current session mode.
     */
    mode: SessionType;

    /**
     * Number of completed work sessions so far.
     */
    pomodoroCount: number;

    /**
     * Starts/resumes the timer from the current `secondsLeft`.
     */
    start: () => void;

    /**
     * Pauses/stops the timer without changing the current session state.
     */
    pause: () => void;

    /**
     * Stops the timer and resets `secondsLeft` to the duration for the current mode.
     */
    reset: () => void;

    /**
     * Stops the timer and advances to the next mode without completing side effects
     * (no callback and no sound).
     */
    skip: () => void;

    /**
     * Switches to a specific mode and resets the clock for that mode.
     */
    changeMode: (mode: SessionType) => void;
}

/**
 * Returns the duration in seconds for the given mode and settings.
 * @param mode Session mode whose duration is needed.
 * @param settings Settings source containing per-mode durations.
 * @returns Duration in seconds.
 */
function durationFor(mode: SessionType, settings: Settings): number {
    if (mode === 'work') return settings.workDuration * 60;
    if (mode === 'short-break') return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
    if (mode === 'work') return settings.workDuration * 60;
    if (mode === 'short-break') return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
}

/**
 * Determines the next mode after the current one completes.
 * After every `longBreakInterval` work sessions, a long break is inserted.
 *
 * @param current Current session mode that just completed.
 * @param pomodoroCount Number of completed work sessions so far (before incrementing for the next work session).
 * @param settings Settings controlling long break interval.
 * @returns The next session mode.
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

/**
 * Runs the pomodoro countdown using a shared {@link timerService}.
 * Handles mode transitions, optional completion callbacks, and beep playback.
 */
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
    const pomodoroCountRef = useRef(pomodoroCount);
    const settingsRef = useRef(settings);
    const onCompleteRef = useRef(onComplete);
    // tickRef lets advanceMode always call the live tick without a forward-reference closure bug.
    const tickRef = useRef<TimerCallback>(() => {});

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);
    useEffect(() => {
        secondsLeftRef.current = secondsLeft;
    }, [secondsLeft]);
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
    const advanceMode = useCallback((autoStart: boolean) => {
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
            // timerService may already be stopped; start fresh.
            // Use tickRef so we always invoke the live tick, not the stale closure captured at creation time.
            timerService.stop();
            timerService.start(() => tickRef.current());
            setIsRunning(true);
        } else {
            setIsRunning(false);
        }
    }, []);

    /** Called every second by timerService. */
    const tick = useCallback(() => {
        const next = secondsLeftRef.current - 1;
        if (next > 0) {
            setSecondsLeft(next);
            secondsLeftRef.current = next;
            return;
        }
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
        setIsRunning(false);

        const completedMode = modeRef.current;
        const currentSettings = settingsRef.current;
        const completedMode = modeRef.current;
        const currentSettings = settingsRef.current;

        // Fire callback.
        onCompleteRef.current?.(completedMode);
        // Fire callback.
        onCompleteRef.current?.(completedMode);

        // Play sound.
        if (currentSettings.soundEnabled) {
            playBeep();
        }

        // Determine whether to auto-advance.
        const shouldAutoStart =
            completedMode === 'work'
                ? currentSettings.autoStartBreaks
                : currentSettings.autoStartPomodoros;
        // Determine whether to auto-advance.
        const shouldAutoStart =
            completedMode === 'work'
                ? currentSettings.autoStartBreaks
                : currentSettings.autoStartPomodoros;

        advanceMode(shouldAutoStart);
    }, [advanceMode]);

    // Keep tickRef pointing at the live tick so advanceMode's auto-start path is never stale.
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    const start = useCallback(() => {
        if (timerService.isRunning()) return;
        timerService.start(tick);
        setIsRunning(true);
    }, [tick]);

    const pause = useCallback(() => {
        timerService.stop();
        setIsRunning(false);
    }, []);

    const reset = useCallback(() => {
        timerService.stop();
        setIsRunning(false);
        const duration = durationFor(modeRef.current, settingsRef.current);
        setSecondsLeft(duration);
        secondsLeftRef.current = duration;
    }, []);

    const skip = useCallback(() => {
        timerService.stop();
        setIsRunning(false);
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
        let newCount = currentCount;
        if (currentMode === 'work') {
            newCount = currentCount + 1;
            setPomodoroCount(newCount);
            pomodoroCountRef.current = newCount;
        }

        const next = nextMode(currentMode, currentCount, currentSettings);
        const nextSeconds = durationFor(next, currentSettings);
        const next = nextMode(currentMode, currentCount, currentSettings);
        const nextSeconds = durationFor(next, currentSettings);

        setMode(next);
        modeRef.current = next;
        setSecondsLeft(nextSeconds);
        secondsLeftRef.current = nextSeconds;
    }, []);

    /** Stop the timer and jump directly to the given mode, resetting the clock. */
    const changeMode = useCallback((newMode: SessionType) => {
        timerService.stop();
        setIsRunning(false);
        const duration = durationFor(newMode, settingsRef.current);
        setMode(newMode);
        modeRef.current = newMode;
        setSecondsLeft(duration);
        secondsLeftRef.current = duration;
    }, []);

    // Clean up the interval when the component unmounts.
    useEffect(() => {
        return () => {
            timerService.stop();
        };
    }, []);
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
