export type TimerWorkerCommand =
    /** Start ticking; `startedAt` is the epoch ms the session began. */
    | { type: 'start'; startedAt: number }
    | { type: 'stop' };

export type TimerWorkerEvent = {
    type: 'tick';
    /** The `startedAt` of the session this tick belongs to, so stale ticks can be dropped. */
    startedAt: number;
    /** Whole seconds since `startedAt`. Keeps counting past the session length. */
    elapsedSeconds: number;
};
