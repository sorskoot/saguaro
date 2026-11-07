import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskSummary, { computeTaskStats } from './TaskSummary';
import type { Session, Task } from '../../types';

const task: Task = {
  id: 't1',
  name: 'Write report',
  color: '#00ff00',
  estimatedPomodoros: 4,
  createdAt: '2026-11-01T00:00:00.000Z',
  archived: false,
};

function session(over: Partial<Session>): Session {
  return {
    id: Math.random().toString(),
    taskId: 't1',
    type: 'work',
    startTime: '2026-11-07T10:00:00.000Z',
    endTime: '2026-11-07T10:25:00.000Z',
    completed: true,
    ...over,
  };
}

describe('computeTaskStats', () => {
  it('counts completed work, interruptions and cancelled per task', () => {
    const sessions = [
      session({ interruptions: 2 }),
      session({ interruptions: 1 }),
      session({ completed: false, cancelled: true, interruptions: 3 }),
      session({ type: 'short-break' }),
      session({ taskId: 't2', interruptions: 9 }),
    ];
    expect(computeTaskStats('t1', sessions)).toEqual({
      completed: 2,
      interruptions: 6,
      cancelled: 1,
    });
  });
});

describe('TaskSummary', () => {
  it('shows completed vs estimate and interruptions', () => {
    render(<TaskSummary task={task} sessions={[session({ interruptions: 2 }), session({})]} />);
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByText('Interruptions').previousSibling).toHaveTextContent('2');
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
  });
});
