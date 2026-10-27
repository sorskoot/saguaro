import { useState, useCallback } from 'react';
import { getStorageService } from '../services/StorageService';

const STORAGE_KEY = 'pomodoro:selectedTaskId';

export interface UseSelectedTaskResult {
    selectedTaskId: string | null;
    setSelectedTaskId: (id: string | null) => void;
}

/**
 * Tracks the active task id, persisted so it is shared across pages.
 */
export function useSelectedTask(): UseSelectedTaskResult {
    const [selectedTaskId, setState] = useState<string | null>(() =>
        getStorageService().get<string>(STORAGE_KEY),
    );

    const setSelectedTaskId = useCallback((id: string | null) => {
        const storage = getStorageService();
        if (id === null) storage.remove(STORAGE_KEY);
        else storage.set(STORAGE_KEY, id);
        setState(id);
    }, []);

    return { selectedTaskId, setSelectedTaskId };
}
