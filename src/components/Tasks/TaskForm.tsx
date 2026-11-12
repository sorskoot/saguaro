import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Task, TaskDetails } from '../../types';
import styles from './TaskForm.module.css';

interface TaskFormProps {
  initial?: Partial<Task>;
  onSubmit: (
    name: string,
    color: string,
    estimatedSpikes: number | undefined,
    details: TaskDetails,
  ) => void;
  onCancel?: () => void;
}

const DEFAULT_COLOR = '#8c8442';

export default function TaskForm({ initial, onSubmit, onCancel }: TaskFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR);
  const [estimatedSpikes, setEstimatedSpikes] = useState(
    initial?.estimatedSpikes !== undefined ? String(initial.estimatedSpikes) : '',
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [link, setLink] = useState(initial?.link ?? '');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color, estimatedSpikes === '' ? undefined : Number(estimatedSpikes), {
      description: description.trim() || undefined,
      link: link.trim() || undefined,
    });
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
        <label className={styles.label} htmlFor="task-pomodoros">
          Estimated Spikes
        </label>
        <input
          id="task-pomodoros"
          className={styles.input}
          type="number"
          min="1"
          step="1"
          placeholder="Optional"
          value={estimatedSpikes}
          onChange={(e) => setEstimatedSpikes(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="task-description">
          Description (optional)
        </label>
        <textarea
          id="task-description"
          className={`${styles.input} ${styles.textarea}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this task about?"
          rows={3}
          maxLength={500}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="task-link">
          Link (optional)
        </label>
        <input
          id="task-link"
          className={styles.input}
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://github.com/owner/repo/issues/1"
          pattern="https?://.+"
          title="Enter an http:// or https:// URL"
          maxLength={2000}
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
