import { useState, useRef, useCallback } from 'react';
import { ProjectRepository } from '../services/ProjectRepository';
import { getStorageService } from '../services/StorageService';
import { generateId } from '../utils/id';
import type { Project } from '../types';

export interface UseProjectsResult {
    /**
     * Non-archived projects.
     */
    projects: Project[];

    /**
     * Creates a new project and persists it.
     * @param name Project display name.
     * @param color Project color value.
     */
    addProject: (name: string, color: string) => void;

    /**
     * Updates an existing project. If the id is not found, the partial is stored as a new project.
     * @param id Project id to update.
     * @param partial Partial project fields to merge.
     */
    updateProject: (id: string, partial: Partial<Project>) => void;

    /**
     * Marks a project as archived (soft delete). Archiving is reversible.
     * @param id Project id to archive.
     */
    archiveProject: (id: string) => void;

    /**
     * Permanently removes a project.
     * @param id Project id to delete.
     */
    deleteProject: (id: string) => void;
}

/**
 * Manages projects via {@link ProjectRepository}.
 * Maintains an internal list of all projects (including archived) and exposes only active ones.
 */
export function useProjects(): UseProjectsResult {
    const repoRef = useRef<ProjectRepository | null>(null);
    if (repoRef.current === null) {
        repoRef.current = new ProjectRepository(getStorageService());
    }
    const repo = repoRef.current;

    // allProjects holds every project (archived or not) so archiving is reversible.
    const [allProjects, setAllProjects] = useState<Project[]>(() =>
        repo.findAll(),
    );

    // Only expose non-archived projects to consumers.
    const projects = allProjects.filter((p) => !p.archived);

    const addProject = useCallback(
        (name: string, color: string) => {
            const project: Project = {
                id: generateId(),
                name,
                color,
                createdAt: new Date().toISOString(),
                archived: false,
            };
            repo.save(project);
            setAllProjects((prev) => [...prev, project]);
        },
        [repo],
    );

    const updateProject = useCallback(
        (id: string, partial: Partial<Project>) => {
            setAllProjects((prev) => {
                const existing = prev.find((p) => p.id === id);
                const updated: Project = existing
                    ? { ...existing, ...partial, id }
                    : ({ ...partial, id } as Project);
                repo.save(updated);
                return existing
                    ? prev.map((p) => (p.id === id ? updated : p))
                    : [...prev, updated];
            });
        },
        [repo],
    );

    const archiveProject = useCallback(
        (id: string) => {
            setAllProjects((prev) => {
                return prev.map((p) => {
                    if (p.id !== id) return p;
                    const updated = { ...p, archived: true };
                    repo.save(updated);
                    return updated;
                });
            });
        },
        [repo],
    );

    const deleteProject = useCallback(
        (id: string) => {
            repo.delete(id);
            setAllProjects((prev) => prev.filter((p) => p.id !== id));
        },
        [repo],
    );

    return {
        projects,
        addProject,
        updateProject,
        archiveProject,
        deleteProject,
    };
}
