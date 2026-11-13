import { renderHook } from '@testing-library/react';
import { isCaptureShortcut, useCaptureShortcut } from './useCaptureShortcut';

function press(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('isCaptureShortcut', () => {
  it('accepts Ctrl+Shift+Space and Cmd+Shift+Space only', () => {
    expect(isCaptureShortcut(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isCaptureShortcut(new KeyboardEvent('keydown', { code: 'Space', metaKey: true, shiftKey: true }))).toBe(true);
    expect(isCaptureShortcut(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true }))).toBe(false);
    expect(isCaptureShortcut(new KeyboardEvent('keydown', { code: 'Space', shiftKey: true }))).toBe(false);
    expect(isCaptureShortcut(new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

describe('useCaptureShortcut', () => {
  it('fires on the shortcut, prevents the default, and stops after unmount', () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() => useCaptureShortcut(window, onTrigger));
    const event = press(window, { code: 'Space', ctrlKey: true, shiftKey: true });
    expect(onTrigger).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);

    unmount();
    press(window, { code: 'Space', ctrlKey: true, shiftKey: true });
    expect(onTrigger).toHaveBeenCalledOnce();
  });

  it('does nothing without a target', () => {
    const onTrigger = vi.fn();
    renderHook(() => useCaptureShortcut(null, onTrigger));
    press(window, { code: 'Space', ctrlKey: true, shiftKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });
});
