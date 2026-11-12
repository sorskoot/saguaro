import type { AppData } from '../../types';

export interface IExportService {
  exportData(): AppData;
  /** Replaces all data with the backup; rejects, changing nothing, if it is invalid or cannot be saved. */
  importData(data: unknown): Promise<AppData>;
}
