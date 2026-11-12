import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';
import { DEFAULT_SETTINGS } from '../types';
import { getDataStore } from '../services/db/DataStore';

describe('useSettings', () => {
  it('loads DEFAULT_SETTINGS initially', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updateSettings merges partial settings and persists them', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ spikeMinimum: 30 });
    });

    // Merged value is reflected in state.
    expect(result.current.settings.spikeMinimum).toBe(30);
    // All other fields are unchanged.
    expect(result.current.settings.shortBreakDuration).toBe(DEFAULT_SETTINGS.shortBreakDuration);
    expect(result.current.settings.breakEndChime).toBe(DEFAULT_SETTINGS.breakEndChime);

    // Value was handed to the data store by the repository.
    expect(getDataStore().settings.get()?.spikeMinimum).toBe(30);
  });

  it('re-loading the hook reads persisted settings from storage', () => {
    // Pre-populate the store as if a previous session had saved settings.
    getDataStore().settings.set({ ...DEFAULT_SETTINGS, spikeMinimum: 45 });

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.spikeMinimum).toBe(45);
    // Fields not in the stored object fall back to defaults.
    expect(result.current.settings.shortBreakDuration).toBe(DEFAULT_SETTINGS.shortBreakDuration);
  });
});
