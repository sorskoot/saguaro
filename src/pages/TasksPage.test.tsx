import { fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from './TasksPage';
import type { Task } from '../types';
import { getDataStore } from '../services/db/DataStore';

const tasks: Task[] = [
  { id: 'active', name: 'Active task', color: '#ff0000', estimatedSpikes: 2, createdAt: '', state: 'open' },
  { id: 'done', name: 'Done task', color: '#00ff00', estimatedSpikes: 3, createdAt: '', state: 'done' },
];

beforeEach(() => {
  localStorage.clear();
  getDataStore().tasks.replaceAll(tasks);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPage description and link', () => {
  it('shows a task description and a safe external link', () => {
    getDataStore().tasks.replaceAll([
      { ...tasks[0], description: 'Fix the crash', link: 'https://github.com/o/r/issues/7' },
    ]);
    render(<TasksPage />);

    expect(screen.getByText('Fix the crash')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'github.com/o/r/issues/7' });
    expect(link).toHaveAttribute('href', 'https://github.com/o/r/issues/7');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render a link for non-http(s) values', () => {
    getDataStore().tasks.replaceAll([{ ...tasks[0], link: 'javascript:alert(1)' }]);
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

    const saved = getDataStore().tasks.findAll();
    expect(saved[0]).toMatchObject({ description: 'New notes', link: 'https://example.com/1' });
  });
});

describe('TasksPage notes', () => {
  it('saves a next action and where-was-I note and shows the next action', () => {
    render(<TasksPage />);
    fireEvent.click(screen.getByTitle('Edit task'));
    fireEvent.change(screen.getByLabelText('Next action (optional)'), { target: { value: 'Write the test' } });
    fireEvent.change(screen.getByLabelText('Where was I (optional)'), { target: { value: 'Mid-refactor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(getDataStore().tasks.findAll()[0]).toMatchObject({
      nextAction: 'Write the test',
      whereWasI: 'Mid-refactor',
    });
    expect(screen.getByText('Next: Write the test')).toBeInTheDocument();
  });
});

describe('TasksPage done tasks', () => {
  it('hides done tasks by default and toggles them without changing storage', () => {
    render(<TasksPage />);
    const toggle = screen.getByRole('checkbox', { name: 'Show done tasks' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.queryByText('Done task')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.getByText('Done task')).toBeInTheDocument();
    expect(screen.getByText('(Done)')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('Done task')).not.toBeInTheDocument();
    expect(getDataStore().tasks.findAll()).toEqual(tasks);
  });

  it('shows done-only tasks instead of the empty state when enabled', () => {
    getDataStore().tasks.replaceAll([tasks[1]]);
    render(<TasksPage />);
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    expect(screen.queryByText(/No tasks yet/)).not.toBeInTheDocument();
    expect(screen.getByText('Done task')).toBeInTheDocument();
  });

  it('does not allow selecting or marking done again an done task', () => {
    getDataStore().tasks.save({ ...tasks[0], state: 'focus' });
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    const row = screen.getByText('Done task').closest('li')!;
    expect(within(row).queryByTitle('Mark task as done')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Done task'));
    fireEvent.keyDown(screen.getByText('Done task').parentElement!, { key: 'Enter' });
    expect(getDataStore().tasks.findById('done')?.state).toBe('done');
    fireEvent.click(screen.getByRole('button', { name: /Active task/ }));
    expect(screen.getByRole('button', { name: /Active task/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps an done task visible after marking it done while the option is enabled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    fireEvent.click(screen.getByTitle('Mark task as done'));
    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.getAllByText('(Done)')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    expect(screen.queryByText('Active task')).not.toBeInTheDocument();
  });

  it('allows permanently deleting an done task', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    const row = screen.getByText('Done task').closest('li')!;
    fireEvent.click(within(row).getByTitle('Delete task'));
    expect(screen.queryByText('Done task')).not.toBeInTheDocument();
    expect(getDataStore().tasks.findAll()).toEqual([tasks[0]]);
  });
});
