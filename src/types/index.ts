export interface Settings {
  /** Minimum Spike length in minutes. A Spike may run longer; this is not a limit. */
  spikeMinimum: number;
  shortBreakDuration: number; // minutes
  longBreakDuration: number;  // minutes
  longBreakInterval: number;  // Spikes before long break
  /** Soft chime when a break ends. The only sound in the app. */
  breakEndChime: boolean;
  /** One-time code that pairs this app with a local agent bridge; null until paired. */
  bridgePairingCode: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  spikeMinimum: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  breakEndChime: true,
  bridgePairingCode: null,
};

/**
 * Where a task stands.
 * - open: not being worked on by anyone (default for new tasks)
 * - focus: you are on it; exactly one task at a time
 * - waiting: someone or something else is on it
 * - asking: needs your input to continue
 * - ready: handed back to you; check the result
 * - done: finished
 */
export type TaskState = 'open' | 'focus' | 'waiting' | 'asking' | 'ready' | 'done';

export const TASK_STATES: readonly TaskState[] = [
  'open',
  'focus',
  'waiting',
  'asking',
  'ready',
  'done',
];

export interface Task {
  id: string;
  name: string;
  color: string;
  state: TaskState;
  /** Estimated number of Spikes. Optional; blank by default. */
  estimatedSpikes?: number;
  /** Optional free-text notes about the task. */
  description?: string;
  /** Optional http(s) link, e.g. to an issue on GitHub. */
  link?: string;
  /** One line: the very next physical step. */
  nextAction?: string;
  /** Short context note, written when leaving the task, shown when coming back. */
  whereWasI?: string;
  /** One line from whoever last changed the state. */
  summary?: string;
  /** Short handle such as "k3" that links agents to the task. */
  code?: string;
  createdAt: string;
}

/** Optional extra details that can be attached to a task. */
export interface TaskDetails {
  description?: string;
  link?: string;
}

export type SessionType = 'spike' | 'short-break' | 'long-break';

export interface Session {
  id: string;
  taskId: string | null;
  type: SessionType;
  startTime: string;
  endTime: string | null;
  completed: boolean;
  /** True when the session was cancelled before finishing; it is logged but never counted. */
  cancelled?: boolean;
  /** Number of interruptions noted during the session (absent in older data). */
  interruptions?: number;
  /** Spike only: seconds the Spike ran past the minimum. */
  overtimeSeconds?: number;
  /** Spike only: true when the Spike was ended before the minimum (a partial Spike). */
  endedEarly?: boolean;
  /** Break only: seconds the break ran past its fixed length. */
  breakOverrunSeconds?: number;
}

/** A side thought captured during a Spike, kept until promoted to a task or dismissed. */
export interface ParkingLotItem {
  id: string;
  text: string;
  createdAt: string;
  /** The Spike that was running when the thought was captured, if any. */
  sessionId: string | null;
  /** Set once the item has been promoted to a task or dismissed. */
  resolution?: 'promoted' | 'dismissed';
  resolvedAt?: string;
  /** The task created when the item was promoted. */
  taskId?: string;
}

interface EventBase {
  id: string;
  /** ISO timestamp of when the event happened. */
  timestamp: string;
}

/** Who caused a task change. */
export type EventSource = 'user' | 'bridge';

/**
 * One entry in the raw, append-only event log. Events are never edited or
 * removed, so new metrics can be derived later without changing what is recorded.
 */
export type AppEvent = EventBase &
  (
    | { type: 'spike-start'; sessionId: string; taskId: string | null }
    | {
        type: 'spike-end';
        sessionId: string;
        taskId: string | null;
        outcome: 'completed' | 'ended-early' | 'cancelled';
        overtimeSeconds?: number;
      }
    | { type: 'break-start'; sessionId: string; breakType: 'short-break' | 'long-break' }
    | {
        type: 'break-end';
        sessionId: string;
        breakType: 'short-break' | 'long-break';
        overrunSeconds?: number;
      }
    | { type: 'focus-switch'; fromTaskId: string | null; toTaskId: string | null }
    | {
        type: 'task-state-change';
        taskId: string;
        from: TaskState | null;
        to: TaskState;
        source: EventSource;
        summary?: string;
      }
    | { type: 'interruption'; sessionId: string | null; taskId: string | null }
    | { type: 'capture'; itemId: string; sessionId: string | null }
    | {
        type: 'capture-resolved';
        itemId: string;
        resolution: 'promoted' | 'dismissed';
        taskId?: string;
      }
    | {
        type: 'bridge-event';
        kind: 'connected' | 'disconnected' | 'paired' | 'message';
        detail?: string;
      }
  );

export type AppEventType = AppEvent['type'];

/** Distributes Omit over the AppEvent union so each variant keeps its own fields. */
export type NewAppEvent = AppEvent extends infer E
  ? E extends AppEvent
    ? Omit<E, 'id' | 'timestamp'>
    : never
  : never;

/** Version of the backup file format written by the export. */
export const APP_DATA_VERSION = '2.0';

export interface AppData {
  version: string;
  settings: Settings;
  tasks: Task[];
  sessions: Session[];
  /** The raw event log, oldest first. */
  events: AppEvent[];
  parkingLot: ParkingLotItem[];
  exportedAt: string;
}
