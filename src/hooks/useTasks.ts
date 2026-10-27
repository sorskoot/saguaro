import { useState, useRef, useCallback } from 'react';
import { TaskRepository } from '../services/TaskRepository';
import { getStorageService } from '../services/StorageService';
import { generateId } from '../utils/id';
import type { Task } from '../types';

export interface UseTasksResult {
    /**
     * Non-archived tasks.
     */
    tasks: Task[];

    /**
     * Creates a new task and persists it.
     * @param name Task display name.
     * @param color Task color value.
     */
    addTask: (name: string, color: string) => void;

    /**
     * Updates an existing task. If the id is not found, the partial is stored as a new task.
     * @param id Task id to update.
     * @param partial Partial task fields to merge.
     */
    updateTask: (id: string, partial: Partial<Task>) => void;

    /**
     * Marks a task as archived (soft delete). Archiving is reversible.
     * @param id Task id to archive.
     */
    archiveTask: (id: string) => void;

    /**
     * Permanently removes a task.
     * @param id Task id to delete.
     */
    deleteTask: (id: string) => void;
}

/**
 * Manages tasks via {@link TaskRepository}.
 * Maintains an internal list of all tasks (including archived) and exposes only active ones.
 */
export function useTasks(): UseTasksResult {
    const repoRef = useRef<TaskRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new TaskRepository(getStorageService());
    }
    const repo = repoRef.current;

    // allTasks holds every task (archived or not) so archiving is reversible.
    const [allTasks, setAllTasks] = useState<Task[]>(() =>
        repo.findAll(),
    );

    // Only expose non-archived tasks to consumers.
    const tasks = allTasks.filter((task) => !task.archived);

    const addTask = useCallback(
        (name: string, color: string) => {
            const task: Task = {
                id: generateId(),
                name,
                color,
                createdAt: new Date().toISOString(),
                archived: false,
            };
            repo.save(task);
            setAllTasks((prev) => [...prev, task]);
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

    const archiveTask = useCallback(
        (id: string) => {
            setAllTasks((prev) => {
                return prev.map((task) => {
                    if (task.id !== id) return task;
                    const updated = { ...task, archived: true };
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
        archiveTask,
        deleteTask,
    };
}
