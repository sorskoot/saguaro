import { useState, useRef, useCallback, useEffect } from 'react';
import { ParkingLotRepository } from '../services/ParkingLotRepository';
import { getDataStore } from '../services/db/DataStore';
import { logEvent } from '../services/eventLog';
import { CAPTURE_EVENT } from '../services/parkingLotCapture';
import type { ParkingLotItem } from '../types';

export interface UseParkingLotResult {
    /** Captured thoughts that are still waiting to be promoted or dismissed, oldest first. */
    items: ParkingLotItem[];

    /**
     * Resolves an item: it leaves the list and the decision is logged.
     * @param id Item to resolve.
     * @param resolution Whether it became a task or was dismissed.
     * @param taskId The task created, when promoted.
     */
    resolveItem: (
        id: string,
        resolution: 'promoted' | 'dismissed',
        taskId?: string,
    ) => void;
}

/**
 * Reads the parking lot via {@link ParkingLotRepository}. Items are read when
 * the component mounts, so a screen that appears later (Re-entry) sees
 * everything captured so far, and again whenever a new thought is captured.
 */
export function useParkingLot(): UseParkingLotResult {
    const repoRef = useRef<ParkingLotRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new ParkingLotRepository(getDataStore().parkingLot);
    }
    const repo = repoRef.current;

    const [items, setItems] = useState<ParkingLotItem[]>(() => repo.findOpen());

    // A thought captured while this list is on screen (shortcut) joins it.
    useEffect(() => {
        const refresh = () => setItems(repo.findOpen());
        window.addEventListener(CAPTURE_EVENT, refresh);
        return () => window.removeEventListener(CAPTURE_EVENT, refresh);
    }, [repo]);

    // Persisting and logging happen outside the state updater: React may run
    // updaters twice (StrictMode), which would write every event twice.
    const resolveItem = useCallback(
        (id: string, resolution: 'promoted' | 'dismissed', taskId?: string) => {
            const existing = repo.findById(id);
            if (!existing || existing.resolution) return;
            repo.save({
                ...existing,
                resolution,
                resolvedAt: new Date().toISOString(),
                ...(taskId !== undefined ? { taskId } : {}),
            });
            logEvent({
                type: 'capture-resolved',
                itemId: id,
                resolution,
                ...(taskId !== undefined ? { taskId } : {}),
            });
            setItems((prev) => prev.filter((item) => item.id !== id));
        },
        [repo],
    );

    return { items, resolveItem };
}
