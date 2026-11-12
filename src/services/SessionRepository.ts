import type { IRepository } from './interfaces/IRepository';
import type { CollectionStore } from './db/CollectionStore';
import type { Session } from '../types';

export class SessionRepository implements IRepository<Session> {
  constructor(private readonly store: CollectionStore<Session>) {}

  findAll(): Session[] {
    return this.store.findAll();
  }

  findById(id: string): Session | undefined {
    return this.store.findById(id);
  }

  save(session: Session): void {
    this.store.save(session);
  }

  delete(id: string): void {
    this.store.delete(id);
  }
}
