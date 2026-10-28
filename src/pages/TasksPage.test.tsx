import { fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from './TasksPage';
import type { Task } from '../types';

const tasks: Task[] = [
  { id: 'active', name: 'Active task', color: '#ff0000', estimatedPomodoros: 2, createdAt: '', archived: false },
  { id: 'archived', name: 'Archived task', color: '#00ff00', estimatedPomodoros: 3, createdAt: '', archived: true },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPage archived tasks', () => {
  it('hides archived tasks by default and toggles them without changing storage', () => {
    render(<TasksPage />);
    const toggle = screen.getByRole('checkbox', { name: 'Show archived tasks' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.getByText('Archived task')).toBeInTheDocument();
    expect(screen.getByText('(Archived)')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pomodoro_tasks')!)).toEqual(tasks);
  });

  it('shows archived-only tasks instead of the empty state when enabled', () => {
    localStorage.setItem('pomodoro_tasks', JSON.stringify([tasks[1]]));
    render(<TasksPage />);
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    expect(screen.queryByText(/No tasks yet/)).not.toBeInTheDocument();
    expect(screen.getByText('Archived task')).toBeInTheDocument();
  });

  it('does not allow selecting or re-archiving an archived task', () => {
    localStorage.setItem('pomodoro:selectedTaskId', JSON.stringify('active'));
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    const row = screen.getByText('Archived task').closest('li')!;
    expect(within(row).queryByTitle('Archive task')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Archived task'));
    fireEvent.keyDown(screen.getByText('Archived task').parentElement!, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('pomodoro:selectedTaskId')!)).toBe('active');
    fireEvent.click(screen.getByRole('button', { name: /Active task/ }));
    expect(screen.getByRole('button', { name: /Active task/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps an archived task visible after archiving while the option is enabled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    fireEvent.click(screen.getByTitle('Archive task'));
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.getAllByText('(Archived)')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    expect(screen.queryByText('Active task')).not.toBeInTheDocument();
  });

  it('allows permanently deleting an archived task', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    const row = screen.getByText('Archived task').closest('li')!;
    fireEvent.click(within(row).getByTitle('Delete task'));
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pomodoro_tasks')!)).toEqual([tasks[0]]);
  });
});
