import type { Task } from '../../types';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  task: Task;
  sessionCount: number;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  sessionCount,
  onEdit,
  onArchive,
  onDelete,
}: TaskItemProps) {
  return (
    <div className={styles.row}>
      <span
        className={styles.dot}
        style={{ backgroundColor: task.color }}
        aria-hidden="true"
      />
      <span className={styles.name} title={task.name}>
        {task.name}
      </span>
      <span className={styles.sessionCount}>
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
      </span>
      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={onEdit} type="button" title="Edit task">
          ✏️
        </button>
        <button
          className={styles.iconBtn}
          onClick={onArchive}
          type="button"
          title="Archive task"
        >
          📦
        </button>
        <button
          className={`${styles.iconBtn} ${styles.deleteBtn}`}
          onClick={onDelete}
          type="button"
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
