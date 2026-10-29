import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTime } from '../../utils/time';
import pictureInPictureStyles from './TimerPictureInPicture.css?inline';
import styles from './Timer.module.css';

interface DocumentPictureInPicture {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
}

type PictureInPictureWindow = Window & {
  documentPictureInPicture?: DocumentPictureInPicture;
};

export default function TimerPictureInPicture({ secondsLeft }: { secondsLeft: number }) {
  const api = (window as PictureInPictureWindow).documentPictureInPicture;
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');
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
        if (mounted.current) setPipWindow(null);
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
          <span className="floating-timer-label">Spike</span>
          <div className="floating-timer-time" role="timer" aria-label="Time remaining">
            {formatTime(secondsLeft)}
          </div>
        </main>,
        pipWindow.document.body,
      )}
    </>
  );
}
