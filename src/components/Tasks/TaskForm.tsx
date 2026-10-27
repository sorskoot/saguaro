import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '../../types';
import styles from './TaskForm.module.css';

interface TaskFormProps {
  initial?: Partial<Task>;
  onSubmit: (name: string, color: string) => void;
  onCancel?: () => void;
}

const DEFAULT_COLOR = '#e74c3c';

export default function TaskForm({ initial, onSubmit, onCancel }: TaskFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="task-name">
          Task name
        </label>
        <input
          id="task-name"
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Deep Work"
          autoFocus
          maxLength={80}
          required
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="task-color">
          Color
        </label>
        <div className={styles.colorRow}>
          <input
            id="task-color"
            className={styles.colorInput}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <span className={styles.colorPreview}>{color}</span>
        </div>
      </div>

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn}>
          {initial?.name ? 'Save' : 'Add Task'}
        </button>
      </div>
    </form>
  );
}
