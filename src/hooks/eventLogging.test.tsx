import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useTasks } from './useTasks';
import { useSessions } from './useSessions';
import { useSelectedTask } from './useSelectedTask';
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
  it('logs a switch from the previous task to the new one', () => {
    const { result } = renderHook(() => useSelectedTask());
    act(() => {
      result.current.setSelectedTaskId('a');
    });
    act(() => {
      result.current.setSelectedTaskId('b');
    });
    act(() => {
      result.current.setSelectedTaskId(null);
    });

    expect(events()).toMatchObject([
      { type: 'focus-switch', fromTaskId: null, toTaskId: 'a' },
      { type: 'focus-switch', fromTaskId: 'a', toTaskId: 'b' },
      { type: 'focus-switch', fromTaskId: 'b', toTaskId: null },
    ]);
  });

  it('does not log when the same task is selected again', () => {
    const { result } = renderHook(() => useSelectedTask());
    act(() => {
      result.current.setSelectedTaskId('a');
    });
    act(() => {
      result.current.setSelectedTaskId('a');
    });

    expect(events()).toHaveLength(1);
  });
});
