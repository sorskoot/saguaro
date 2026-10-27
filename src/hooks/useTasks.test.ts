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
      result.current.addTask('My task', '#ff0000');
    });

    expect(result.current.tasks).toHaveLength(1);
    const task = result.current.tasks[0];
    expect(task.name).toBe('My task');
    expect(task.color).toBe('#ff0000');
    expect(task.archived).toBe(false);
    expect(typeof task.id).toBe('string');
    expect(task.id.length).toBeGreaterThan(0);
    expect(typeof task.createdAt).toBe('string');
    expect(task.createdAt.length).toBeGreaterThan(0);
  });

  it('archiveTask removes the task from the returned list but keeps it in storage', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000');
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.archiveTask(id);
    });

    expect(result.current.tasks).toHaveLength(0);
    const stored: Array<{ id: string; archived: boolean }> = JSON.parse(
      localStorage.getItem('pomodoro_tasks')!,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].archived).toBe(true);
  });

  it('deleteTask removes the task from storage entirely', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000');
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.deleteTask(id);
    });

    expect(result.current.tasks).toHaveLength(0);
    const stored: unknown[] = JSON.parse(localStorage.getItem('pomodoro_tasks')!);
    expect(stored).toHaveLength(0);
  });

  it('updateTask updates the name', () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      result.current.addTask('My task', '#ff0000');
    });
    const id = result.current.tasks[0].id;

    act(() => {
      result.current.updateTask(id, { name: 'New name' });
    });

    expect(result.current.tasks[0].name).toBe('New name');
    expect(result.current.tasks[0].color).toBe('#ff0000');
  });
});
