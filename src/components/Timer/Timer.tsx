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
  onStart: () => void;
  onPause: () => void;
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
  onStart,
  onPause,
  onReset,
  onSkip,
}: TimerProps) {
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dotsCount = estimatedPomodoros ?? DOTS_COUNT;
  const filledDots = estimatedPomodoros === undefined
    ? pomodoroCount % DOTS_COUNT
    : Math.min(pomodoroCount, dotsCount);

  return (
    <div className={styles.container} data-timer>
      <div className={styles.modeLabel}>{MODE_LABELS[mode]}</div>

      <div className={styles.ringWrapper}>
        <ProgressRing progress={progress} />
        <div className={styles.timeDisplay}>{formatTime(secondsLeft)}</div>
      </div>

      <div className={styles.controls}>
        <button className={styles.secondaryBtn} onClick={onReset} type="button" title="Reset">
          ⟳
        </button>
        <button
          className={styles.primaryBtn}
          onClick={isRunning ? onPause : onStart}
          type="button"
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button className={styles.secondaryBtn} onClick={onSkip} type="button" title="Skip">
          ⏭
        </button>
      </div>

      <div
        className={styles.dots}
        role="img"
        aria-label={`${filledDots} of ${dotsCount} ${estimatedPomodoros === undefined ? 'cycle' : 'task'} Spikes completed`}
      >
        {Array.from({ length: dotsCount }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`${styles.dot} ${i < filledDots ? styles.dotFilled : styles.dotEmpty}`}
          >
            {i < filledDots ? '●' : '○'}
          </span>
        ))}
      </div>
    </div>
  );
}
