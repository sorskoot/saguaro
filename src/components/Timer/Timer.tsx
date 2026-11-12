import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';
import { formatOvertime, formatTime } from '../../utils/time';
import type { TimerPhase } from '../../hooks/useTimer';
import type { SessionType } from '../../types';
import styles from './Timer.module.css';

interface TimerProps {
  phase: TimerPhase;
  mode: SessionType;
  secondsLeft: number;
  totalSeconds: number;
  /** Seconds past the Spike minimum or past the end of the break. */
  overtimeSeconds: number;
  /** Spikes finished in the current 4-Spike cycle, or for the selected task. */
  spikeCount: number;
  estimatedSpikes?: number;
  interruptions?: number;
  onInterrupt?: () => void;
  onStart: () => void;
  /** Ends the running Spike: partial before the minimum, complete after. */
  onEndSpike: () => void;
  /** After confirmation the Spike is logged as cancelled (not counted). */
  onCancel?: () => void;
  onSkipBreak: () => void;
}

const MODE_LABELS: Record<SessionType, string> = {
  spike: 'Spike',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
};

const DOTS_COUNT = 4;

export default function Timer({
  phase,
  mode,
  secondsLeft,
  totalSeconds,
  overtimeSeconds,
  spikeCount,
  estimatedSpikes,
  interruptions = 0,
  onInterrupt,
  onStart,
  onEndSpike,
  onCancel,
  onSkipBreak,
}: TimerProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const spikeRunning = phase === 'spike';
  const canCancel = !!onCancel && spikeRunning;
  const showConfirm = confirmingCancel && canCancel;
  // At the minimum the ring is full and the clock counts up.
  const minimumReached = spikeRunning && secondsLeft === 0;
  const inOvertime = minimumReached || phase === 'reentry';

  // Drop a stale confirmation if the Spike stops underneath it.
  useEffect(() => {
    if (!canCancel) setConfirmingCancel(false);
  }, [canCancel]);

  const handleConfirmCancel = () => {
    setConfirmingCancel(false);
    onCancel?.();
  };

  let primaryLabel = 'Start';
  let onPrimary = onStart;
  if (spikeRunning) {
    primaryLabel = minimumReached ? 'Take a break' : 'End early';
    onPrimary = onEndSpike;
  } else if (phase === 'break') {
    primaryLabel = 'Skip break';
    onPrimary = onSkipBreak;
  }

  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const plannedDots = estimatedSpikes ?? DOTS_COUNT;
  const isTaskScoped = estimatedSpikes !== undefined;
  // Spikes beyond the estimate get extra dots in a different colour.
  const extraDots = isTaskScoped ? Math.max(0, spikeCount - plannedDots) : 0;
  const dotsCount = plannedDots + extraDots;
  const filledDots = isTaskScoped ? Math.min(spikeCount, dotsCount) : spikeCount % DOTS_COUNT;

  return (
    <div className={styles.container} data-timer>
      <div className={styles.modeLabel}>
        {phase === 'reentry' ? 'Break is up' : MODE_LABELS[mode]}
      </div>

      <div className={styles.ringWrapper}>
        <ProgressRing progress={inOvertime ? 1 : progress} />
        <div className={styles.timeDisplay}>
          {inOvertime ? formatOvertime(overtimeSeconds) : formatTime(secondsLeft)}
        </div>
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
          <button className={styles.primaryBtn} onClick={onPrimary} type="button">
            {primaryLabel}
          </button>
          {canCancel && (
            <button className={styles.cancelBtn} onClick={() => setConfirmingCancel(true)} type="button">
              Cancel
            </button>
          )}
        </div>
      )}

      {onInterrupt && (
        // Always rendered so switching modes doesn't change the vertical layout;
        // hidden (but still taking space) outside of a running Spike.
        <button
          className={`${styles.interruptBtn} ${mode === 'spike' ? '' : styles.interruptBtnHidden}`}
          onClick={onInterrupt}
          disabled={!spikeRunning}
          aria-hidden={mode !== 'spike'}
          tabIndex={mode === 'spike' ? 0 : -1}
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
