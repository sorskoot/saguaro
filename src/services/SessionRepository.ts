import type { IRepository } from './interfaces/IRepository';
import type { IStorageService } from './interfaces/IStorageService';
import type { Session } from '../types';

const SESSIONS_KEY = 'saguaro_sessions';

export class SessionRepository implements IRepository<Session> {
  constructor(private readonly storage: IStorageService) {}

  private load(): Session[] {
    return this.storage.get<Session[]>(SESSIONS_KEY) ?? [];
  }

  private persist(sessions: Session[]): void {
    this.storage.set(SESSIONS_KEY, sessions);
  }

  findAll(): Session[] {
    return this.load();
  }

  findById(id: string): Session | undefined {
    return this.load().find((s) => s.id === id);
  }

  save(session: Session): void {
    const sessions = this.load();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    this.persist(sessions);
  }

  delete(id: string): void {
    this.persist(this.load().filter((s) => s.id !== id));
  }
}
