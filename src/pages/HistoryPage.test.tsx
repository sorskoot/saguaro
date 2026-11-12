import { fireEvent, render, screen } from '@testing-library/react';
import HistoryPage from './HistoryPage';
import { getDataStore } from '../services/db/DataStore';
import type { Session, Task } from '../types';

const task: Task = {
  id: 'task-1',
  name: 'Write docs',
  color: '#ff0000',
  state: 'open',
  createdAt: '2026-11-12T08:00:00.000Z',
};

function session(id: string, type: Session['type']): Session {
  const now = new Date().toISOString();
  return { id, taskId: type === 'spike' ? task.id : null, type, startTime: now, endTime: now, completed: true };
}

describe('HistoryPage filter', () => {
  beforeEach(() => {
    getDataStore().tasks.replaceAll([task]);
    getDataStore().sessions.replaceAll([session('s1', 'spike'), session('b1', 'short-break')]);
  });

  it('"Work only" shows Spikes and hides breaks', () => {
    render(<HistoryPage />);
    const filter = screen.getByLabelText('Filter sessions');
    const items = () => document.querySelectorAll('li').length;

    const allCount = items();
    fireEvent.change(filter, { target: { value: 'spike' } });

    expect((filter as HTMLSelectElement).value).toBe('spike');
    expect(items()).toBeLessThan(allCount);
    expect(items()).toBeGreaterThan(0);
    expect(screen.getByTestId('task-summary')).toBeInTheDocument();
  });
});
