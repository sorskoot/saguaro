import { renderHook, act } from '@testing-library/react';
import { useSessions } from './useSessions';

beforeEach(() => {
  localStorage.clear();
});

describe('useSessions', () => {
  it('sessions is empty initially', () => {
    const { result } = renderHook(() => useSessions());
    expect(result.current.sessions).toEqual([]);
  });

  it('addSession adds a session with correct fields', () => {
    const { result } = renderHook(() => useSessions());

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
    const { result } = renderHook(() => useSessions());

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

  it('cancelSession logs the session as cancelled, not completed', () => {
    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.addSession('work', null);
    });
    const id = result.current.sessions[0].id;

    act(() => {
      result.current.cancelSession(id);
    });

    const s = result.current.sessions[0];
    expect(s.completed).toBe(false);
    expect(s.cancelled).toBe(true);
    expect(typeof s.endTime).toBe('string');
  });

  it('deleteSession removes the session', () => {
    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.addSession('work', null);
    });
    const id = result.current.sessions[0].id;

    act(() => {
      result.current.deleteSession(id);
    });

    expect(result.current.sessions).toHaveLength(0);

    const stored: unknown[] = JSON.parse(localStorage.getItem('saguaro_sessions')!);
    expect(stored).toHaveLength(0);
  });
});
