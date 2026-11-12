import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import styles from './WhereWasIPrompt.module.css';

interface WhereWasIPromptProps {
  taskName: string;
  /** The note already on the task, so it can be refined rather than rewritten. */
  initial?: string;
  onSave: (note: string) => void;
  onSkip: () => void;
}

/**
 * Offered when you leave a task, so future-you has a thread to pick up.
 * One line, Enter saves, Escape or Skip moves on; nothing is required.
 */
export default function WhereWasIPrompt({ taskName, initial, onSave, onSkip }: WhereWasIPromptProps) {
  const [note, setNote] = useState(initial ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(note.trim());
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onSkip();
  }

  return (
    <form
      className={styles.prompt}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      aria-label="Where was I"
    >
      <label className={styles.label} htmlFor="leave-focus-note">
        Where were you on “{taskName}”?
      </label>
      <input
        id="leave-focus-note"
        className={styles.input}
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="A note for when you come back (optional)"
        maxLength={500}
        autoFocus
      />
      <div className={styles.actions}>
        <button className={styles.skipBtn} type="button" onClick={onSkip}>
          Skip
        </button>
        <button className={styles.saveBtn} type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
