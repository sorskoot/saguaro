import type { IStorageService } from './interfaces/IStorageService';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const SETTINGS_KEY = 'saguaro_settings';

export class SettingsRepository {
  constructor(private readonly storage: IStorageService) {}

  load(): Settings {
    const saved = this.storage.get<Settings>(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  }

  save(settings: Settings): void {
    this.storage.set(SETTINGS_KEY, settings);
  }
}
