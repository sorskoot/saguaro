import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useTimer } from '../hooks/useTimer';
import type { UseTimerOptions } from '../hooks/useTimer';
import type { Session, SessionType, Task } from '../types';
import TimerPage from './TimerPage';

vi.mock('../hooks/useTimer');

const tasks: Task[] = [
  { id: 'first', name: 'First task', color: '#e74c3c', estimatedPomodoros: 3, createdAt: '', archived: false },
  { id: 'second', name: 'Second task', color: '#e74c3c', estimatedPomodoros: 6, createdAt: '', archived: false },
];

let onComplete: UseTimerOptions['onComplete'];

function session(id: string, taskId: string | null, type: SessionType = 'work', completed = true): Session {
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
  localStorage.setItem('saguaro_tasks', JSON.stringify(tasks));
  localStorage.setItem('saguaro:selectedTaskId', JSON.stringify('first'));
  localStorage.setItem('saguaro_sessions', JSON.stringify([
    session('one', 'first'),
    session('break', 'first', 'short-break'),
    session('long-break', 'first', 'long-break'),
    session('unfinished', 'first', 'work', false),
    session('other', 'second'),
    session('unassigned', null),
  ]));
  vi.mocked(useTimer).mockImplementation((options) => {
    onComplete = options.onComplete;
    return {
      secondsLeft: 1500, isRunning: false, mode: 'work', pomodoroCount: 5,
      start: vi.fn(), pause: vi.fn(), cancel: vi.fn(), reset: vi.fn(), skip: vi.fn(), changeMode: vi.fn(),
    };
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
    localStorage.setItem('saguaro_sessions', JSON.stringify(
      Array.from({ length: 5 }, (_, i) => session(String(i), 'first')),
    ));
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
    localStorage.removeItem('saguaro_sessions');
    render(<TimerPage />);
    expectDots(3, 0);
  });

  it('fills a circle on work completion and retains progress after remounting', () => {
    const { unmount } = render(<TimerPage />);
    act(() => onComplete?.('work'));
    expectDots(3, 2);
    unmount();
    render(<TimerPage />);
    expectDots(3, 2);
  });

  it('does not fill a circle on break completion', () => {
    render(<TimerPage />);
    act(() => onComplete?.('short-break'));
    expectDots(3, 1);
  });

  it('falls back to the cycle indicator for a deleted selected task', () => {
    localStorage.setItem('saguaro:selectedTaskId', JSON.stringify('deleted'));
    render(<TimerPage />);
    expectDots(4, 1, 'cycle');
  });
});
