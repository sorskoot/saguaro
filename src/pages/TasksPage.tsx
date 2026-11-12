import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useSessions } from '../hooks/useSessions';
import { useSettings } from '../hooks/useSettings';
import { TaskForm, TaskItem, WhereWasIPrompt } from '../components/Tasks';
import { STATE_LABELS } from '../components/Tasks/TaskItem';
import { countInPlay, exceedsSoftCap } from '../utils/softCap';
import type { Task, TaskDetails, TaskState } from '../types';
import styles from './TasksPage.module.css';

type FormState =
  | { mode: 'hidden' }
  | { mode: 'add' }
  | { mode: 'edit'; task: Task };

/** Needs you first, then what is in play, then the rest. */
const GROUP_ORDER: readonly TaskState[] = ['focus', 'asking', 'ready', 'waiting', 'open', 'done'];

export default function TasksPage() {
  const [showDone, setShowDone] = useState(false);
  const { tasks, focusTaskId, setFocus, addTask, updateTask, setTaskState, deleteTask } =
    useTasks(showDone);
  const { sessions } = useSessions();
  const { settings } = useSettings();
  const [formState, setFormState] = useState<FormState>({ mode: 'hidden' });
  // The task you just left Focus on, while the where-was-I prompt is open.
  const [leftFocusId, setLeftFocusId] = useState<string | null>(null);

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
    // A new task takes Focus only when nothing has it, so adding never pulls you off your work.
    if (focusTaskId === null) setFocus(task.id);
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

  function handleSetState(task: Task, state: TaskState) {
    if (state === task.state) return;
    if (
      state === 'done' &&
      !window.confirm(`Mark "${task.name}" as done? It will be hidden from the task list.`)
    ) {
      return;
    }
    // Leaving Focus (to another task, or to any state but Done) offers a where-was-I note.
    if (task.state === 'focus' && state !== 'done') setLeftFocusId(task.id);
    else if (state === 'focus' && focusTaskId !== null) setLeftFocusId(focusTaskId);
    setTaskState(task.id, state);
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

  const leftFocus = tasks.find((task) => task.id === leftFocusId);
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

      {exceedsSoftCap(tasks) && (
        <p className={styles.softCap} role="note">
          {countInPlay(tasks)} tasks are waiting on something or someone. That is a lot to hold in
          mind: maybe check in on one, or let one go.
        </p>
      )}

      {leftFocus && (
        <WhereWasIPrompt
          key={leftFocus.id}
          taskName={leftFocus.name}
          initial={leftFocus.whereWasI}
          onSave={(note) => {
            updateTask(leftFocus.id, { whereWasI: note || undefined });
            setLeftFocusId(null);
          }}
          onSkip={() => setLeftFocusId(null)}
        />
      )}

      {formState.mode === 'add' && (
        <TaskForm
          onSubmit={handleAdd}
          onCancel={() => setFormState({ mode: 'hidden' })}
        />
      )}

      {tasks.length === 0 && formState.mode !== 'add' && (
        <p className={styles.empty}>No tasks yet. Add one to start tracking your work.</p>
      )}

      {GROUP_ORDER.map((state) => {
        const group = tasks.filter((task) => task.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state} className={styles.group} aria-labelledby={`group-${state}`}>
            <h2 id={`group-${state}`} className={styles.groupTitle}>
              {STATE_LABELS[state]} <span className={styles.groupCount}>{group.length}</span>
            </h2>
            <ul className={styles.list}>
              {group.map((task) => (
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
                      showCode={settings.bridgePairingCode !== null}
                      onSetState={(next) => handleSetState(task, next)}
                      onEdit={() => setFormState({ mode: 'edit', task })}
                      onDelete={() => handleDelete(task)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
