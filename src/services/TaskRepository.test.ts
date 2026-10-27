import { TaskRepository } from './TaskRepository';
import type { Task } from '../types';
import type { IStorageService } from './interfaces/IStorageService';

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    get: <T>(key: string): T | null => {
      const value = store[key];
      return value !== undefined ? (JSON.parse(value) as T) : null;
    },
    set: <T>(key: string, value: T) => {
      store[key] = JSON.stringify(value);
    },
    remove: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
  } satisfies IStorageService;
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    color: '#ff0000',
    estimatedPomodoros: 1,
    createdAt: new Date().toISOString(),
    archived: false,
    ...overrides,
  };
}

describe('TaskRepository', () => {
  let storage: IStorageService;
  let repo: TaskRepository;

  beforeEach(() => {
    storage = createMockStorage();
    repo = new TaskRepository(storage);
  });

  it('findAll() returns an empty array when nothing is stored', () => {
    expect(repo.findAll()).toEqual([]);
  });

  it('save() adds a new task', () => {
    const task = makeTask('t1');
    repo.save(task);

    expect(repo.findAll()).toEqual([task]);
  });

  it('save() updates an existing task (upsert)', () => {
    const task = makeTask('t1');
    repo.save(task);
    repo.save({ ...task, name: 'Updated Name' });

    expect(repo.findAll()).toEqual([{ ...task, name: 'Updated Name' }]);
  });

  it('save() can store multiple tasks', () => {
    repo.save(makeTask('t1'));
    repo.save(makeTask('t2'));
    repo.save(makeTask('t3'));

    expect(repo.findAll()).toHaveLength(3);
  });

  it('findById() returns the matching task', () => {
    const task = makeTask('t2');
    repo.save(makeTask('t1'));
    repo.save(task);

    expect(repo.findById('t2')).toEqual(task);
  });

  it('findById() returns undefined for an unknown id', () => {
    repo.save(makeTask('t1'));

    expect(repo.findById('nonexistent')).toBeUndefined();
  });

  it('delete() removes the specified task', () => {
    repo.save(makeTask('t1'));
    repo.save(makeTask('t2'));
    repo.delete('t1');

    expect(repo.findAll().map((task) => task.id)).toEqual(['t2']);
  });

  it('delete() is a no-op for an unknown id', () => {
    repo.save(makeTask('t1'));
    repo.delete('ghost');

    expect(repo.findAll()).toHaveLength(1);
  });

  it('migrates existing projects from local storage to tasks', () => {
    const task = makeTask('t1', { estimatedPomodoros: undefined });
    storage.set('pomodoro_projects', [task]);

    const migratedTask = { ...task, estimatedPomodoros: 1 };
    expect(repo.findAll()).toEqual([migratedTask]);
    expect(storage.get('pomodoro_tasks')).toEqual([migratedTask]);
  });

  it('fills in the estimate for existing tasks without one', () => {
    const task = makeTask('t1', { estimatedPomodoros: undefined });
    storage.set('pomodoro_tasks', [task]);

    expect(repo.findAll()).toEqual([{ ...task, estimatedPomodoros: 1 }]);
    expect(storage.get('pomodoro_tasks')).toEqual([{ ...task, estimatedPomodoros: 1 }]);
  });
});
