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
  createdAt: string;
  archived: boolean;
}

export type SessionType = 'work' | 'short-break' | 'long-break';

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  type: SessionType;
  startTime: string;
  endTime: string | null;
  completed: boolean;
}

export interface AppData {
  version: string;
  settings: Settings;
  tasks: Task[];
  sessions: PomodoroSession[];
  exportedAt: string;
}
