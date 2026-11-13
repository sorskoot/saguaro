import { useEffect } from 'react';

/** True for Ctrl+Shift+Space (Windows/Linux) or Cmd+Shift+Space (Mac). */
export function isCaptureShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    (event.code === 'Space' || event.key === ' ')
  );
}

/**
 * Calls `onTrigger` when the capture shortcut is pressed in `target`. Pass the
 * Picture-in-Picture window to listen there too: it is a separate window, so
 * key presses in it never reach the main window.
 */
export function useCaptureShortcut(target: EventTarget | null, onTrigger: () => void): void {
  useEffect(() => {
    if (!target) return;
    const listener = (event: Event) => {
      if (!isCaptureShortcut(event as KeyboardEvent)) return;
      event.preventDefault();
      onTrigger();
    };
    // Capture phase: controls that stop keydown propagation (e.g. a task link) must not block it.
    target.addEventListener('keydown', listener, true);
    return () => target.removeEventListener('keydown', listener, true);
  }, [target, onTrigger]);
}
