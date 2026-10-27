import type { ChangeEvent } from 'react';
import type { Task } from '../../types';
import styles from './TaskSelector.module.css';

interface TaskSelectorProps {
  tasks: Task[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export default function TaskSelector({ tasks, selectedId, onChange }: TaskSelectorProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    onChange(value === '' ? null : value);
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="task-select">
        Task:
      </label>
      <select
        id="task-select"
        className={styles.select}
        value={selectedId ?? ''}
        onChange={handleChange}
      >
        <option value="">No Task</option>
        {tasks
          .filter((task) => !task.archived)
          .map((task) => (
            <option key={task.id} value={task.id} style={{ color: task.color }}>
              ■ {task.name}
            </option>
          ))}
      </select>
    </div>
  );
}
