import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useTimer } from '../hooks/useTimer';
import type { UseTimerOptions } from '../hooks/useTimer';
import type { Session, SessionType, Task } from '../types';
import TimerPage from './TimerPage';
import { getDataStore } from '../services/db/DataStore';
import { EventLogRepository } from '../services/EventLogRepository';

vi.mock('../hooks/useTimer');

const tasks: Task[] = [
  { id: 'first', name: 'First task', color: '#e74c3c', estimatedSpikes: 3, createdAt: '', state: 'open' },
  { id: 'second', name: 'Second task', color: '#e74c3c', estimatedSpikes: 6, createdAt: '', state: 'open' },
];

let options: UseTimerOptions;

function timerResult(overrides: Partial<ReturnType<typeof useTimer>> = {}): ReturnType<typeof useTimer> {
  return {
    phase: 'idle', mode: 'spike', secondsLeft: 1500, totalSeconds: 1500, overtimeSeconds: 0,
    isRunning: false, spikeCount: 5,
    start: vi.fn(), endSpike: vi.fn(), cancel: vi.fn(), skipBreak: vi.fn(), dismissReentry: vi.fn(),
    ...overrides,
  };
}

function session(id: string, taskId: string | null, type: SessionType = 'spike', completed = true): Session {
  return { id, taskId, type, completed, startTime: '', endTime: completed ? '' : null };
}

function expectDots(total: number, filled: number, scope = 'task') {
  const dots = screen.getByRole('img', { name: `${filled} of ${total} ${scope} Spikes completed` });
  expect(dots.children).toHaveLength(total);
  expect(within(dots).queryAllByText('●')).toHaveLength(filled);
  expect(within(dots).queryAllByText('○')).toHaveLength(total - filled);
}

beforeEach(() => {
  localStorage.clear();
  getDataStore().tasks.replaceAll(tasks);
  localStorage.setItem('saguaro:selectedTaskId', JSON.stringify('first'));
  getDataStore().sessions.replaceAll([
    session('one', 'first'),
    session('break', 'first', 'short-break'),
    session('long-break', 'first', 'long-break'),
    session('unfinished', 'first', 'spike', false),
    session('other', 'second'),
    session('unassigned', null),
  ]);
  vi.mocked(useTimer).mockImplementation((opts) => {
    options = opts;
    return timerResult();
  });
});

describe('TimerPage Spike circles', () => {
  it('uses the task estimate and only its completed work sessions', () => {
    render(<TimerPage />);
    expectDots(3, 1);
  });

  it('updates the circles when changing tasks and clearing selection', () => {
    render(<TimerPage />);
    fireEvent.change(screen.getByLabelText('Task:'), { target: { value: 'second' } });
    expectDots(6, 1);
    fireEvent.change(screen.getByLabelText('Task:'), { target: { value: '' } });
    expectDots(4, 1, 'cycle');
  });

  it('adds extra circles when completed sessions exceed the estimate', () => {
    getDataStore().sessions.replaceAll(
      Array.from({ length: 5 }, (_, i) => session(String(i), 'first')),
    );
    render(<TimerPage />);
    const dots = screen.getByRole('img', { name: '5 of 3 task Spikes completed, 2 over estimate' });
    expect(dots.children).toHaveLength(5);
    expect(within(dots).queryAllByText('●')).toHaveLength(5);
    expect(within(dots).queryAllByText('○')).toHaveLength(0);
    // Only the circles beyond the estimate use the extra style.
    expect(Array.from(dots.children).map((c) => /dotExtra/.test(c.className))).toEqual([
      false, false, false, true, true,
    ]);
  });

  it('shows empty circles when the task has no completed sessions', () => {
    getDataStore().sessions.clear();
    render(<TimerPage />);
    expectDots(3, 0);
  });

  it('fills a circle on work completion and retains progress after remounting', () => {
    const { unmount } = render(<TimerPage />);
    act(() => {
      options.onSpikeStart?.();
      options.onSpikeEnd?.({ endedEarly: false, overtimeSeconds: 0 });
    });
    expectDots(3, 2);
    unmount();
    render(<TimerPage />);
    expectDots(3, 2);
  });

  it('does not fill a circle on break completion', () => {
    render(<TimerPage />);
    act(() => {
      options.onBreakStart?.('short-break');
      options.onBreakEnd?.({ overrunSeconds: 0 });
    });
    expectDots(3, 1);
  });

  it('falls back to the cycle indicator for a deleted selected task', () => {
    localStorage.setItem('saguaro:selectedTaskId', JSON.stringify('deleted'));
    render(<TimerPage />);
    expectDots(4, 1, 'cycle');
  });
});

describe('TimerPage event log', () => {
  beforeEach(() => {
    vi.mocked(useTimer).mockImplementation((opts) => {
      options = opts;
      return timerResult({ phase: 'spike', isRunning: true, secondsLeft: 1000 });
    });
  });

  it('logs an interruption against the running Spike and the selected task', () => {
    render(<TimerPage />);
    act(() => options.onSpikeStart?.());
    fireEvent.click(screen.getByTitle('Note an interruption'));

    const events = new EventLogRepository(getDataStore().events).findAll();
    expect(events).toMatchObject([
      { type: 'spike-start', taskId: 'first' },
      { type: 'interruption', taskId: 'first' },
    ]);
    const [start, interruption] = events;
    expect(interruption).toMatchObject({ sessionId: (start as { sessionId: string }).sessionId });
  });

  it('records the Spike when it starts, then its overtime and interruptions when it ends', () => {
    render(<TimerPage />);
    act(() => options.onSpikeStart?.());
    const [startEvent] = new EventLogRepository(getDataStore().events).findAll();
    const running = getDataStore().sessions.findById((startEvent as { sessionId: string }).sessionId);
    expect(running).toMatchObject({ type: 'spike', taskId: 'first', endTime: null, completed: false });

    fireEvent.click(screen.getByTitle('Note an interruption'));
    act(() => options.onSpikeEnd?.({ endedEarly: false, overtimeSeconds: 900 }));

    const ended = getDataStore().sessions.findAll().find((s) => s.overtimeSeconds === 900);
    expect(ended).toMatchObject({ completed: true, taskId: 'first', interruptions: 1, endedEarly: false });
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'spike-start' },
      { type: 'interruption' },
      { type: 'spike-end', outcome: 'completed', overtimeSeconds: 900 },
    ]);
  });

  it('records a partial Spike as ended early', () => {
    render(<TimerPage />);
    act(() => {
      options.onSpikeStart?.();
      options.onSpikeEnd?.({ endedEarly: true, overtimeSeconds: 0 });
    });
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'spike-start' },
      { type: 'spike-end', outcome: 'ended-early' },
    ]);
  });

  it('logs a cancelled Spike as not completed', () => {
    render(<TimerPage />);
    act(() => {
      options.onSpikeStart?.();
      options.onSpikeCancel?.();
    });
    const cancelled = getDataStore().sessions.findAll().find((s) => s.cancelled);
    expect(cancelled).toMatchObject({ completed: false, type: 'spike' });
  });

  it('records the break and its silent overrun', () => {
    render(<TimerPage />);
    act(() => {
      options.onBreakStart?.('long-break');
      options.onBreakEnd?.({ overrunSeconds: 240 });
    });
    const longBreak = getDataStore().sessions.findAll().filter((s) => s.type === 'long-break' && s.endTime);
    expect(longBreak.find((s) => s.breakOverrunSeconds === 240)).toMatchObject({ completed: true });
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'break-start', breakType: 'long-break' },
      { type: 'break-end', overrunSeconds: 240 },
    ]);
  });
});

describe('TimerPage Spike circles without an estimate', () => {
  it('shows the timer cycle, not the task total, for a task without an estimate', () => {
    const { estimatedSpikes: _estimate, ...unestimated } = tasks[0];
    getDataStore().tasks.replaceAll([unestimated as Task]);
    // The mocked timer reports 5 completed Spikes in its cycle; the task has 1 of its own.
    render(<TimerPage />);
    expectDots(4, 1, 'cycle');
  });
});

describe('TimerPage rest screen', () => {
  it('shows the task picker outside breaks and hides it during one', () => {
    const { unmount } = render(<TimerPage />);
    expect(screen.getByLabelText('Task:')).toBeInTheDocument();
    unmount();

    vi.mocked(useTimer).mockImplementation(() =>
      timerResult({ phase: 'break', mode: 'short-break', isRunning: true, secondsLeft: 200, totalSeconds: 300 }),
    );
    render(<TimerPage />);
    expect(screen.queryByLabelText('Task:')).toBeNull();
    expect(screen.queryByText('First task')).toBeNull();
  });
});

describe('TimerPage Re-entry', () => {
  const reentry = (overrides: Partial<ReturnType<typeof useTimer>> = {}) =>
    timerResult({ phase: 'reentry', mode: 'short-break', secondsLeft: 0, totalSeconds: 300, ...overrides });

  beforeEach(() => {
    getDataStore().parkingLot.replaceAll([
      { id: 'p1', text: 'Reply to Sam', createdAt: '2026-11-12T09:00:00Z', sessionId: null },
      { id: 'p2', text: 'Look up flights', createdAt: '2026-11-12T09:05:00Z', sessionId: null },
    ]);
    getDataStore().tasks.replaceAll([
      { ...tasks[0], nextAction: 'Write the test', whereWasI: 'In the parser' },
      { ...tasks[1], state: 'ready', summary: 'Agent finished the refactor' },
    ]);
  });

  it('replaces the timer with Re-entry once the break is up', () => {
    vi.mocked(useTimer).mockImplementation(() => reentry());
    render(<TimerPage />);
    expect(screen.getByRole('region', { name: 'Re-entry' })).toBeInTheDocument();
    expect(screen.getByText('Agent finished the refactor')).toBeInTheDocument();
    expect(screen.getByText('Write the test')).toBeInTheDocument();
    expect(screen.getByText('In the parser')).toBeInTheDocument();
    expect(screen.getByText('Reply to Sam')).toBeInTheDocument();
  });

  it('starts the next Spike from the Start button', () => {
    const start = vi.fn();
    vi.mocked(useTimer).mockImplementation(() => reentry({ start }));
    render(<TimerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('leaves Re-entry with Not now', () => {
    const dismissReentry = vi.fn();
    vi.mocked(useTimer).mockImplementation(() => reentry({ dismissReentry }));
    render(<TimerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(dismissReentry).toHaveBeenCalledTimes(1);
  });

  it('promotes a parking-lot item to a task and logs it', () => {
    vi.mocked(useTimer).mockImplementation(() => reentry());
    render(<TimerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Make task: Reply to Sam' }));

    expect(screen.queryByText('Reply to Sam')).toBeNull();
    const created = getDataStore().tasks.findAll().find((t) => t.name === 'Reply to Sam');
    expect(created).toMatchObject({ state: 'open' });
    expect(getDataStore().parkingLot.findById('p1')).toMatchObject({
      resolution: 'promoted',
      taskId: created!.id,
    });
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'task-state-change', taskId: created!.id, from: null, to: 'open' },
      { type: 'capture-resolved', itemId: 'p1', resolution: 'promoted', taskId: created!.id },
    ]);
  });

  it('keeps a long thought whole in the task description', () => {
    const long = 'x'.repeat(120);
    getDataStore().parkingLot.replaceAll([{ id: 'p9', text: long, createdAt: '', sessionId: null }]);
    vi.mocked(useTimer).mockImplementation(() => reentry());
    render(<TimerPage />);
    fireEvent.click(screen.getByRole('button', { name: `Make task: ${long}` }));
    expect(getDataStore().tasks.findAll().find((t) => t.description === long)?.name).toHaveLength(80);
  });

  it('dismisses a parking-lot item without creating a task', () => {
    vi.mocked(useTimer).mockImplementation(() => reentry());
    render(<TimerPage />);
    const before = getDataStore().tasks.findAll().length;
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Look up flights' }));

    expect(screen.queryByText('Look up flights')).toBeNull();
    expect(getDataStore().tasks.findAll()).toHaveLength(before);
    expect(getDataStore().parkingLot.findById('p2')).toMatchObject({ resolution: 'dismissed' });
  });
});
