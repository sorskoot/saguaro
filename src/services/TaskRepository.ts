import type { IRepository } from './interfaces/IRepository';
import type { CollectionStore } from './db/CollectionStore';
import type { Task } from '../types';

export class TaskRepository implements IRepository<Task> {
  constructor(private readonly store: CollectionStore<Task>) {}

  findAll(): Task[] {
    return this.store.findAll();
  }

  findById(id: string): Task | undefined {
    return this.store.findById(id);
  }

  save(task: Task): void {
    this.store.save(task);
  }

  delete(id: string): void {
    this.store.delete(id);
  }
}
