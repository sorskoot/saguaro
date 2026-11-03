import { useState, useRef, useCallback } from 'react';
import { SessionRepository } from '../services/SessionRepository';
import { getStorageService } from '../services/StorageService';
import { generateId } from '../utils/id';
import type { Session, SessionType } from '../types';

export interface UseSessionsResult {
    /**
     * All sessions, including completed and uncompleted ones.
     */
    sessions: Session[];

    /**
     * Adds a new pomodoro session with a generated id and a start timestamp.
     * @param type The session type to create.
     * @param taskId Optional task association; can be null.
     * @returns The created session.
     */
    addSession: (
        type: SessionType,
        taskId: string | null,
    ) => Session;

    /**
     * Marks a session as completed and sets its completion timestamp.
     * @param id Session id to complete.
     */
    completeSession: (id: string) => void;

    /**
     * Permanently removes a session.
     * @param id Session id to delete.
     */
    deleteSession: (id: string) => void;
}

/**
 * Manages pomodoro sessions stored via {@link SessionRepository}.
 * Provides CRUD operations and keeps local state in sync with persistence.
 */
export function useSessions(): UseSessionsResult {
    const repoRef = useRef<SessionRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new SessionRepository(getStorageService());
    }
    const repo = repoRef.current;

    const [sessions, setSessions] = useState<Session[]>(() =>
        repo.findAll(),
    );

    const addSession = useCallback(
        (type: SessionType, taskId: string | null): Session => {
            const session: Session = {
                id: generateId(),
                type,
                taskId,
                startTime: new Date().toISOString(),
                endTime: null,
                completed: false,
            };
            repo.save(session);
            setSessions((prev) => [...prev, session]);
            return session;
        },
        [repo],
    );

    const completeSession = useCallback(
        (id: string) => {
            setSessions((prev) => {
                return prev.map((s) => {
                    if (s.id !== id) return s;
                    const updated: Session = {
                        ...s,
                        completed: true,
                        endTime: new Date().toISOString(),
                    };
                    repo.save(updated);
                    return updated;
                });
            });
        },
        [repo],
    );

    const deleteSession = useCallback(
        (id: string) => {
            repo.delete(id);
            setSessions((prev) => prev.filter((s) => s.id !== id));
        },
        [repo],
    );

    return { sessions, addSession, completeSession, deleteSession };
}
