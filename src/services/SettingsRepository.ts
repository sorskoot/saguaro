import type { ValueStore } from './db/CollectionStore';
import { DEFAULT_SETTINGS, type Settings } from '../types';

export class SettingsRepository {
  constructor(private readonly store: ValueStore<Settings>) {}

  /** Stored settings merged over the defaults, so new settings always have a value. */
  load(): Settings {
    const saved = this.store.get();
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  }

  save(settings: Settings): void {
    this.store.set(settings);
  }
}
