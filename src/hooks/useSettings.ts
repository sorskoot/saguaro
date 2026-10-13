import { useState, useRef, useCallback } from 'react';
import { SettingsRepository } from '../services/SettingsRepository';
import { getStorageService } from '../services/StorageService';
import type { Settings } from '../types';

export interface UseSettingsResult {
    /**
     * Current persisted settings.
     */
    settings: Settings;

    /**
     * Updates settings by merging the provided partial values into the existing state.
     * @param partial Partial settings values to merge.
     */
    updateSettings: (partial: Partial<Settings>) => void;
}

/**
 * Loads and manages app settings persisted via {@link SettingsRepository}.
 * Keeps local state synchronized with saved settings.
 */
export function useSettings(): UseSettingsResult {
    const repoRef = useRef<SettingsRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new SettingsRepository(getStorageService());
    }
    const repo = repoRef.current;

    const [settings, setSettings] = useState<Settings>(() => repo.load());

    const updateSettings = useCallback(
        (partial: Partial<Settings>) => {
            setSettings((prev) => {
                const next = { ...prev, ...partial };
                repo.save(next);
                return next;
            });
        },
        [repo],
    );

    return { settings, updateSettings };
}
