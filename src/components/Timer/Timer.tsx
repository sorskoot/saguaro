import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';
import { formatTime } from '../../utils/time';
import type { SessionType } from '../../types';
import styles from './Timer.module.css';

interface TimerProps {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  mode: SessionType;
  pomodoroCount: number;
  estimatedPomodoros?: number;
  interruptions?: number;
  onInterrupt?: () => void;
  onStart: () => void;
  onPause: () => void;
  /** When provided, a running Spike shows "Cancel" instead of "Pause"; after confirmation the Spike is logged as cancelled (not counted). */
  onCancel?: () => void;
  onReset: () => void;
  onSkip: () => void;
}

const MODE_LABELS: Record<SessionType, string> = {
  work: 'Spike',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
};

const DOTS_COUNT = 4;

export default function Timer({
  secondsLeft,
  totalSeconds,
  isRunning,
  mode,
  pomodoroCount,
  estimatedPomodoros,
  interruptions = 0,
  onInterrupt,
  onStart,
  onPause,
  onCancel,
  onReset,
  onSkip,
}: TimerProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const canCancel = !!onCancel && mode === 'work';
  const showConfirm = confirmingCancel && isRunning && canCancel;

  // Drop a stale confirmation if the session stops or changes underneath it.
  useEffect(() => {
    if (!isRunning || !canCancel) setConfirmingCancel(false);
  }, [isRunning, canCancel]);

  const handlePrimary = () => {
    if (!isRunning) onStart();
    else if (canCancel) setConfirmingCancel(true);
    else onPause();
  };

  const handleConfirmCancel = () => {
    setConfirmingCancel(false);
    onCancel?.();
  };

  const primaryLabel = !isRunning ? 'Start' : canCancel ? 'Cancel' : 'Pause';

  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const plannedDots = estimatedPomodoros ?? DOTS_COUNT;
  const isTaskScoped = estimatedPomodoros !== undefined;
  // Sessions beyond the estimate get extra dots in a different colour.
  const extraDots = isTaskScoped ? Math.max(0, pomodoroCount - plannedDots) : 0;
  const dotsCount = plannedDots + extraDots;
  const filledDots = isTaskScoped ? Math.min(pomodoroCount, dotsCount) : pomodoroCount % DOTS_COUNT;

  return (
    <div className={styles.container} data-timer>
      <div className={styles.modeLabel}>{MODE_LABELS[mode]}</div>

      <div className={styles.ringWrapper}>
        <ProgressRing progress={progress} />
        <div className={styles.timeDisplay}>{formatTime(secondsLeft)}</div>
      </div>

      {showConfirm ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Cancel Spike?">
          <p className={styles.confirmText}>Cancel this Spike? It won't count.</p>
          <div className={styles.controls}>
            <button className={styles.confirmKeepBtn} onClick={() => setConfirmingCancel(false)} type="button">
              Keep going
            </button>
            <button className={styles.primaryBtn} onClick={handleConfirmCancel} type="button">
              Cancel Spike
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.controls}>
          <button className={styles.secondaryBtn} onClick={onReset} type="button" title="Reset">
            ⟳
          </button>
          <button className={styles.primaryBtn} onClick={handlePrimary} type="button">
            {primaryLabel}
          </button>
          <button className={styles.secondaryBtn} onClick={onSkip} type="button" title="Skip">
            ⏭
          </button>
        </div>
      )}

      {onInterrupt && (
        // Always rendered so switching modes doesn't change the vertical layout;
        // hidden (but still taking space) outside of Spike mode.
        <button
          className={`${styles.interruptBtn} ${mode === 'work' ? '' : styles.interruptBtnHidden}`}
          onClick={onInterrupt}
          disabled={!isRunning || mode !== 'work'}
          aria-hidden={mode !== 'work'}
          tabIndex={mode === 'work' ? 0 : -1}
          type="button"
          title="Note an interruption"
        >
          ⚡ Interruption{interruptions > 0 ? ` (${interruptions})` : ''}
        </button>
      )}

      <div
        className={styles.dots}
        role="img"
        aria-label={`${filledDots} of ${plannedDots} ${isTaskScoped ? 'task' : 'cycle'} Spikes completed${extraDots > 0 ? `, ${extraDots} over estimate` : ''}`}
      >
        {Array.from({ length: dotsCount }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`${styles.dot} ${
              i >= plannedDots ? styles.dotExtra : i < filledDots ? styles.dotFilled : styles.dotEmpty
            }`}
          >
            {i < filledDots ? '●' : '○'}
          </span>
        ))}
      </div>
    </div>
  );
}
