import type { Task } from '../../types';
import { toSafeHttpUrl } from '../../utils/url';
import styles from './TaskItem.module.css';

/** Shows the link without its protocol, e.g. "github.com/owner/repo/issues/1". */
function formatLinkLabel(href: string): string {
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

interface TaskItemProps {
  task: Task;
  sessionCount: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDone: () => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  sessionCount,
  selected,
  onSelect,
  onEdit,
  onDone,
  onDelete,
}: TaskItemProps) {
  const link = toSafeHttpUrl(task.link);
  const isDone = task.state === 'done';

  return (
    <div
      className={`${styles.row} ${isDone ? styles.done : selected ? styles.selected : ''}`}
      onClick={isDone ? undefined : onSelect}
      role={isDone ? undefined : 'button'}
      aria-pressed={isDone ? undefined : selected}
      tabIndex={isDone ? undefined : 0}
      onKeyDown={(e) => {
        if (!isDone && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
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
      <div className={styles.info}>
        <span className={styles.name} title={task.name}>
          {task.name}
          {isDone && <span className={styles.doneLabel}> (Done)</span>}
        </span>
        {task.nextAction && (
          <span className={styles.description} title={task.nextAction}>
            Next: {task.nextAction}
          </span>
        )}
        {task.description && (
          <span className={styles.description} title={task.description}>
            {task.description}
          </span>
        )}
        {link && (
          <a
            className={styles.link}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {formatLinkLabel(link)}
          </a>
        )}
      </div>
      {task.estimatedSpikes !== undefined && (
        <span className={styles.estimate}>
          {task.estimatedSpikes} {task.estimatedSpikes === 1 ? 'Spike' : 'Spikes'}
        </span>
      )}
      <span className={styles.sessionCount}>
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
      </span>
      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button className={styles.iconBtn} onClick={onEdit} type="button" title="Edit task">
          ✏️
        </button>
        {!isDone && (
          <button
            className={styles.iconBtn}
            onClick={onDone}
            type="button"
            title="Mark task as done"
          >
            ✅
          </button>
        )}
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
