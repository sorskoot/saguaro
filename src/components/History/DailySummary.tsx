import type { Session } from '../../types';
import { formatDate } from '../../utils/time';
import styles from './DailySummary.module.css';

interface DailySummaryProps {
  date: string;
  sessions: Session[];
}

// Default work duration used when per-session duration is unavailable.
const DEFAULT_WORK_MINUTES = 25;

/** Recorded start-to-end time; older records without one count as a default Spike. */
function focusMinutesOf(session: Session): number {
  if (session.endTime) {
    const ms = Date.parse(session.endTime) - Date.parse(session.startTime);
    if (Number.isFinite(ms) && ms >= 0 && session.endedEarly !== undefined) return ms / 60000;
  }
  return DEFAULT_WORK_MINUTES;
}

export default function DailySummary({ date, sessions }: DailySummaryProps) {
  const completedWork = sessions.filter((s) => s.type === 'spike' && s.completed);
  const totalFocusMinutes = Math.round(
    completedWork.reduce((sum, s) => sum + focusMinutesOf(s), 0),
  );
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
