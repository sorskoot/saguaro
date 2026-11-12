export type WorkerMode = 'spike' | 'short-break' | 'long-break';

export type TimerWorkerCommand =
    | { type: 'start'; endAt: number }
    | { type: 'pause' }
    | { type: 'stop' }
    | { type: 'sync'; endAt: number };

export type TimerWorkerEvent =
    | { type: 'tick'; secondsLeft: number }
    | { type: 'complete' };
