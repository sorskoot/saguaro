import type { Task, TaskState } from '../../types';
import { toSafeHttpUrl } from '../../utils/url';
import styles from './TaskItem.module.css';

/** Shows the link without its protocol, e.g. "github.com/owner/repo/issues/1". */
function formatLinkLabel(href: string): string {
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Display names for the states, in the order the one-tap buttons are shown. */
export const STATE_LABELS: Record<TaskState, string> = {
  focus: 'Focus',
  open: 'Open',
  waiting: 'Waiting',
  asking: 'Asking',
  ready: 'Ready',
  done: 'Done',
};

const STATE_ORDER: readonly TaskState[] = ['focus', 'open', 'waiting', 'asking', 'ready', 'done'];

interface TaskItemProps {
  task: Task;
  sessionCount: number;
  /** Show the task's short code (only once an agent bridge is paired). */
  showCode?: boolean;
  onSetState: (state: TaskState) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  sessionCount,
  showCode = false,
  onSetState,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const link = toSafeHttpUrl(task.link);
  const isDone = task.state === 'done';
  const isFocus = task.state === 'focus';

  return (
    <div className={`${styles.row} ${isDone ? styles.done : isFocus ? styles.selected : ''}`}>
      <span
        className={styles.dot}
        style={{ backgroundColor: task.color }}
        aria-hidden="true"
      />
      <div className={styles.info}>
        <span className={styles.name} title={task.name}>
          {task.name}
          {isDone && <span className={styles.doneLabel}> (Done)</span>}
          {showCode && task.code && <span className={styles.code}> #{task.code}</span>}
        </span>
        {task.summary && (
          <span className={styles.summary} title={task.summary}>
            {task.summary}
          </span>
        )}
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
      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={onEdit} type="button" title="Edit task">
          ✏️
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
      <div className={styles.states} role="group" aria-label={`State of ${task.name}`}>
        {STATE_ORDER.map((state) => (
          <button
            key={state}
            className={`${styles.stateBtn} ${task.state === state ? styles.stateActive : ''}`}
            type="button"
            aria-pressed={task.state === state}
            // A done task has to be reopened before it can take Focus.
            disabled={isDone && state === 'focus'}
            onClick={() => onSetState(state)}
          >
            {STATE_LABELS[state]}
          </button>
        ))}
      </div>
    </div>
  );
}
