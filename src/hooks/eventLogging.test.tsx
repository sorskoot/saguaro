import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useTasks } from './useTasks';
import { useSessions } from './useSessions';
import { getDataStore } from '../services/db/DataStore';
import { EventLogRepository } from '../services/EventLogRepository';

function events() {
  return new EventLogRepository(getDataStore().events).findAll();
}

beforeEach(() => {
  localStorage.clear();
});

describe('event log: tasks', () => {
  it('addTask logs the task entering the Open state', () => {
    const { result } = renderHook(() => useTasks());
    let id = '';
    act(() => {
      id = result.current.addTask('Write docs', '#ff0000', undefined).id;
    });

    expect(events()).toMatchObject([
      { type: 'task-state-change', taskId: id, from: null, to: 'open', source: 'user' },
    ]);
  });

  it('setTaskState logs one event per change and none when the state is unchanged', () => {
    const { result } = renderHook(() => useTasks());
    let id = '';
    act(() => {
      id = result.current.addTask('Write docs', '#ff0000', 1).id;
    });
    act(() => {
      result.current.setTaskState(id, 'waiting');
      result.current.setTaskState(id, 'waiting');
      result.current.setTaskState(id, 'ready');
    });

    const changes = new EventLogRepository(getDataStore().events).findByType('task-state-change');
    expect(changes.map((e) => [e.from, e.to])).toEqual([
      [null, 'open'],
      ['open', 'waiting'],
      ['waiting', 'ready'],
    ]);
  });

  it('setTaskState ignores unknown tasks', () => {
    const { result } = renderHook(() => useTasks());
    act(() => {
      result.current.setTaskState('missing', 'done');
    });
    expect(events()).toEqual([]);
  });

  it('updateTask logs only when the state field changes', () => {
    const { result } = renderHook(() => useTasks());
    let id = '';
    act(() => {
      id = result.current.addTask('Write docs', '#ff0000', 1).id;
    });
    act(() => {
      result.current.updateTask(id, { name: 'Renamed', nextAction: 'Open the file' });
    });
    expect(events()).toHaveLength(1);

    act(() => {
      result.current.updateTask(id, { state: 'asking' });
    });
    expect(events()).toHaveLength(2);
    expect(events()[1]).toMatchObject({ type: 'task-state-change', from: 'open', to: 'asking' });
  });

  it('writes each event once under StrictMode', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useTasks(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.addTask('Write docs', '#ff0000', 1).id;
    });
    act(() => {
      result.current.setTaskState(id, 'done');
      result.current.updateTask(id, { state: 'open' });
    });

    expect(events().map((e) => e.type)).toEqual([
      'task-state-change',
      'task-state-change',
      'task-state-change',
    ]);
  });
});

describe('event log: sessions', () => {
  it('logs a Spike start and a completed end', () => {
    const { result } = renderHook(() => useSessions());
    let id = '';
    act(() => {
      id = result.current.addSession('spike', 't1').id;
    });
    act(() => {
      result.current.completeSession(id);
    });

    expect(events()).toMatchObject([
      { type: 'spike-start', sessionId: id, taskId: 't1' },
      { type: 'spike-end', sessionId: id, taskId: 't1', outcome: 'completed' },
    ]);
  });

  it('records overtime on the session and in the event', () => {
    const { result } = renderHook(() => useSessions());
    let id = '';
    act(() => {
      id = result.current.addSession('spike', null).id;
    });
    act(() => {
      result.current.completeSession(id, { overtimeSeconds: 192, endedEarly: false });
    });

    expect(result.current.sessions[0]).toMatchObject({ overtimeSeconds: 192, endedEarly: false });
    expect(events()[1]).toMatchObject({ type: 'spike-end', outcome: 'completed', overtimeSeconds: 192 });
  });

  it('logs an early end as ended-early', () => {
    const { result } = renderHook(() => useSessions());
    let id = '';
    act(() => {
      id = result.current.addSession('spike', null).id;
    });
    act(() => {
      result.current.completeSession(id, { endedEarly: true });
    });

    expect(events()[1]).toMatchObject({ type: 'spike-end', outcome: 'ended-early' });
  });

  it('logs a cancelled Spike as cancelled and does not count it as completed', () => {
    const { result } = renderHook(() => useSessions());
    let id = '';
    act(() => {
      id = result.current.addSession('spike', 't1').id;
    });
    act(() => {
      result.current.cancelSession(id);
    });

    expect(events()[1]).toMatchObject({ type: 'spike-end', sessionId: id, outcome: 'cancelled' });
    expect(result.current.sessions[0]).toMatchObject({ completed: false, cancelled: true });
  });

  it('logs break start and end with the overrun', () => {
    const { result } = renderHook(() => useSessions());
    let id = '';
    act(() => {
      id = result.current.addSession('long-break', null).id;
    });
    act(() => {
      result.current.completeSession(id, { breakOverrunSeconds: 75 });
    });

    expect(events()).toMatchObject([
      { type: 'break-start', sessionId: id, breakType: 'long-break' },
      { type: 'break-end', sessionId: id, breakType: 'long-break', overrunSeconds: 75 },
    ]);
    expect(result.current.sessions[0].breakOverrunSeconds).toBe(75);
  });

  it('writes each event once under StrictMode', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useSessions(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.addSession('spike', null).id;
    });
    act(() => {
      result.current.completeSession(id);
    });

    expect(events().map((e) => e.type)).toEqual(['spike-start', 'spike-end']);
  });
});

describe('event log: focus switches', () => {
  function setup() {
    const { result } = renderHook(() => useTasks());
    const ids: string[] = [];
    act(() => {
      ids.push(result.current.addTask('A', '#f00', undefined).id);
      ids.push(result.current.addTask('B', '#0f0', undefined).id);
    });
    const [a, b] = ids;
    return { result, a, b };
  }

  const switches = () => new EventLogRepository(getDataStore().events).findByType('focus-switch');

  it('logs a switch from the previous task to the new one and keeps one Focus', () => {
    const { result, a, b } = setup();
    act(() => result.current.setFocus(a));
    act(() => result.current.setFocus(b));
    act(() => result.current.setFocus(null));

    expect(switches()).toMatchObject([
      { fromTaskId: null, toTaskId: a },
      { fromTaskId: a, toTaskId: b },
      { fromTaskId: b, toTaskId: null },
    ]);
    expect(result.current.tasks.map((t) => t.state)).toEqual(['open', 'open']);
  });

  it('moves the old Focus to Open and logs both state changes', () => {
    const { result, a, b } = setup();
    act(() => result.current.setFocus(a));
    act(() => result.current.setFocus(b));

    expect(result.current.focusTaskId).toBe(b);
    const changes = new EventLogRepository(getDataStore().events)
      .findByType('task-state-change')
      .map((e) => [e.taskId, e.from, e.to]);
    expect(changes.slice(-2)).toEqual([
      [a, 'focus', 'open'],
      [b, 'open', 'focus'],
    ]);
  });

  it('does not log when the same task is focused again', () => {
    const { result, a } = setup();
    act(() => result.current.setFocus(a));
    act(() => result.current.setFocus(a));
    expect(switches()).toHaveLength(1);
  });

  it('ignores unknown and done tasks', () => {
    const { result, a, b } = setup();
    act(() => result.current.setTaskState(b, 'done'));
    act(() => result.current.setFocus('missing'));
    act(() => result.current.setFocus(b));
    expect(result.current.focusTaskId).toBeNull();
    expect(switches()).toHaveLength(0);
    expect(result.current.tasks.map((t) => t.id)).toEqual([a]);
  });

  it('logs leaving Focus by changing the state, and keeps Focus exclusive via setTaskState', () => {
    const { result, a, b } = setup();
    act(() => result.current.setTaskState(a, 'focus'));
    act(() => result.current.setTaskState(b, 'focus'));
    expect(result.current.focusTaskId).toBe(b);
    act(() => result.current.setTaskState(b, 'waiting'));

    expect(result.current.focusTaskId).toBeNull();
    expect(switches()).toMatchObject([
      { fromTaskId: null, toTaskId: a },
      { fromTaskId: a, toTaskId: b },
      { fromTaskId: b, toTaskId: null },
    ]);
  });

  it('keeps Focus exclusive when updateTask sets the state', () => {
    const { result, a, b } = setup();
    act(() => result.current.setFocus(a));
    act(() => result.current.updateTask(b, { state: 'focus', name: 'B2' }));
    expect(result.current.focusTaskId).toBe(b);
    expect(result.current.tasks.find((t) => t.id === b)?.name).toBe('B2');
    expect(result.current.tasks.find((t) => t.id === a)?.state).toBe('open');
  });

  it('drops the old summary when you change the state by hand', () => {
    const { result, a } = setup();
    act(() => result.current.updateTask(a, { state: 'ready', summary: 'Tests pass' }));
    act(() => result.current.setTaskState(a, 'open'));
    expect(result.current.tasks.find((t) => t.id === a)).not.toHaveProperty('summary');
  });
});

describe('Focus exclusivity edge cases', () => {
  it('repairs two Focus tasks left by concurrent tabs when the hook loads', () => {
    getDataStore().tasks.replaceAll([
      { id: 'a', name: 'A', color: '#000', createdAt: '1', state: 'focus' },
      { id: 'b', name: 'B', color: '#000', createdAt: '2', state: 'focus' },
    ]);
    const { result } = renderHook(() => useTasks());
    expect(result.current.focusTaskId).toBe('a');
    expect(result.current.tasks.map((t) => t.state)).toEqual(['focus', 'open']);
  });

  it('keeps Focus exclusive when updateTask upserts a new task with state focus', () => {
    const { result } = renderHook(() => useTasks());
    let a = '';
    act(() => {
      a = result.current.addTask('A', '#000', undefined).id;
    });
    act(() => result.current.setFocus(a));
    act(() => result.current.updateTask('new', { name: 'N', color: '#000', createdAt: '9', state: 'focus' }));

    expect(result.current.focusTaskId).toBe('new');
    expect(result.current.tasks.filter((t) => t.state === 'focus')).toHaveLength(1);
    expect(result.current.tasks.find((t) => t.id === a)?.state).toBe('open');
  });
});
