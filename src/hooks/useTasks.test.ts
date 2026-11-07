import { renderHook, act } from '@testing-library/react';
import { useTasks } from './useTasks';

beforeEach(() => {
  localStorage.clear();
});

describe('useTasks', () => {
  it('tasks is empty initially', () => {
    const { result } = renderHook(() => useTasks());
    expect(result.current.tasks).toEqual([]);
  });

  it('addTask adds a task with correct fields', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000', 3);
    });

    expect(result.current.tasks).toHaveLength(1);
    const task = result.current.tasks[0];
    expect(task.name).toBe('My task');
    expect(task.color).toBe('#ff0000');
    expect(task.estimatedPomodoros).toBe(3);
    expect(task.archived).toBe(false);
    expect(typeof task.id).toBe('string');
    expect(task.id.length).toBeGreaterThan(0);
    expect(typeof task.createdAt).toBe('string');
    expect(task.createdAt.length).toBeGreaterThan(0);
  });

  it('addTask stores an optional description and link', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('With details', '#ff0000', 1, {
        description: 'Some notes',
        link: 'https://example.com/issue/1',
      });
      result.current.addTask('Without details', '#ff0000', 1, {});
    });

    const [withDetails, withoutDetails] = result.current.tasks;
    expect(withDetails.description).toBe('Some notes');
    expect(withDetails.link).toBe('https://example.com/issue/1');
    expect(withoutDetails).not.toHaveProperty('description');
    expect(withoutDetails).not.toHaveProperty('link');
  });

  it('archiveTask removes the task from the returned list but keeps it in storage', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000', 1);
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.archiveTask(id);
    });

    expect(result.current.tasks).toHaveLength(0);
    const stored: Array<{ id: string; archived: boolean }> = JSON.parse(
      localStorage.getItem('saguaro_tasks')!,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].archived).toBe(true);
  });

  it('includes archived tasks on request and filters them again when disabled', () => {
    const { result, rerender } = renderHook(
      ({ includeArchived }) => useTasks(includeArchived),
      { initialProps: { includeArchived: false } },
    );
    act(() => {
      result.current.addTask('My task', '#ff0000', 1);
    });
    const id = result.current.tasks[0].id;
    act(() => {
      result.current.archiveTask(id);
    });
    expect(result.current.tasks).toHaveLength(0);
    rerender({ includeArchived: true });
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].archived).toBe(true);
    rerender({ includeArchived: false });
    expect(result.current.tasks).toHaveLength(0);
  });

  it('deleteTask removes the task from storage entirely', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000', 1);
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.deleteTask(id);
    });

    expect(result.current.tasks).toHaveLength(0);
    const stored: unknown[] = JSON.parse(localStorage.getItem('saguaro_tasks')!);
    expect(stored).toHaveLength(0);
  });

  it('updateTask updates the name', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000', 1);
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.updateTask(id, { name: 'New name' });
    });

    expect(result.current.tasks[0].name).toBe('New name');
    expect(result.current.tasks[0].color).toBe('#ff0000');

    act(() => {
      result.current.updateTask(id, { estimatedPomodoros: 5 });
    });

    expect(result.current.tasks[0].estimatedPomodoros).toBe(5);
  });
});
