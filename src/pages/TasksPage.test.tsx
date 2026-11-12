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

  it('lets a done task be reopened with one tap', () => {
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    const row = screen.getByText('Done task').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }));
    expect(getDataStore().tasks.findById('done')?.state).toBe('open');
  });

  it('keeps an done task visible after marking it done while the option is enabled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    const activeRow = screen.getByText('Active task').closest('li')!;
    fireEvent.click(within(activeRow).getByRole('button', { name: 'Done' }));
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

describe('TasksPage states', () => {
  const t = (id: string, state: Task['state']): Task => ({
    id, name: `Task ${id}`, color: '#ff0000', createdAt: id, state,
  });

  function groupTitles() {
    return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.replace(/\d+$/, '').trim());
  }

  it('groups tasks by state, needing-you first, and hides empty groups', () => {
    getDataStore().tasks.replaceAll([t('o', 'open'), t('w', 'waiting'), t('r', 'ready'), t('f', 'focus')]);
    render(<TasksPage />);
    expect(groupTitles()).toEqual(['Focus', 'Ready', 'Waiting', 'Open']);
  });

  it('moves a task to another state with one tap and logs it', () => {
    getDataStore().tasks.replaceAll([t('o', 'open')]);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Waiting' }));
    expect(getDataStore().tasks.findById('o')?.state).toBe('waiting');
    expect(groupTitles()).toEqual(['Waiting']);
  });

  it('keeps exactly one Focus when another task is focused', () => {
    getDataStore().tasks.replaceAll([t('a', 'focus'), t('b', 'open')]);
    render(<TasksPage />);
    const row = screen.getByText('Task b').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Focus' }));

    expect(getDataStore().tasks.findById('b')?.state).toBe('focus');
    expect(getDataStore().tasks.findById('a')?.state).toBe('open');
    expect(screen.getAllByRole('button', { name: 'Focus', pressed: true })).toHaveLength(1);
  });

  it('does not make a new task Focus when one already is', () => {
    getDataStore().tasks.replaceAll([t('a', 'focus')]);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Task' }));
    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'New one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    const created = getDataStore().tasks.findAll().find((x) => x.name === 'New one')!;
    expect(created.state).toBe('open');
    expect(getDataStore().tasks.findById('a')?.state).toBe('focus');
  });

  it('gives a new task Focus when nothing has it', () => {
    getDataStore().tasks.replaceAll([]);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Task' }));
    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(getDataStore().tasks.findAll()[0].state).toBe('focus');
  });
});
