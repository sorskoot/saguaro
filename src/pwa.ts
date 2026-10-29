// Derive base path from Vite's import.meta.env.BASE_URL, which is statically
// replaced at build time. Normalize to always end with a trailing slash so
// service worker registration is correct in both dev ('/') and production
// ('/saguaro/').
const rawBase: string = import.meta.env.BASE_URL;
export const PWA_BASE_PATH: string = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${PWA_BASE_PATH}sw.js`, {
        scope: PWA_BASE_PATH,
      })
      .catch((error: unknown) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
