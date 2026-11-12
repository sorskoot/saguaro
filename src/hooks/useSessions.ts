import { useState, useRef, useCallback } from 'react';
import { SessionRepository } from '../services/SessionRepository';
import { getDataStore } from '../services/db/DataStore';
import { logEvent } from '../services/eventLog';
import { generateId } from '../utils/id';
import type { Session, SessionType } from '../types';

/** Extra facts recorded when a session ends. */
export interface SessionEndDetails {
    /** Spike only: seconds past the minimum. */
    overtimeSeconds?: number;
    /** Spike only: ended before the minimum (a partial Spike). */
    endedEarly?: boolean;
    /** Break only: seconds past the fixed length. */
    breakOverrunSeconds?: number;
}

export interface UseSessionsResult {
    /**
     * All sessions, including completed and uncompleted ones.
     */
    sessions: Session[];

    /**
     * Adds a new session with a generated id and a start timestamp, and logs its start.
     * @param type The session type to create.
     * @param taskId Optional task association; can be null.
     * @param interruptions Number of interruptions noted during the session.
     * @returns The created session.
     */
    addSession: (
        type: SessionType,
        taskId: string | null,
        interruptions?: number,
    ) => Session;

    /**
     * Marks a session as completed and sets its completion timestamp.
     * @param id Session id to complete.
     * @param details Optional overtime / partial / overrun facts to record.
     */
    completeSession: (id: string, details?: SessionEndDetails) => void;

    /**
     * Marks a session as cancelled: sets its end timestamp but not `completed`.
     * @param id Session id to cancel.
     */
    cancelSession: (id: string) => void;

    /**
     * Permanently removes a session.
     * @param id Session id to delete.
     */
    deleteSession: (id: string) => void;
}

/**
 * Manages Spike and break sessions stored via {@link SessionRepository}.
 * Provides CRUD operations and keeps local state in sync with persistence.
 */
export function useSessions(): UseSessionsResult {
    const repoRef = useRef<SessionRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new SessionRepository(getDataStore().sessions);
    }
    const repo = repoRef.current;

    const [sessions, setSessions] = useState<Session[]>(() =>
        repo.findAll(),
    );

    const addSession = useCallback(
        (
            type: SessionType,
            taskId: string | null,
            interruptions = 0,
        ): Session => {
            const session: Session = {
                id: generateId(),
                type,
                taskId,
                startTime: new Date().toISOString(),
                endTime: null,
                completed: false,
                interruptions,
            };
            repo.save(session);
            logEvent(
                type === 'spike'
                    ? { type: 'spike-start', sessionId: session.id, taskId }
                    : { type: 'break-start', sessionId: session.id, breakType: type },
            );
            setSessions((prev) => [...prev, session]);
            return session;
        },
        [repo],
    );

    // Persisting and logging happen outside the state updater: React may run
    // updaters twice (StrictMode), which would write every event twice.
    const completeSession = useCallback(
        (id: string, details: SessionEndDetails = {}) => {
            const existing = repo.findById(id);
            if (!existing) return;
            const updated: Session = {
                ...existing,
                completed: true,
                endTime: new Date().toISOString(),
                ...(details.overtimeSeconds !== undefined
                    ? { overtimeSeconds: details.overtimeSeconds }
                    : {}),
                ...(details.endedEarly !== undefined ? { endedEarly: details.endedEarly } : {}),
                ...(details.breakOverrunSeconds !== undefined
                    ? { breakOverrunSeconds: details.breakOverrunSeconds }
                    : {}),
            };
            repo.save(updated);
            logEvent(
                updated.type === 'spike'
                    ? {
                          type: 'spike-end',
                          sessionId: id,
                          taskId: updated.taskId,
                          outcome: updated.endedEarly ? 'ended-early' : 'completed',
                          ...(updated.overtimeSeconds !== undefined
                              ? { overtimeSeconds: updated.overtimeSeconds }
                              : {}),
                      }
                    : {
                          type: 'break-end',
                          sessionId: id,
                          breakType: updated.type,
                          ...(updated.breakOverrunSeconds !== undefined
                              ? { overrunSeconds: updated.breakOverrunSeconds }
                              : {}),
                      },
            );
            setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
        },
        [repo],
    );

    const cancelSession = useCallback(
        (id: string) => {
            const existing = repo.findById(id);
            if (!existing) return;
            const updated: Session = {
                ...existing,
                completed: false,
                cancelled: true,
                endTime: new Date().toISOString(),
            };
            repo.save(updated);
            logEvent(
                updated.type === 'spike'
                    ? {
                          type: 'spike-end',
                          sessionId: id,
                          taskId: updated.taskId,
                          outcome: 'cancelled',
                      }
                    : { type: 'break-end', sessionId: id, breakType: updated.type },
            );
            setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
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

    return { sessions, addSession, completeSession, cancelSession, deleteSession };
}
