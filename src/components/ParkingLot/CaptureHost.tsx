import { useCallback, useEffect, useRef, useState } from 'react';
import { useCaptureShortcut } from '../../hooks/useCaptureShortcut';
import { captureThought } from '../../services/parkingLotCapture';
import CaptureField from './CaptureField';
import styles from './CaptureHost.module.css';

/**
 * Listens for Ctrl/Cmd+Shift+Space anywhere in the app and opens a one-line
 * capture field. Closing it returns focus to where you were, and nothing else
 * on screen changes.
 */
export default function CaptureHost() {
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openField = useCallback(() => {
    setOpen((isOpen) => {
      if (!isOpen) returnFocusRef.current = document.activeElement as HTMLElement | null;
      return true;
    });
  }, []);

  const closeField = useCallback(() => setOpen(false), []);

  useCaptureShortcut(window, openField);

  useEffect(() => {
    if (open) return;
    returnFocusRef.current?.focus?.();
    returnFocusRef.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.host} role="dialog" aria-label="Capture a thought">
      <CaptureField
        onSubmit={captureThought}
        onClose={closeField}
        className={styles.form}
        inputClassName={styles.input}
      />
    </div>
  );
}
