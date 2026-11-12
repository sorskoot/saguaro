import { renderHook, act } from '@testing-library/react';
import { useParkingLot } from './useParkingLot';
import { getDataStore } from '../services/db/DataStore';
import { EventLogRepository } from '../services/EventLogRepository';
import type { ParkingLotItem } from '../types';

function item(id: string, text: string, createdAt: string, extra: Partial<ParkingLotItem> = {}): ParkingLotItem {
    return { id, text, createdAt, sessionId: null, ...extra };
}

beforeEach(() => {
    getDataStore().parkingLot.replaceAll([
        item('a', 'Reply to Sam', '2026-11-12T09:00:00Z'),
        item('b', 'Look up flights', '2026-11-12T09:05:00Z'),
        item('c', 'Old one', '2026-11-11T09:00:00Z', { resolution: 'dismissed' }),
    ]);
});

describe('useParkingLot', () => {
    it('lists only unresolved items, oldest first', () => {
        const { result } = renderHook(() => useParkingLot());
        expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b']);
    });

    it('marks an item promoted, links the task and logs it', () => {
        const { result } = renderHook(() => useParkingLot());
        act(() => result.current.resolveItem('a', 'promoted', 'task-1'));

        expect(result.current.items.map((i) => i.id)).toEqual(['b']);
        expect(getDataStore().parkingLot.findById('a')).toMatchObject({
            resolution: 'promoted',
            taskId: 'task-1',
        });
        expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
            { type: 'capture-resolved', itemId: 'a', resolution: 'promoted', taskId: 'task-1' },
        ]);
    });

    it('marks an item dismissed and does not resolve it twice', () => {
        const { result } = renderHook(() => useParkingLot());
        act(() => result.current.resolveItem('b', 'dismissed'));
        act(() => result.current.resolveItem('b', 'promoted', 'x'));

        expect(getDataStore().parkingLot.findById('b')).toMatchObject({ resolution: 'dismissed' });
        expect(getDataStore().parkingLot.findById('b')).not.toHaveProperty('taskId');
        expect(new EventLogRepository(getDataStore().events).findAll()).toHaveLength(1);
    });
});
