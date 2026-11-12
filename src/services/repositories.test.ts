import { DataStore } from './db/DataStore';
import { TaskRepository } from './TaskRepository';
import { SessionRepository } from './SessionRepository';
import { SettingsRepository } from './SettingsRepository';
import { ParkingLotRepository } from './ParkingLotRepository';
import { EventLogRepository } from './EventLogRepository';
import {
  DEFAULT_SETTINGS,
  type ParkingLotItem,
  type Session,
  type Settings,
  type Task,
} from '../types';

let data: DataStore;

beforeEach(() => {
  data = new DataStore();
});

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    color: '#ff0000',
    state: 'open',
    estimatedSpikes: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    taskId: null,
    type: 'spike',
    startTime: new Date().toISOString(),
    endTime: null,
    completed: false,
    ...overrides,
  };
}

describe('TaskRepository', () => {
  it('findAll() returns an empty array when nothing is stored', () => {
    expect(new TaskRepository(data.tasks).findAll()).toEqual([]);
  });

  it('save() adds a task and upserts an existing one', () => {
    const repo = new TaskRepository(data.tasks);
    const task = makeTask('t1');
    repo.save(task);
    repo.save({ ...task, name: 'Updated Name' });

    expect(repo.findAll()).toEqual([{ ...task, name: 'Updated Name' }]);
  });

  it('findById() finds a task or returns undefined', () => {
    const repo = new TaskRepository(data.tasks);
    repo.save(makeTask('t1'));

    expect(repo.findById('t1')?.id).toBe('t1');
    expect(repo.findById('missing')).toBeUndefined();
  });

  it('delete() removes only the given task', () => {
    const repo = new TaskRepository(data.tasks);
    repo.save(makeTask('t1'));
    repo.save(makeTask('t2'));
    repo.delete('t1');

    expect(repo.findAll().map((t) => t.id)).toEqual(['t2']);
  });

  it('keeps tasks without an estimate unestimated', () => {
    const repo = new TaskRepository(data.tasks);
    const task = makeTask('t1');
    delete task.estimatedSpikes;
    repo.save(task);

    expect(repo.findById('t1')).not.toHaveProperty('estimatedSpikes');
  });

  it('stores the new task fields', () => {
    const repo = new TaskRepository(data.tasks);
    const task = makeTask('t1', {
      state: 'waiting',
      nextAction: 'Review the PR',
      whereWasI: 'Halfway through the tests',
      summary: 'Agent is running',
      code: 'k3',
    });
    repo.save(task);

    expect(repo.findById('t1')).toEqual(task);
  });
});

describe('SessionRepository', () => {
  it('saves, upserts, finds and deletes sessions', () => {
    const repo = new SessionRepository(data.sessions);
    expect(repo.findAll()).toEqual([]);

    repo.save(makeSession('s1'));
    repo.save(makeSession('s2'));
    repo.save(makeSession('s1', { completed: true, overtimeSeconds: 90, endedEarly: false }));

    expect(repo.findAll()).toHaveLength(2);
    expect(repo.findById('s1')).toMatchObject({ completed: true, overtimeSeconds: 90 });

    repo.delete('s1');
    expect(repo.findAll().map((s) => s.id)).toEqual(['s2']);
    expect(repo.findById('s1')).toBeUndefined();
  });

  it('stores the break overrun on break sessions', () => {
    const repo = new SessionRepository(data.sessions);
    repo.save(makeSession('b1', { type: 'short-break', breakOverrunSeconds: 45 }));
    expect(repo.findById('b1')?.breakOverrunSeconds).toBe(45);
  });
});

describe('SettingsRepository', () => {
  it('load() returns the defaults when nothing is stored', () => {
    expect(new SettingsRepository(data.settings).load()).toEqual(DEFAULT_SETTINGS);
  });

  it('load() merges stored partial settings with defaults', () => {
    const partial: Partial<Settings> = { spikeMinimum: 50, breakEndChime: false };
    data.settings.set(partial as Settings);

    expect(new SettingsRepository(data.settings).load()).toEqual({
      ...DEFAULT_SETTINGS,
      ...partial,
    });
  });

  it('load() returns a fresh copy of the defaults', () => {
    const result = new SettingsRepository(data.settings).load();
    expect(result).not.toBe(DEFAULT_SETTINGS);
  });

  it('save() then load() round-trips', () => {
    const repo = new SettingsRepository(data.settings);
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      longBreakDuration: 30,
      bridgePairingCode: 'abc123',
    };
    repo.save(settings);

    expect(repo.load()).toEqual(settings);
  });
});

describe('ParkingLotRepository', () => {
  function makeItem(id: string, overrides: Partial<ParkingLotItem> = {}): ParkingLotItem {
    return { id, text: `Thought ${id}`, createdAt: '2026-11-12T10:00:00.000Z', sessionId: null, ...overrides };
  }

  it('saves, finds and deletes items', () => {
    const repo = new ParkingLotRepository(data.parkingLot);
    repo.save(makeItem('p1'));
    repo.save(makeItem('p2'));

    expect(repo.findAll()).toHaveLength(2);
    expect(repo.findById('p1')?.text).toBe('Thought p1');

    repo.delete('p1');
    expect(repo.findAll().map((i) => i.id)).toEqual(['p2']);
  });

  it('findOpen() leaves out promoted and dismissed items', () => {
    const repo = new ParkingLotRepository(data.parkingLot);
    repo.save(makeItem('open'));
    repo.save(makeItem('promoted', { resolution: 'promoted', taskId: 't1' }));
    repo.save(makeItem('dismissed', { resolution: 'dismissed' }));

    expect(repo.findOpen().map((i) => i.id)).toEqual(['open']);
  });
});

describe('EventLogRepository', () => {
  it('append() stamps an id and timestamp and stores the event', () => {
    const log = new EventLogRepository(data.events);
    const at = new Date('2026-11-12T10:00:00.000Z');
    const event = log.append({ type: 'spike-start', sessionId: 's1', taskId: 't1' }, at);

    expect(event).toMatchObject({
      type: 'spike-start',
      sessionId: 's1',
      taskId: 't1',
      timestamp: '2026-11-12T10:00:00.000Z',
    });
    expect(event.id).toEqual(expect.any(String));
    expect(log.findAll()).toEqual([event]);
  });

  it('keeps events in the order they were appended, even within one millisecond', () => {
    const log = new EventLogRepository(data.events);
    const at = new Date('2026-11-12T10:00:00.000Z');
    const events = Array.from({ length: 5 }, (_, i) =>
      log.append({ type: 'interruption', sessionId: `s${i}`, taskId: null }, at),
    );

    const ids = events.map((e) => e.id);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(5);
  });

  it('findByType() narrows to one event type', () => {
    const log = new EventLogRepository(data.events);
    log.append({ type: 'spike-start', sessionId: 's1', taskId: null });
    log.append({ type: 'task-state-change', taskId: 't1', from: 'open', to: 'waiting', source: 'user' });
    log.append({ type: 'task-state-change', taskId: 't1', from: 'waiting', to: 'ready', source: 'bridge' });

    const changes = log.findByType('task-state-change');
    expect(changes.map((e) => e.to)).toEqual(['waiting', 'ready']);
  });

  it('findSince() returns events at or after a timestamp', () => {
    const log = new EventLogRepository(data.events);
    log.append({ type: 'interruption', sessionId: null, taskId: null }, new Date('2026-11-12T09:00:00.000Z'));
    log.append({ type: 'interruption', sessionId: null, taskId: null }, new Date('2026-11-12T11:00:00.000Z'));

    expect(log.findSince('2026-11-12T10:00:00.000Z')).toHaveLength(1);
  });

  it('is append-only: it offers no way to change or remove events', () => {
    const log = new EventLogRepository(data.events) as unknown as Record<string, unknown>;
    for (const method of ['save', 'delete', 'update', 'clear', 'replaceAll']) {
      expect(log[method]).toBeUndefined();
    }
  });
});
