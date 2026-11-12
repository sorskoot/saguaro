/// <reference lib="webworker" />

import type {
    TimerWorkerCommand,
    TimerWorkerEvent,
} from '../types/timerWorker';

let intervalId: number | null = null;
let startedAtMs = 0;

function stopInterval(): void {
    if (intervalId !== null) {
        self.clearInterval(intervalId);
        intervalId = null;
    }
}

function emit(message: TimerWorkerEvent): void {
    self.postMessage(message);
}

/**
 * Elapsed time always comes from timestamps, never from counting ticks, so
 * throttled background tabs still report the right time. The worker never
 * decides when a session is over: Spikes and breaks can run past their length.
 */
function startLoop(): void {
    stopInterval();
    intervalId = self.setInterval(() => {
        const elapsedSeconds = Math.max(
            0,
            Math.floor((Date.now() - startedAtMs) / 1000),
        );
        emit({ type: 'tick', elapsedSeconds });
    }, 1000);
}

self.onmessage = (event: MessageEvent<TimerWorkerCommand>) => {
    const message = event.data;

    if (message.type === 'start') {
        startedAtMs = message.startedAt;
        startLoop();
        return;
    }

    if (message.type === 'stop') {
        stopInterval();
    }
};
