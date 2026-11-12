import { useState, useRef, useCallback } from 'react';
import { TaskRepository } from '../services/TaskRepository';
import { getDataStore } from '../services/db/DataStore';
import { generateId } from '../utils/id';
import type { Task, TaskDetails, TaskState } from '../types';

export interface UseTasksResult {
    /**
     * Tasks that are not done, or all tasks when includeDone is enabled.
     */
    tasks: Task[];

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
    const [allTasks, setAllTasks] = useState<Task[]>(() =>
        repo.findAll(),
    );

    const tasks = includeDone ? allTasks : allTasks.filter((task) => task.state !== 'done');

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
                createdAt: new Date().toISOString(),
            };
            repo.save(task);
            setAllTasks((prev) => [...prev, task]);
            return task;
        },
        [repo],
    );

    const updateTask = useCallback(
        (id: string, partial: Partial<Task>) => {
            setAllTasks((prev) => {
                const existing = prev.find((task) => task.id === id);
                const updated: Task = existing
                    ? { ...existing, ...partial, id }
                    : ({ ...partial, id } as Task);
                repo.save(updated);
                return existing
                    ? prev.map((task) => (task.id === id ? updated : task))
                    : [...prev, updated];
            });
        },
        [repo],
    );

    const setTaskState = useCallback(
        (id: string, state: TaskState) => {
            setAllTasks((prev) => {
                return prev.map((task) => {
                    if (task.id !== id) return task;
                    const updated = { ...task, state };
                    repo.save(updated);
                    return updated;
                });
            });
        },
        [repo],
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
        addTask,
        updateTask,
        setTaskState,
        deleteTask,
    };
}
