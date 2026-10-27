import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { usePomodoros } from '../hooks/usePomodoros';
import { useSelectedTask } from '../hooks/useSelectedTask';
import { TaskForm, TaskItem } from '../components/Tasks';
import type { Task } from '../types';
import styles from './TasksPage.module.css';

type FormState =
  | { mode: 'hidden' }
  | { mode: 'add' }
  | { mode: 'edit'; task: Task };

export default function TasksPage() {
  const { tasks, addTask, updateTask, archiveTask, deleteTask } = useTasks();
  const { sessions } = usePomodoros();
  const { selectedTaskId, setSelectedTaskId } = useSelectedTask();
  const [formState, setFormState] = useState<FormState>({ mode: 'hidden' });

  function getSessionCount(taskId: string): number {
    return sessions.filter((session) => session.taskId === taskId && session.completed).length;
  }

  function handleAdd(name: string, color: string, estimatedPomodoros: number) {
    const task = addTask(name, color, estimatedPomodoros);
    setSelectedTaskId(task.id);
    setFormState({ mode: 'hidden' });
  }

  function handleEdit(task: Task, name: string, color: string, estimatedPomodoros: number) {
    updateTask(task.id, { name, color, estimatedPomodoros });
    setFormState({ mode: 'hidden' });
  }

  function handleArchive(task: Task) {
    if (window.confirm(`Archive "${task.name}"? It will be hidden from the task list.`)) {
      archiveTask(task.id);
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
                onSubmit={(name, color, estimatedPomodoros) =>
                  handleEdit(task, name, color, estimatedPomodoros)
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
                onArchive={() => handleArchive(task)}
                onDelete={() => handleDelete(task)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
