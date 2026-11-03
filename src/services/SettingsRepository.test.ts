import { SettingsRepository } from './SettingsRepository';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import type { IStorageService } from './interfaces/IStorageService';

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    get: <T>(key: string): T | null => {
      const v = store[key];
      return v !== undefined ? (JSON.parse(v) as T) : null;
    },
    set: <T>(key: string, value: T) => {
      store[key] = JSON.stringify(value);
    },
    remove: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } satisfies IStorageService;
}

const SETTINGS_KEY = 'saguaro_settings';

describe('SettingsRepository', () => {
  it('load() returns DEFAULT_SETTINGS when nothing is stored', () => {
    const storage = createMockStorage();
    const repo = new SettingsRepository(storage);

    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('load() merges stored partial settings with defaults', () => {
    const storage = createMockStorage();
    const partial: Partial<Settings> = { workDuration: 50, soundEnabled: false };
    storage.set(SETTINGS_KEY, partial);

    const repo = new SettingsRepository(storage);
    const result = repo.load();

    expect(result).toEqual({ ...DEFAULT_SETTINGS, ...partial });
  });

  it('load() returns a fresh copy when stored settings match defaults', () => {
    const storage = createMockStorage();
    storage.set(SETTINGS_KEY, DEFAULT_SETTINGS);
    const repo = new SettingsRepository(storage);

    const result = repo.load();
    expect(result).toEqual(DEFAULT_SETTINGS);
    // Verify it is not the same reference as DEFAULT_SETTINGS
    expect(result).not.toBe(DEFAULT_SETTINGS);
  });

  it('save() persists settings under the correct key', () => {
    const storage = createMockStorage();
    const spy = vi.spyOn(storage, 'set');
    const repo = new SettingsRepository(storage);
    const settings: Settings = { ...DEFAULT_SETTINGS, workDuration: 45 };

    repo.save(settings);

    expect(spy).toHaveBeenCalledWith(SETTINGS_KEY, settings);
  });

  it('save() then load() round-trips correctly', () => {
    const storage = createMockStorage();
    const repo = new SettingsRepository(storage);
    const settings: Settings = { ...DEFAULT_SETTINGS, longBreakDuration: 30, autoStartBreaks: true };

    repo.save(settings);

    expect(repo.load()).toEqual(settings);
  });
});
