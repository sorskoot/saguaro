import { useState, useRef, useCallback } from 'react';
import { PomodoroRepository } from '../services/PomodoroRepository';
import { getStorageService } from '../services/StorageService';
import { generateId } from '../utils/id';
import type { PomodoroSession, SessionType } from '../types';

export interface UsePomodorosResult {
    /**
     * All sessions, including completed and uncompleted ones.
     */
    sessions: PomodoroSession[];

    /**
     * Adds a new pomodoro session with a generated id and a start timestamp.
     * @param type The session type to create.
     * @param taskId Optional task association; can be null.
     * @returns The created session.
     */
    addSession: (
        type: SessionType,
        taskId: string | null,
    ) => PomodoroSession;

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
 * Manages pomodoro sessions stored via {@link PomodoroRepository}.
 * Provides CRUD operations and keeps local state in sync with persistence.
 */
export function usePomodoros(): UsePomodorosResult {
    const repoRef = useRef<PomodoroRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new PomodoroRepository(getStorageService());
    }
    const repo = repoRef.current;

    const [sessions, setSessions] = useState<PomodoroSession[]>(() =>
        repo.findAll(),
    );

    const addSession = useCallback(
        (type: SessionType, taskId: string | null): PomodoroSession => {
            const session: PomodoroSession = {
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
                    const updated: PomodoroSession = {
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
