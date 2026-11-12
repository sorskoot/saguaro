import { useState, useCallback, useRef } from 'react';
import { getStorageService } from '../services/StorageService';
import { logEvent } from '../services/eventLog';

const STORAGE_KEY = 'saguaro:selectedTaskId';

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

    // The latest value, so the callback stays stable and still knows what it is switching from.
    const currentRef = useRef(selectedTaskId);

    const setSelectedTaskId = useCallback((id: string | null) => {
        if (id !== currentRef.current) {
            logEvent({ type: 'focus-switch', fromTaskId: currentRef.current, toTaskId: id });
            currentRef.current = id;
        }
        const storage = getStorageService();
        if (id === null) storage.remove(STORAGE_KEY);
        else storage.set(STORAGE_KEY, id);
        setState(id);
    }, []);

    return { selectedTaskId, setSelectedTaskId };
}
