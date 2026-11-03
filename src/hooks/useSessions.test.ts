import { renderHook, act } from '@testing-library/react';
import { usePomodoros } from './usePomodoros';

beforeEach(() => {
  localStorage.clear();
});

describe('usePomodoros', () => {
  it('sessions is empty initially', () => {
    const { result } = renderHook(() => usePomodoros());
    expect(result.current.sessions).toEqual([]);
  });

  it('addSession adds a session with correct fields', () => {
    const { result } = renderHook(() => usePomodoros());

    act(() => {
      result.current.addSession('work', null);
    });

    expect(result.current.sessions).toHaveLength(1);
    const s = result.current.sessions[0];
    expect(s.type).toBe('work');
    expect(s.taskId).toBeNull();
    expect(s.completed).toBe(false);
    expect(s.endTime).toBeNull();
    expect(typeof s.id).toBe('string');
    expect(s.id.length).toBeGreaterThan(0);
    expect(typeof s.startTime).toBe('string');
  });

  it('completeSession marks the session as completed and sets endTime', () => {
    const { result } = renderHook(() => usePomodoros());

    act(() => {
      result.current.addSession('work', null);
    });
    const id = result.current.sessions[0].id;

    act(() => {
      result.current.completeSession(id);
    });

    const s = result.current.sessions[0];
    expect(s.completed).toBe(true);
    expect(typeof s.endTime).toBe('string');
    expect(s.endTime!.length).toBeGreaterThan(0);
  });

  it('deleteSession removes the session', () => {
    const { result } = renderHook(() => usePomodoros());

    act(() => {
      result.current.addSession('work', null);
    });
    const id = result.current.sessions[0].id;

    act(() => {
      result.current.deleteSession(id);
    });

    expect(result.current.sessions).toHaveLength(0);

    const stored: unknown[] = JSON.parse(localStorage.getItem('pomodoro_sessions')!);
    expect(stored).toHaveLength(0);
  });
});
