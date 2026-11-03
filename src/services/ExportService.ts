import type { IExportService } from './interfaces/IExportService';
import type { IStorageService } from './interfaces/IStorageService';
import type { AppData, Session, Task, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const APP_VERSION = '1.0';
const TASKS_KEY = 'saguaro_tasks';

export class ExportService implements IExportService {
  constructor(private readonly storage: IStorageService) {}

  exportData(): AppData {
    return {
      version: APP_VERSION,
      settings: this.storage.get<Settings>('saguaro_settings') ?? { ...DEFAULT_SETTINGS },
      tasks: this.storage.get<Task[]>(TASKS_KEY) ?? [],
      sessions: this.storage.get<Session[]>('saguaro_sessions') ?? [],
      exportedAt: new Date().toISOString(),
    };
  }

  importData(data: unknown): AppData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: not an object');
    }
    const obj = data as Record<string, unknown>;
    const tasks = obj.tasks;
    if (!obj.version || !obj.settings || !Array.isArray(tasks) || !Array.isArray(obj.sessions)) {
      throw new Error('Invalid import data: missing required fields');
    }
    const appData: AppData = {
      version: obj.version as string,
      settings: obj.settings as Settings,
      tasks: tasks as Task[],
      sessions: obj.sessions as Session[],
      exportedAt: (obj.exportedAt as string) ?? new Date().toISOString(),
    };
    this.storage.set('saguaro_settings', appData.settings);
    this.storage.set(TASKS_KEY, appData.tasks);
    this.storage.set('saguaro_sessions', appData.sessions);
    return appData;
  }
}
