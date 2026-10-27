import type { IExportService } from './interfaces/IExportService';
import type { IStorageService } from './interfaces/IStorageService';
import type { AppData, PomodoroSession, Task, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const APP_VERSION = '1.0';
const TASKS_KEY = 'pomodoro_tasks';
const LEGACY_PROJECTS_KEY = 'pomodoro_projects';

interface StoredPomodoroSession extends Omit<PomodoroSession, 'taskId'> {
  taskId?: string | null;
  projectId?: string | null;
}

function normalizeSessions(sessions: StoredPomodoroSession[]): PomodoroSession[] {
  return sessions.map(({ projectId, ...session }) => ({
    ...session,
    taskId: session.taskId ?? projectId ?? null,
  }));
}

export class ExportService implements IExportService {
  constructor(private readonly storage: IStorageService) {}

  exportData(): AppData {
    return {
      version: APP_VERSION,
      settings: this.storage.get<Settings>('pomodoro_settings') ?? { ...DEFAULT_SETTINGS },
      tasks:
        this.storage.get<Task[]>(TASKS_KEY) ??
        this.storage.get<Task[]>(LEGACY_PROJECTS_KEY) ??
        [],
      sessions: normalizeSessions(
        this.storage.get<StoredPomodoroSession[]>('pomodoro_sessions') ?? [],
      ),
      exportedAt: new Date().toISOString(),
    };
  }

  importData(data: unknown): AppData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: not an object');
    }
    const obj = data as Record<string, unknown>;
    const tasks = Array.isArray(obj.tasks) ? obj.tasks : obj.projects;
    if (!obj.version || !obj.settings || !Array.isArray(tasks) || !Array.isArray(obj.sessions)) {
      throw new Error('Invalid import data: missing required fields');
    }
    const appData: AppData = {
      version: obj.version as string,
      settings: obj.settings as Settings,
      tasks: tasks as Task[],
      sessions: normalizeSessions(obj.sessions as StoredPomodoroSession[]),
      exportedAt: (obj.exportedAt as string) ?? new Date().toISOString(),
    };
    this.storage.set('pomodoro_settings', appData.settings);
    this.storage.set(TASKS_KEY, appData.tasks);
    this.storage.set('pomodoro_sessions', appData.sessions);
    return appData;
  }
}
