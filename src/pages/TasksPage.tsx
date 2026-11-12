import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useSessions } from '../hooks/useSessions';
import { useSelectedTask } from '../hooks/useSelectedTask';
import { TaskForm, TaskItem } from '../components/Tasks';
import type { Task, TaskDetails } from '../types';
import styles from './TasksPage.module.css';

type FormState =
  | { mode: 'hidden' }
  | { mode: 'add' }
  | { mode: 'edit'; task: Task };

export default function TasksPage() {
  const [showDone, setShowDone] = useState(false);
  const { tasks, addTask, updateTask, setTaskState, deleteTask } = useTasks(showDone);
  const { sessions } = useSessions();
  const { selectedTaskId, setSelectedTaskId } = useSelectedTask();
  const [formState, setFormState] = useState<FormState>({ mode: 'hidden' });

  function getSessionCount(taskId: string): number {
    return sessions.filter((session) => session.taskId === taskId && session.completed).length;
  }

  function handleAdd(
    name: string,
    color: string,
    estimatedSpikes: number | undefined,
    details: TaskDetails,
  ) {
    const task = addTask(name, color, estimatedSpikes, details);
    setSelectedTaskId(task.id);
    setFormState({ mode: 'hidden' });
  }

  function handleEdit(
    task: Task,
    name: string,
    color: string,
    estimatedSpikes: number | undefined,
    details: TaskDetails,
  ) {
    updateTask(task.id, {
      name,
      color,
      estimatedSpikes,
      description: details.description,
      link: details.link,
      nextAction: details.nextAction,
      whereWasI: details.whereWasI,
    });
    setFormState({ mode: 'hidden' });
  }

  function handleDone(task: Task) {
    if (window.confirm(`Mark "${task.name}" as done? It will be hidden from the task list.`)) {
      setTaskState(task.id, 'done');
    }
  }

  function handleDelete(task: Task) {
    if (
      window.confirm(
        `Delete "${task.name}"? This cannot be undone. Sessions tied to this task will keep their data but lose the task reference.`,
      )
    ) {
      deleteTask(task.id);
    }
  }

  const isEditing = (id: string) => formState.mode === 'edit' && formState.task.id === id;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        {formState.mode === 'hidden' && (
          <button
            className={styles.addBtn}
            type="button"
            onClick={() => setFormState({ mode: 'add' })}
          >
            + Add Task
          </button>
        )}
      </div>

      <label className={styles.doneToggle}>
        <input
          type="checkbox"
          checked={showDone}
          onChange={(event) => {
            setShowDone(event.target.checked);
            if (!event.target.checked && formState.mode === 'edit' && formState.task.state === 'done') {
              setFormState({ mode: 'hidden' });
            }
          }}
        />
        Show done tasks
      </label>

      {formState.mode === 'add' && (
        <TaskForm
          onSubmit={handleAdd}
          onCancel={() => setFormState({ mode: 'hidden' })}
        />
      )}

      {tasks.length === 0 && formState.mode !== 'add' && (
        <p className={styles.empty}>No tasks yet. Add one to start tracking your work.</p>
      )}

      <ul className={styles.list}>
        {tasks.map((task) => (
          <li key={task.id}>
            {isEditing(task.id) ? (
              <TaskForm
                initial={task}
                onSubmit={(name, color, estimatedSpikes, details) =>
                  handleEdit(task, name, color, estimatedSpikes, details)
                }
                onCancel={() => setFormState({ mode: 'hidden' })}
              />
            ) : (
              <TaskItem
                task={task}
                sessionCount={getSessionCount(task.id)}
                selected={task.id === selectedTaskId}
                onSelect={() => setSelectedTaskId(task.id)}
                onEdit={() => setFormState({ mode: 'edit', task })}
                onDone={() => handleDone(task)}
                onDelete={() => handleDelete(task)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
