import type { IRepository } from './interfaces/IRepository';
import type { IStorageService } from './interfaces/IStorageService';
import type { Session } from '../types';

const SESSIONS_KEY = 'pomodoro_sessions';

interface StoredSession extends Omit<Session, 'taskId'> {
  taskId?: string | null;
  projectId?: string | null;
}

export class PomodoroRepository implements IRepository<Session> {
  constructor(private readonly storage: IStorageService) {}

  private load(): Session[] {
    const stored = this.storage.get<StoredSession[]>(SESSIONS_KEY) ?? [];
    const needsMigration = stored.some(
      (session) => session.projectId !== undefined || session.taskId === undefined,
    );
    const sessions = stored.map(({ projectId, ...session }) => ({
      ...session,
      taskId: session.taskId ?? projectId ?? null,
    }));

    if (needsMigration) this.persist(sessions);
    return sessions;
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
