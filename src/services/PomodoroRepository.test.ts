import { PomodoroRepository } from './PomodoroRepository';
import type { PomodoroSession } from '../types';
import type { IStorageService } from './interfaces/IStorageService';

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    get: <T>(key: string): T | null => {
      const v = store[key];
      return v !== undefined ? (JSON.parse(v) as T) : null;
    },
    set: <T>(key: string, value: T) => {
      store[key] = JSON.stringify(value);
    },
    remove: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } satisfies IStorageService;
}

function makeSession(id: string, overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id,
    taskId: null,
    type: 'work',
    startTime: new Date().toISOString(),
    endTime: null,
    completed: false,
    ...overrides,
  };
}

describe('PomodoroRepository', () => {
  let storage: IStorageService;
  let repo: PomodoroRepository;

  beforeEach(() => {
    storage = createMockStorage();
    repo = new PomodoroRepository(storage);
  });

  it('findAll() returns an empty array when nothing is stored', () => {
    expect(repo.findAll()).toEqual([]);
  });

  it('save() adds a new session', () => {
    const session = makeSession('s1');
    repo.save(session);

    expect(repo.findAll()).toEqual([session]);
  });

  it('save() updates an existing session (upsert)', () => {
    const session = makeSession('s1');
    repo.save(session);

    const updated = { ...session, completed: true, endTime: new Date().toISOString() };
    repo.save(updated);

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].completed).toBe(true);
    expect(all[0].endTime).not.toBeNull();
  });

  it('save() can store multiple sessions', () => {
    repo.save(makeSession('s1'));
    repo.save(makeSession('s2'));
    repo.save(makeSession('s3'));

    expect(repo.findAll()).toHaveLength(3);
  });

  it('findById() returns the matching session', () => {
    const s1 = makeSession('s1');
    const s2 = makeSession('s2', { type: 'short-break' });
    repo.save(s1);
    repo.save(s2);

    expect(repo.findById('s2')).toEqual(s2);
  });

  it('findById() returns undefined for an unknown id', () => {
    repo.save(makeSession('s1'));

    expect(repo.findById('nonexistent')).toBeUndefined();
  });

  it('delete() removes the specified session', () => {
    repo.save(makeSession('s1'));
    repo.save(makeSession('s2'));

    repo.delete('s1');

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('s2');
  });

  it('delete() is a no-op for an unknown id', () => {
    repo.save(makeSession('s1'));

    repo.delete('ghost');

    expect(repo.findAll()).toHaveLength(1);
  });

  it('stores sessions with their full shape intact', () => {
    const session = makeSession('s1', {
      taskId: 'task-42',
      type: 'long-break',
      completed: true,
      endTime: '2024-01-01T10:30:00.000Z',
    });
    repo.save(session);

    expect(repo.findById('s1')).toEqual(session);
  });

  it('migrates existing project associations to task associations', () => {
    storage.set('pomodoro_sessions', [{
      ...makeSession('s1'),
      projectId: 'task-42',
    }]);

    expect(repo.findById('s1')).toMatchObject({ taskId: 'task-42' });
    expect(storage.get<Array<Record<string, unknown>>>('pomodoro_sessions')?.[0])
      .not.toHaveProperty('projectId');
  });
});
