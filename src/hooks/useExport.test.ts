import { renderHook, act } from '@testing-library/react';
import { useExport } from './useExport';
import { DEFAULT_SETTINGS, type AppData } from '../types';
import { DataStore, getDataStore, setDataStore } from '../services/db/DataStore';

// URL.createObjectURL / revokeObjectURL are not implemented in jsdom.
// Define them once at the module level; individual tests can inspect the spies.
beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid AppData payload. */
function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: '2.0',
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    sessions: [],
    events: [],
    parkingLot: [],
    exportedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Creates a File whose text() resolves to the given string. */
function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useExport', () => {
  describe('exportToFile()', () => {
    it('triggers a download by clicking a synthetic anchor element', () => {
      // Spy on document.createElement so we can intercept anchor creation and
      // track whether .click() was called on it.
      const originalCreateElement = document.createElement.bind(document);
      const clickSpy = vi.fn();

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = originalCreateElement('a') as HTMLAnchorElement;
          anchor.click = clickSpy;
          return anchor;
        }
        return originalCreateElement(tag);
      });

      const { result } = renderHook(() => useExport());

      act(() => {
        result.current.exportToFile();
      });

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });

  describe('importFromFile()', () => {
    it('reads valid JSON and writes data to the data store, then calls onSuccess', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const { result } = renderHook(() => useExport({ onSuccess, onError }));

      const data = makeAppData({ settings: { ...DEFAULT_SETTINGS, spikeMinimum: 30 } });
      const file = makeFile(JSON.stringify(data));

      await act(async () => {
        await result.current.importFromFile(file);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();

      expect(getDataStore().settings.get()?.spikeMinimum).toBe(30);
    });

    it('calls onError when the file contains invalid JSON', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const { result } = renderHook(() => useExport({ onSuccess, onError }));

      const file = makeFile('{ this is not valid json }');

      await act(async () => {
        await result.current.importFromFile(file);
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(typeof onError.mock.calls[0][0]).toBe('string');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('calls onError when JSON is valid but missing required fields', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useExport({ onError }));

      // Valid JSON but not a proper AppData shape (missing tasks/sessions/version).
      const file = makeFile(JSON.stringify({ foo: 'bar' }));

      await act(async () => {
        await result.current.importFromFile(file);
      });

      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe('when storage is unavailable', () => {
    it('refuses to import instead of "succeeding" and losing the data on reload', async () => {
      setDataStore(new DataStore(null, { storageUnavailable: true }));
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const { result } = renderHook(() => useExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.importFromFile(makeFile(JSON.stringify(makeAppData())));
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('not letting Saguaro store data'));
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('when saving fails', () => {
    it('reports an error rather than success', async () => {
      vi.spyOn(getDataStore(), 'replaceAll').mockRejectedValue(new Error('quota exceeded'));
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const { result } = renderHook(() => useExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.importFromFile(makeFile(JSON.stringify(makeAppData())));
      });

      expect(onError).toHaveBeenCalledWith('quota exceeded');
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
