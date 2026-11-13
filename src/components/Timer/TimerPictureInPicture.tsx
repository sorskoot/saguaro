import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatOvertime, formatTime } from '../../utils/time';
import { useCaptureShortcut } from '../../hooks/useCaptureShortcut';
import CaptureField from '../ParkingLot/CaptureField';
import pictureInPictureStyles from './TimerPictureInPicture.css?inline';
import styles from './Timer.module.css';

interface DocumentPictureInPicture {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
}

type PictureInPictureWindow = Window & {
  documentPictureInPicture?: DocumentPictureInPicture;
};

interface TimerPictureInPictureProps {
  secondsLeft: number;
  /** When set, the clock is counting up (Spike overtime) and shows `+m:ss` instead. */
  overtimeSeconds?: number;
  label?: string;
  /** Saves a captured thought. When set, the floating window gets a capture button and shortcut. */
  onCapture?: (text: string) => void;
}

export default function TimerPictureInPicture({
  secondsLeft,
  overtimeSeconds,
  label = 'Spike',
  onCapture,
}: TimerPictureInPictureProps) {
  const api = (window as PictureInPictureWindow).documentPictureInPicture;
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const windowRef = useRef<Window | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      windowRef.current?.close();
      windowRef.current = null;
    };
  }, []);

  // Key presses in the floating window never reach the main window, so listen there too.
  const openCapture = useCallback(() => setCapturing(true), []);
  useCaptureShortcut(onCapture ? pipWindow : null, openCapture);

  async function togglePictureInPicture() {
    if (windowRef.current) {
      windowRef.current.close();
      return;
    }
    if (!api || isOpening) return;

    setIsOpening(true);
    setError('');
    let openedWindow: Window | null = null;
    try {
      openedWindow = await api.requestWindow({ width: 320, height: 180 });
      if (!mounted.current) {
        openedWindow.close();
        return;
      }
      openedWindow.document.title = 'Saguaro timer';
      const stylesheet = openedWindow.document.createElement('style');
      stylesheet.textContent = pictureInPictureStyles;
      openedWindow.document.head.append(stylesheet);
      openedWindow.addEventListener('pagehide', () => {
        windowRef.current = null;
        if (mounted.current) {
          setPipWindow(null);
          setCapturing(false);
        }
      }, { once: true });
      windowRef.current = openedWindow;
      setPipWindow(openedWindow);
    } catch {
      openedWindow?.close();
      if (mounted.current) setError('Could not open the floating timer. Please try again.');
    } finally {
      if (mounted.current) setIsOpening(false);
    }
  }

  if (!api) return null;

  return (
    <>
      <button
        className={styles.pictureInPictureBtn}
        type="button"
        onClick={togglePictureInPicture}
        disabled={isOpening}
        aria-pressed={pipWindow !== null}
      >
        {pipWindow ? 'Close floating timer' : 'Float timer'}
      </button>
      {error && <p role="alert">{error}</p>}
      {pipWindow && createPortal(
        <main className="floating-timer" aria-label="Saguaro timer">
          <span className="floating-timer-label">{label}</span>
          <div
            className="floating-timer-time"
            role="timer"
            aria-label={overtimeSeconds === undefined ? 'Time remaining' : 'Time past the minimum'}
          >
            {overtimeSeconds === undefined ? formatTime(secondsLeft) : formatOvertime(overtimeSeconds)}
          </div>
          {onCapture && (
            capturing ? (
              <CaptureField
                className="floating-timer-capture"
                inputClassName="floating-timer-capture-input"
                onSubmit={onCapture}
                onClose={() => setCapturing(false)}
              />
            ) : (
              <button
                className="floating-timer-capture-btn"
                type="button"
                onClick={openCapture}
                title="Park a thought (Ctrl/Cmd+Shift+Space)"
              >
                + Thought
              </button>
            )
          )}
        </main>,
        pipWindow.document.body,
      )}
    </>
  );
}
