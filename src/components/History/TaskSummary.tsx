import type { Session, Task } from '../../types';
import styles from './TaskSummary.module.css';

interface TaskSummaryProps {
  task: Task;
  sessions: Session[];
}

export interface TaskStats {
  completed: number;
  interruptions: number;
  cancelled: number;
}

/** Totals for a task's own work sessions. Cancelled sessions never count as completed. */
export function computeTaskStats(taskId: string, sessions: Session[]): TaskStats {
  const stats: TaskStats = { completed: 0, interruptions: 0, cancelled: 0 };
  for (const s of sessions) {
    if (s.taskId !== taskId || s.type !== 'spike') continue;
    if (s.completed && !s.cancelled) stats.completed += 1;
    if (s.cancelled) stats.cancelled += 1;
    stats.interruptions += s.interruptions ?? 0;
  }
  return stats;
}

export default function TaskSummary({ task, sessions }: TaskSummaryProps) {
  const { completed, interruptions, cancelled } = computeTaskStats(task.id, sessions);
  const estimate = task.estimatedSpikes;

  return (
    <div className={styles.card} data-testid="task-summary">
      <span className={styles.name}>
        <span className={styles.dot} style={{ backgroundColor: task.color }} aria-hidden="true" />
        {task.name}
      </span>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {completed}
            {estimate !== undefined && estimate > 0 ? `/${estimate}` : ''}
          </span>
          <span className={styles.statLabel}>Spikes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{interruptions}</span>
          <span className={styles.statLabel}>Interruptions</span>
        </div>
        {cancelled > 0 && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{cancelled}</span>
            <span className={styles.statLabel}>Cancelled</span>
          </div>
        )}
      </div>
    </div>
  );
}
