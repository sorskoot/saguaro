import type { IRepository } from './interfaces/IRepository';
import type { IStorageService } from './interfaces/IStorageService';
import type { Task } from '../types';

const TASKS_KEY = 'pomodoro_tasks';
const LEGACY_PROJECTS_KEY = 'pomodoro_projects';

export class TaskRepository implements IRepository<Task> {
  constructor(private readonly storage: IStorageService) {}

  private load(): Task[] {
    const tasks = this.storage.get<Task[]>(TASKS_KEY);
    if (tasks !== null) return tasks;

    const legacyTasks = this.storage.get<Task[]>(LEGACY_PROJECTS_KEY);
    if (legacyTasks !== null) {
      this.persist(legacyTasks);
      return legacyTasks;
    }

    return [];
  }

  private persist(tasks: Task[]): void {
    this.storage.set(TASKS_KEY, tasks);
  }

  findAll(): Task[] {
    return this.load();
  }

  findById(id: string): Task | undefined {
    return this.load().find((task) => task.id === id);
  }

  save(task: Task): void {
    const tasks = this.load();
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    this.persist(tasks);
  }

  delete(id: string): void {
    this.persist(this.load().filter((task) => task.id !== id));
  }
}
