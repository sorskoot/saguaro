import type { IExportService } from './interfaces/IExportService';
import type { DataStore } from './db/DataStore';
import type { AppData, Session, Task, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const APP_VERSION = '1.0';

export class ExportService implements IExportService {
  constructor(private readonly data: DataStore) {}

  exportData(): AppData {
    return {
      version: APP_VERSION,
      settings: this.data.settings.get() ?? { ...DEFAULT_SETTINGS },
      tasks: this.data.tasks.findAll(),
      sessions: this.data.sessions.findAll(),
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
    this.data.settings.set(appData.settings);
    this.data.tasks.replaceAll(appData.tasks);
    this.data.sessions.replaceAll(appData.sessions);
    return appData;
  }
}
