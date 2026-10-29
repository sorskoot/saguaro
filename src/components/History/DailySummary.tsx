import type { PomodoroSession } from '../../types';
import { formatDate } from '../../utils/time';
import styles from './DailySummary.module.css';

interface DailySummaryProps {
  date: string;
  sessions: PomodoroSession[];
}

// Default work duration used when per-session duration is unavailable.
const DEFAULT_WORK_MINUTES = 25;

export default function DailySummary({ date, sessions }: DailySummaryProps) {
  const completedWork = sessions.filter((s) => s.type === 'work' && s.completed);
  const totalFocusMinutes = completedWork.length * DEFAULT_WORK_MINUTES;
  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusMinutes = totalFocusMinutes % 60;

  const focusLabel =
    focusHours > 0
      ? `${focusHours}h ${focusMinutes > 0 ? `${focusMinutes}m` : ''}`.trim()
      : `${focusMinutes}m`;

  return (
    <div className={styles.card}>
      <span className={styles.date}>{formatDate(date)}</span>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{completedWork.length}</span>
          <span className={styles.statLabel}>Spikes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{focusLabel}</span>
          <span className={styles.statLabel}>Focus time</span>
        </div>
      </div>
    </div>
  );
}
