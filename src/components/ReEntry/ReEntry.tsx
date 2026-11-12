import TaskSelector from '../TaskSelector';
import type { ParkingLotItem, Task, TaskState } from '../../types';
import styles from './ReEntry.module.css';

interface ReEntryProps {
  /** Tasks that are not done. */
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  parkingItems: ParkingLotItem[];
  onMakeTask: (item: ParkingLotItem) => void;
  onDismissItem: (item: ParkingLotItem) => void;
  /** Starts the next Spike. */
  onStart: () => void;
  /** Leaves Re-entry without starting a Spike. */
  onNotNow: () => void;
}

const STATE_LABELS: Partial<Record<TaskState, string>> = {
  ready: 'Ready',
  asking: 'Asking',
};

/**
 * Shown when a break is up and before the next Spike. Everything on it is
 * optional: Start is pinned at the bottom and always one tap away.
 */
export default function ReEntry({
  tasks,
  selectedTaskId,
  onSelectTask,
  parkingItems,
  onMakeTask,
  onDismissItem,
  onStart,
  onNotNow,
}: ReEntryProps) {
  const happened = tasks.filter((task) => task.state === 'ready' || task.state === 'asking');
  const next = tasks.find((task) => task.id === selectedTaskId);

  return (
    <section className={styles.page} aria-label="Re-entry">
      <h2 className={styles.title}>Welcome back</h2>

      <div className={styles.sections}>
        {happened.length > 0 && (
          <section className={styles.section} aria-labelledby="reentry-happened">
            <h3 id="reentry-happened" className={styles.heading}>
              What happened
            </h3>
            <ul className={styles.list}>
              {happened.map((task) => (
                <li key={task.id} className={styles.row}>
                  <span className={styles.dot} style={{ backgroundColor: task.color }} aria-hidden="true" />
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>
                      {task.name} <span className={styles.badge}>{STATE_LABELS[task.state]}</span>
                    </span>
                    {task.summary && <span className={styles.rowDetail}>{task.summary}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {parkingItems.length > 0 && (
          <section className={styles.section} aria-labelledby="reentry-parking">
            <h3 id="reentry-parking" className={styles.heading}>
              Parking lot
            </h3>
            <ul className={styles.list}>
              {parkingItems.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{item.text}</span>
                  </span>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.smallBtn}
                      type="button"
                      onClick={() => onMakeTask(item)}
                      aria-label={`Make task: ${item.text}`}
                    >
                      Make task
                    </button>
                    <button
                      className={styles.smallBtn}
                      type="button"
                      onClick={() => onDismissItem(item)}
                      aria-label={`Dismiss: ${item.text}`}
                    >
                      Dismiss
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="reentry-next">
          <h3 id="reentry-next" className={styles.heading}>
            Next Spike
          </h3>
          <TaskSelector tasks={tasks} selectedId={selectedTaskId} onChange={onSelectTask} />
          {next?.nextAction && (
            <p className={styles.note}>
              <span className={styles.noteLabel}>Next action</span>
              {next.nextAction}
            </p>
          )}
          {next?.whereWasI && (
            <p className={styles.note}>
              <span className={styles.noteLabel}>Where was I</span>
              {next.whereWasI}
            </p>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <button className={styles.startBtn} type="button" onClick={onStart}>
          Start
        </button>
        <button className={styles.notNowBtn} type="button" onClick={onNotNow}>
          Not now
        </button>
      </div>
    </section>
  );
}
