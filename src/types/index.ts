export interface Settings {
  workDuration: number;       // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number;  // minutes
  longBreakInterval: number;  // pomodoros before long break
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundEnabled: true,
};

export interface Task {
  id: string;
  name: string;
  color: string;
  estimatedPomodoros: number;
  /** Optional free-text notes about the task. */
  description?: string;
  /** Optional http(s) link, e.g. to an issue on GitHub. */
  link?: string;
  createdAt: string;
  archived: boolean;
}

/** Optional extra details that can be attached to a task. */
export interface TaskDetails {
  description?: string;
  link?: string;
}

export type SessionType = 'work' | 'short-break' | 'long-break';

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
}

export interface AppData {
  version: string;
  settings: Settings;
  tasks: Task[];
  sessions: Session[];
  exportedAt: string;
}
