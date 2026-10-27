import type { IRepository } from './interfaces/IRepository';
import type { IStorageService } from './interfaces/IStorageService';
import type { PomodoroSession } from '../types';

const SESSIONS_KEY = 'pomodoro_sessions';

interface StoredPomodoroSession extends Omit<PomodoroSession, 'taskId'> {
  taskId?: string | null;
  projectId?: string | null;
}

export class PomodoroRepository implements IRepository<PomodoroSession> {
  constructor(private readonly storage: IStorageService) {}

  private load(): PomodoroSession[] {
    const stored = this.storage.get<StoredPomodoroSession[]>(SESSIONS_KEY) ?? [];
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

  private persist(sessions: PomodoroSession[]): void {
    this.storage.set(SESSIONS_KEY, sessions);
  }

  findAll(): PomodoroSession[] {
    return this.load();
  }

  findById(id: string): PomodoroSession | undefined {
    return this.load().find((s) => s.id === id);
  }

  save(session: PomodoroSession): void {
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
