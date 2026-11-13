import { fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from './TasksPage';
import { DEFAULT_SETTINGS } from '../types';
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

  it('disables Focus on a done task so it cannot be focused by mistake', () => {
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done tasks' }));
    const row = screen.getByText('Done task').closest('li')!;
    expect(within(row).getByRole('button', { name: 'Focus' })).toBeDisabled();
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

  it('shows a gentle note above the soft cap and never blocks', () => {
    getDataStore().tasks.replaceAll([
      t('1', 'waiting'), t('2', 'asking'), t('3', 'ready'), t('4', 'open'),
    ]);
    render(<TasksPage />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByText('Task 4').closest('li')!).getByRole('button', { name: 'Waiting' }));
    expect(screen.getByRole('note')).toHaveTextContent('4 tasks are waiting');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getDataStore().tasks.findById('4')?.state).toBe('waiting');
  });
});

describe('TasksPage where-was-I prompt', () => {
  const t = (id: string, state: Task['state'], extra: Partial<Task> = {}): Task => ({
    id, name: `Task ${id}`, color: '#ff0000', createdAt: id, state, ...extra,
  });
  const rowOf = (name: string) => screen.getByText(name).closest('li')!;

  it('asks when you switch Focus to another task and saves the note', () => {
    getDataStore().tasks.replaceAll([t('a', 'focus'), t('b', 'open')]);
    render(<TasksPage />);
    fireEvent.click(within(rowOf('Task b')).getByRole('button', { name: 'Focus' }));

    fireEvent.change(screen.getByLabelText(/Where were you on “Task a”/), {
      target: { value: 'Halfway through the parser' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(getDataStore().tasks.findById('a')).toMatchObject({
      state: 'open',
      whereWasI: 'Halfway through the parser',
    });
    expect(screen.queryByRole('form', { name: 'Where was I' })).not.toBeInTheDocument();
  });

  it('asks when the Focus task is handed off, and Skip changes nothing', () => {
    getDataStore().tasks.replaceAll([t('a', 'focus', { whereWasI: 'Old note' })]);
    render(<TasksPage />);
    fireEvent.click(within(rowOf('Task a')).getByRole('button', { name: 'Waiting' }));
    expect(screen.getByLabelText(/Where were you on “Task a”/)).toHaveValue('Old note');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(getDataStore().tasks.findById('a')).toMatchObject({ state: 'waiting', whereWasI: 'Old note' });
    expect(screen.queryByRole('form', { name: 'Where was I' })).not.toBeInTheDocument();
  });

  it('can be dismissed with Escape', () => {
    getDataStore().tasks.replaceAll([t('a', 'focus')]);
    render(<TasksPage />);
    fireEvent.click(within(rowOf('Task a')).getByRole('button', { name: 'Open' }));
    fireEvent.keyDown(screen.getByLabelText(/Where were you on/), { key: 'Escape' });
    expect(screen.queryByRole('form', { name: 'Where was I' })).not.toBeInTheDocument();
  });

  it('does not ask when finishing the Focus task, or when nothing was in Focus', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getDataStore().tasks.replaceAll([t('a', 'open'), t('b', 'focus')]);
    render(<TasksPage />);
    fireEvent.click(within(rowOf('Task b')).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('form', { name: 'Where was I' })).not.toBeInTheDocument();
    fireEvent.click(within(rowOf('Task a')).getByRole('button', { name: 'Focus' }));
    expect(screen.queryByRole('form', { name: 'Where was I' })).not.toBeInTheDocument();
  });
});

describe('TasksPage summary and code', () => {
  const task: Task = {
    id: 'a', name: 'Fix login', color: '#ff0000', createdAt: '', state: 'ready',
    summary: 'Tests pass, ready for review', code: 'k3',
  };

  it('shows the summary under the task name', () => {
    getDataStore().tasks.replaceAll([task]);
    render(<TasksPage />);
    expect(screen.getByText('Tests pass, ready for review')).toBeInTheDocument();
  });

  it('hides the task code until a bridge is paired', () => {
    getDataStore().tasks.replaceAll([task]);
    render(<TasksPage />);
    expect(screen.queryByText('#k3')).not.toBeInTheDocument();
  });

  it('shows the task code once a bridge is paired', () => {
    getDataStore().tasks.replaceAll([task]);
    getDataStore().settings.setValue({ ...DEFAULT_SETTINGS, bridgePairingCode: 'abc123' });
    render(<TasksPage />);
    expect(screen.getByText('#k3')).toBeInTheDocument();
  });
});

describe('TasksPage parking lot', () => {
  beforeEach(() => {
    getDataStore().parkingLot.replaceAll([
      { id: 'p1', text: 'Reply to Sam', createdAt: '2026-11-12T09:00:00Z', sessionId: null },
      { id: 'p2', text: 'Look up flights', createdAt: '2026-11-12T09:05:00Z', sessionId: null },
      { id: 'p3', text: 'Old one', createdAt: '', sessionId: null, resolution: 'dismissed' },
    ]);
  });

  it('lists only open parked thoughts', () => {
    render(<TasksPage />);
    const list = screen.getByRole('region', { name: /Parking lot/ });
    expect(within(list).getByText('Reply to Sam')).toBeInTheDocument();
    expect(within(list).getByText('Look up flights')).toBeInTheDocument();
    expect(within(list).queryByText('Old one')).toBeNull();
  });

  it('is absent when there is nothing parked', () => {
    getDataStore().parkingLot.replaceAll([]);
    render(<TasksPage />);
    expect(screen.queryByRole('region', { name: /Parking lot/ })).toBeNull();
  });

  it('turns a thought into an Open task and resolves it', () => {
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Make task: Reply to Sam' }));

    const made = getDataStore().tasks.findAll().find((t) => t.name === 'Reply to Sam');
    expect(made).toMatchObject({ state: 'open' });
    expect(getDataStore().parkingLot.findById('p1')).toMatchObject({
      resolution: 'promoted',
      taskId: made?.id,
    });
    expect(screen.queryByRole('button', { name: 'Make task: Reply to Sam' })).toBeNull();
  });

  it('dismisses a thought without creating a task', () => {
    render(<TasksPage />);
    const before = getDataStore().tasks.findAll().length;
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Look up flights' }));

    expect(getDataStore().parkingLot.findById('p2')).toMatchObject({ resolution: 'dismissed' });
    expect(getDataStore().tasks.findAll()).toHaveLength(before);
  });
});
