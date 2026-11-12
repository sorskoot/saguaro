import type { Session } from '../../types';
import styles from './SessionItem.module.css';

interface SessionItemProps {
  session: Session;
  taskName: string | null;
}

function formatTimeRange(isoStart: string, isoEnd: string | null): string {
  const start = new Date(isoStart).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!isoEnd) return start;
  const end = new Date(isoEnd).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

export default function SessionItem({ session, taskName }: SessionItemProps) {
  const isWork = session.type === 'spike';
  const icon = isWork ? '🌵' : '☕';

  return (
    <div className={styles.row}>
      <span className={styles.icon} title={session.type}>
        {icon}
      </span>
      <span className={styles.timeRange}>
        {formatTimeRange(session.startTime, session.endTime)}
      </span>
      <span className={taskName ? styles.taskName : `${styles.taskName} ${styles.noTask}`}>
        {taskName ?? 'No task'}
      </span>
      {!!session.interruptions && (
        <span
          className={styles.interruptions}
          title={`${session.interruptions} interruption${session.interruptions === 1 ? '' : 's'}`}
        >
          ⚡{session.interruptions}
        </span>
      )}
      <span
        className={`${styles.badge} ${
          session.completed ? styles.badgeCompleted : styles.badgeIncomplete
        }`}
      >
        {session.completed ? 'Done' : session.cancelled ? 'Cancelled' : 'Incomplete'}
      </span>
    </div>
  );
}
