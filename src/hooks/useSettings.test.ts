import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';
import { DEFAULT_SETTINGS } from '../types';

// storageService wraps localStorage directly; jsdom provides it.
// Clearing localStorage before each test gives every renderHook a clean slate.
beforeEach(() => {
  localStorage.clear();
});

describe('useSettings', () => {
  it('loads DEFAULT_SETTINGS initially', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updateSettings merges partial settings and persists them', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ workDuration: 30 });
    });

    // Merged value is reflected in state.
    expect(result.current.settings.workDuration).toBe(30);
    // All other fields are unchanged.
    expect(result.current.settings.shortBreakDuration).toBe(DEFAULT_SETTINGS.shortBreakDuration);
    expect(result.current.settings.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);

    // Value was persisted to localStorage by the repository.
    const stored = JSON.parse(localStorage.getItem('saguaro_settings')!);
    expect(stored.workDuration).toBe(30);
  });

  it('re-loading the hook reads persisted settings from storage', () => {
    // Pre-populate localStorage as if a previous session had saved settings.
    localStorage.setItem(
      'saguaro_settings',
      JSON.stringify({ ...DEFAULT_SETTINGS, workDuration: 45 }),
    );

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.workDuration).toBe(45);
    // Fields not in the stored object fall back to defaults.
    expect(result.current.settings.shortBreakDuration).toBe(DEFAULT_SETTINGS.shortBreakDuration);
  });
});
