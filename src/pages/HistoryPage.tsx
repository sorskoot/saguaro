import { useState, useMemo } from 'react';
import { usePomodoros } from '../hooks/usePomodoros';
import { useTasks } from '../hooks/useTasks';
import { SessionItem, DailySummary } from '../components/History';
import { isSameDay } from '../utils/time';
import type { PomodoroSession } from '../types';
import styles from './HistoryPage.module.css';

type FilterMode = 'all' | 'work' | string;

interface DayGroup {
  dateIso: string;
  sessions: PomodoroSession[];
}

function groupByDay(sessions: PomodoroSession[]): DayGroup[] {
  // Sort descending by startTime so newest day appears first.
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  const groups: DayGroup[] = [];
  for (const session of sorted) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.dateIso, session.startTime)) {
      last.sessions.push(session);
    } else {
      groups.push({ dateIso: session.startTime, sessions: [session] });
    }
  }
  return groups;
}

export default function HistoryPage() {
  const { sessions } = usePomodoros();
  const { tasks } = useTasks();
  const [filter, setFilter] = useState<FilterMode>('all');

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.id, task.name);
    }
    return map;
  }, [tasks]);

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    if (filter === 'work') return sessions.filter((s) => s.type === 'work');
    return sessions.filter((session) => session.taskId === filter);
  }, [sessions, filter]);

  const dayGroups = useMemo(() => groupByDay(filteredSessions), [filteredSessions]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>History</h1>
        <select
          className={styles.filterSelect}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter sessions"
        >
          <option value="all">All sessions</option>
          <option value="work">Work only</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>
      </div>

      {dayGroups.length === 0 && (
        <p className={styles.empty}>No sessions found. Complete a pomodoro to see history.</p>
      )}

      <div className={styles.groups}>
        {dayGroups.map((group) => (
          <section key={group.dateIso} className={styles.daySection}>
            <DailySummary date={group.dateIso} sessions={group.sessions} />
            <ul className={styles.sessionList}>
              {group.sessions.map((session) => (
                <li key={session.id}>
                  <SessionItem
                    session={session}
                    taskName={
                      session.taskId ? (taskNameMap.get(session.taskId) ?? null) : null
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
