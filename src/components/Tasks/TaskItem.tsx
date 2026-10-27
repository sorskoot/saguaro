import type { Task } from '../../types';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  task: Task;
  sessionCount: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  sessionCount,
  selected,
  onSelect,
  onEdit,
  onArchive,
  onDelete,
}: TaskItemProps) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span
        className={styles.dot}
        style={{ backgroundColor: task.color }}
        aria-hidden="true"
      />
      <span className={styles.name} title={task.name}>
        {task.name}
      </span>
      <span className={styles.estimate}>
        {task.estimatedPomodoros} {task.estimatedPomodoros === 1 ? 'Pomodoro' : 'Pomodoros'}
      </span>
      <span className={styles.sessionCount}>
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
      </span>
      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
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
