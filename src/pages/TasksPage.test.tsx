import { fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from './TasksPage';
import type { Task } from '../types';

const tasks: Task[] = [
  { id: 'active', name: 'Active task', color: '#ff0000', estimatedPomodoros: 2, createdAt: '', archived: false },
  { id: 'archived', name: 'Archived task', color: '#00ff00', estimatedPomodoros: 3, createdAt: '', archived: true },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('saguaro_tasks', JSON.stringify(tasks));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPage description and link', () => {
  it('shows a task description and a safe external link', () => {
    localStorage.setItem(
      'saguaro_tasks',
      JSON.stringify([
        { ...tasks[0], description: 'Fix the crash', link: 'https://github.com/o/r/issues/7' },
      ]),
    );
    render(<TasksPage />);

    expect(screen.getByText('Fix the crash')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'github.com/o/r/issues/7' });
    expect(link).toHaveAttribute('href', 'https://github.com/o/r/issues/7');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render a link for non-http(s) values', () => {
    localStorage.setItem(
      'saguaro_tasks',
      JSON.stringify([{ ...tasks[0], link: 'javascript:alert(1)' }]),
    );
    render(<TasksPage />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('saves a description and link added while editing', () => {
    render(<TasksPage />);
    fireEvent.click(screen.getByTitle('Edit task'));
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'New notes' },
    });
    fireEvent.change(screen.getByLabelText('Link (optional)'), {
      target: { value: 'https://example.com/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const saved = JSON.parse(localStorage.getItem('saguaro_tasks')!);
    expect(saved[0]).toMatchObject({ description: 'New notes', link: 'https://example.com/1' });
  });
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
    expect(JSON.parse(localStorage.getItem('saguaro_tasks')!)).toEqual(tasks);
  });

  it('shows archived-only tasks instead of the empty state when enabled', () => {
    localStorage.setItem('saguaro_tasks', JSON.stringify([tasks[1]]));
    render(<TasksPage />);
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    expect(screen.queryByText(/No tasks yet/)).not.toBeInTheDocument();
    expect(screen.getByText('Archived task')).toBeInTheDocument();
  });

  it('does not allow selecting or re-archiving an archived task', () => {
    localStorage.setItem('saguaro:selectedTaskId', JSON.stringify('active'));
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived tasks' }));
    const row = screen.getByText('Archived task').closest('li')!;
    expect(within(row).queryByTitle('Archive task')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Archived task'));
    fireEvent.keyDown(screen.getByText('Archived task').parentElement!, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('saguaro:selectedTaskId')!)).toBe('active');
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
    expect(JSON.parse(localStorage.getItem('saguaro_tasks')!)).toEqual([tasks[0]]);
  });
});
