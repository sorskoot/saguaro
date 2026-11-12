import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { getStorageService } from '../../services/StorageService';
import { dayKey } from '../../utils/day';
import { isTimerActive } from '../../services/timerActivity';
import type { Task } from '../../types';
import styles from './MorningPick.module.css';

export const MORNING_PICK_STORAGE_KEY = 'saguaro:morningPickDay';

interface MorningPickViewProps {
  tasks: Task[];
  onPick: (taskId: string) => void;
  onSkip: () => void;
}

/** One decision, no planning ritual: tap the task to start the day on. */
export function MorningPickView({ tasks, onPick, onSkip }: MorningPickViewProps) {
  return (
    <section className={styles.page} aria-label="Morning pick">
      <h2 className={styles.title}>Good morning</h2>
      <p className={styles.lede}>What do you want to start with?</p>

      <ul className={styles.list}>
        {tasks.map((task) => (
          <li key={task.id}>
            <button className={styles.task} type="button" onClick={() => onPick(task.id)}>
              <span className={styles.dot} style={{ backgroundColor: task.color }} aria-hidden="true" />
              <span className={styles.taskText}>
                <span className={styles.taskName}>{task.name}</span>
                {task.whereWasI && <span className={styles.note}>{task.whereWasI}</span>}
                {task.nextAction && <span className={styles.note}>Next: {task.nextAction}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button className={styles.skipBtn} type="button" onClick={onSkip}>
        Skip
      </button>
    </section>
  );
}

/**
 * Shows the Morning pick instead of its children the first time the app opens
 * each day, when there is something to pick from. Picking or skipping counts
 * as today's visit.
 */
export default function MorningPick({ children }: { children: ReactNode }) {
  const { tasks, setFocus } = useTasks();
  const today = dayKey();

  const [pending, setPending] = useState(
    () => getStorageService().get<string>(MORNING_PICK_STORAGE_KEY) !== today,
  );

  // An overnight tab: when it becomes visible on a new day, offer the pick again,
  // unless a Spike or break is running (the gate would unmount its timer).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || isTimerActive()) return;
      if (getStorageService().get<string>(MORNING_PICK_STORAGE_KEY) !== dayKey()) {
        setPending(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const candidates = tasks.filter((task) => task.state === 'open' || task.state === 'focus');

  if (!pending || candidates.length === 0) return <>{children}</>;

  const finish = () => {
    getStorageService().set(MORNING_PICK_STORAGE_KEY, dayKey());
    setPending(false);
  };

  return (
    <MorningPickView
      tasks={candidates}
      onPick={(taskId) => {
        setFocus(taskId);
        finish();
      }}
      onSkip={finish}
    />
  );
}
