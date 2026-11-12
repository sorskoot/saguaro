import { useState, useRef, useCallback } from 'react';
import { TaskRepository } from '../services/TaskRepository';
import { getDataStore } from '../services/db/DataStore';
import { logEvent } from '../services/eventLog';
import { generateId } from '../utils/id';
import type { Task, TaskDetails, TaskState } from '../types';

export interface UseTasksResult {
    /**
     * Tasks that are not done, or all tasks when includeDone is enabled.
     */
    tasks: Task[];

    /**
     * The id of the one task in the Focus state, or null when nothing is in Focus.
     */
    focusTaskId: string | null;

    /**
     * Makes a task the Focus. The previous Focus task moves to Open, so there is
     * never more than one. Pass null to leave Focus without picking another task.
     * @param id Task id to focus, or null.
     */
    setFocus: (id: string | null) => void;

    /**
     * Creates a new task and persists it.
     * @param name Task display name.
     * @param color Task color value.
     * @param estimatedSpikes Number of Spikes planned for the task; undefined when not estimated.
     * @param details Optional description and link.
     */
    addTask: (
        name: string,
        color: string,
        estimatedSpikes: number | undefined,
        details?: TaskDetails,
    ) => Task;

    /**
     * Updates an existing task. If the id is not found, the partial is stored as a new task.
     * @param id Task id to update.
     * @param partial Partial task fields to merge.
     */
    updateTask: (id: string, partial: Partial<Task>) => void;

    /**
     * Moves a task to the given state. Done tasks are hidden by default but can be reopened.
     * @param id Task id to change.
     * @param state The new state.
     */
    setTaskState: (id: string, state: TaskState) => void;

    /**
     * Permanently removes a task.
     * @param id Task id to delete.
     */
    deleteTask: (id: string) => void;
}

/** Returns the task in a new state. A summary belongs to whoever set the old state, so it is dropped. */
function withState(task: Task, state: TaskState): Task {
    const { summary: _summary, ...rest } = task;
    return { ...rest, state };
}

/**
 * Manages tasks via {@link TaskRepository}.
 * Maintains an internal list of all tasks (including done) and defaults to exposing the ones still in play.
 */
export function useTasks(includeDone = false): UseTasksResult {
    const repoRef = useRef<TaskRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new TaskRepository(getDataStore().tasks);
    }
    const repo = repoRef.current;

    // allTasks holds every task (done or not) so marking a task done is reversible.
    const [allTasks, setAllTasks] = useState<Task[]>(() => {
        // Two tabs can focus different tasks before either sees the other's write, leaving
        // two Focus tasks. Repair that on load: the earliest-created one keeps Focus.
        const focused = repo.findAll().filter((task) => task.state === 'focus');
        for (const task of focused.slice(1)) {
            repo.save(withState(task, 'open'));
            logEvent({
                type: 'task-state-change',
                taskId: task.id,
                from: 'focus',
                to: 'open',
                source: 'user',
            });
        }
        return repo.findAll();
    });

    const tasks = includeDone ? allTasks : allTasks.filter((task) => task.state !== 'done');
    const focusTaskId = allTasks.find((task) => task.state === 'focus')?.id ?? null;

    const addTask = useCallback(
        (name: string, color: string, estimatedSpikes: number | undefined, details?: TaskDetails) => {
            const task: Task = {
                id: generateId(),
                name,
                color,
                state: 'open',
                ...(estimatedSpikes !== undefined ? { estimatedSpikes } : {}),
                ...(details?.description ? { description: details.description } : {}),
                ...(details?.link ? { link: details.link } : {}),
                ...(details?.nextAction ? { nextAction: details.nextAction } : {}),
                ...(details?.whereWasI ? { whereWasI: details.whereWasI } : {}),
                createdAt: new Date().toISOString(),
            };
            repo.save(task);
            logEvent({
                type: 'task-state-change',
                taskId: task.id,
                from: null,
                to: task.state,
                source: 'user',
            });
            setAllTasks((prev) => [...prev, task]);
            return task;
        },
        [repo],
    );

    // Focus is exclusive: every other Focus task goes back to Open. Persisting and
    // logging happen here, outside any state updater (see updateTask).
    const setFocus = useCallback(
        (id: string | null) => {
            const all = repo.findAll();
            const target = id === null ? undefined : all.find((task) => task.id === id);
            if (id !== null && (!target || target.state === 'done')) return;

            const focused = all.filter((task) => task.state === 'focus');
            if (focused.length === 0 && target === undefined) return;
            if (focused.length === 1 && focused[0].id === id) return;

            const previousId = focused[0]?.id ?? null;
            for (const task of focused) {
                if (task.id === id) continue;
                repo.save(withState(task, 'open'));
                logEvent({
                    type: 'task-state-change',
                    taskId: task.id,
                    from: 'focus',
                    to: 'open',
                    source: 'user',
                });
            }
            if (target && target.state !== 'focus') {
                repo.save(withState(target, 'focus'));
                logEvent({
                    type: 'task-state-change',
                    taskId: target.id,
                    from: target.state,
                    to: 'focus',
                    source: 'user',
                });
            }
            if (previousId !== id) {
                logEvent({ type: 'focus-switch', fromTaskId: previousId, toTaskId: id });
            }
            setAllTasks(repo.findAll());
        },
        [repo],
    );

    // Persisting and logging happen outside the state updater: React may run
    // updaters twice (StrictMode), which would write every event twice.
    const updateTask = useCallback(
        (id: string, partial: Partial<Task>) => {
            // Focus is exclusive, so it always goes through setFocus: apply the other
            // changes first (a missing task is created Open), then take Focus.
            const wantsFocus = partial.state === 'focus';
            const existing = repo.findById(id);
            if (wantsFocus) {
                partial = { ...partial, state: existing?.state ?? 'open' };
            }
            const updated: Task = existing
                ? { ...existing, ...partial, id }
                : ({ ...partial, id } as Task);
            repo.save(updated);
            if (updated.state !== existing?.state) {
                logEvent({
                    type: 'task-state-change',
                    taskId: id,
                    from: existing?.state ?? null,
                    to: updated.state,
                    source: 'user',
                });
            }
            setAllTasks((prev) =>
                prev.some((task) => task.id === id)
                    ? prev.map((task) => (task.id === id ? updated : task))
                    : [...prev, updated],
            );
            if (wantsFocus) setFocus(id);
        },
        [repo, setFocus],
    );

    const setTaskState = useCallback(
        (id: string, state: TaskState) => {
            if (state === 'focus') {
                setFocus(id);
                return;
            }
            const existing = repo.findById(id);
            if (!existing || existing.state === state) return;
            const updated = withState(existing, state);
            repo.save(updated);
            logEvent({
                type: 'task-state-change',
                taskId: id,
                from: existing.state,
                to: state,
                source: 'user',
            });
            if (existing.state === 'focus') {
                logEvent({ type: 'focus-switch', fromTaskId: id, toTaskId: null });
            }
            setAllTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
        },
        [repo, setFocus],
    );

    const deleteTask = useCallback(
        (id: string) => {
            repo.delete(id);
            setAllTasks((prev) => prev.filter((task) => task.id !== id));
        },
        [repo],
    );

    return {
        tasks,
        focusTaskId,
        setFocus,
        addTask,
        updateTask,
        setTaskState,
        deleteTask,
    };
}
