import { PWA_BASE_PATH, registerServiceWorker } from './pwa';

// ---------------------------------------------------------------------------
// PWA_BASE_PATH trailing-slash normalisation
//
// PWA_BASE_PATH is computed at module-load time from import.meta.env.BASE_URL,
// so verifying a different BASE_URL value requires resetting the module
// registry and re-importing the module after stubbing the env variable.
// ---------------------------------------------------------------------------
describe('PWA_BASE_PATH trailing-slash normalisation', () => {
  afterEach(() => {
    // Restore stubbed env vars and clear the module registry so the main
    // top-level import is not affected by the stub in subsequent tests.
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('adds a trailing slash when BASE_URL has none', async () => {
    vi.stubEnv('BASE_URL', '/saguaro');
    // Reset module registry so the re-import below re-evaluates the constant
    // with the stubbed BASE_URL value.
    vi.resetModules();
    const { PWA_BASE_PATH: freshBasePath } = await import('./pwa');
    expect(freshBasePath).toBe('/saguaro/');
  });
});

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------
describe('registerServiceWorker', () => {
  const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker',
  );

  // Capture every 'load' handler added to window during a test so they can be
  // removed in afterEach. Without this, each registerServiceWorker() call
  // appends a new listener; when subsequent tests dispatch 'load', stale
  // handlers from earlier tests fire against the wrong mocks.
  const registeredLoadHandlers: EventListener[] = [];
  // Bind to the native implementation once, before any spy wraps it.
  const nativeAddEventListener = window.addEventListener.bind(window);

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) => {
        if (type === 'load' && listener) {
          registeredLoadHandlers.push(listener as EventListener);
        }
        nativeAddEventListener(
          type,
          listener as EventListener,
          options as boolean | AddEventListenerOptions,
        );
      },
    );
  });

  afterEach(() => {
    // Remove all 'load' listeners registered during this test.
    registeredLoadHandlers.forEach(h => window.removeEventListener('load', h));
    registeredLoadHandlers.length = 0;

    if (originalServiceWorkerDescriptor) {
      Object.defineProperty(
        navigator,
        'serviceWorker',
        originalServiceWorkerDescriptor,
      );
    } else {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
    vi.restoreAllMocks();
  });

  it('registers the service worker on window load', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledWith(`${PWA_BASE_PATH}sw.js`, {
      scope: PWA_BASE_PATH,
    });
  });

  it('does nothing when service workers are not supported', () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    // This spy wraps the beforeEach tracking spy. Neither should be called
    // because registerServiceWorker() returns early when serviceWorker is absent.
    const addEventListener = vi.spyOn(window, 'addEventListener');

    registerServiceWorker();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('logs a registration error when registration fails', async () => {
    const error = new Error('registration failed');
    const register = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Service worker registration failed:',
        error,
      );
    });
  });
});
