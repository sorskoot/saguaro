import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useExport } from '../hooks/useExport';
import { DurationField, ToggleField } from '../components/Settings';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { exportToFile, importFromFile } = useExport({
    onSuccess: () => alert('Import successful! The page will reload to apply changes.'),
    onError: (msg) => alert(`Import failed: ${msg}`),
  });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await importFromFile(file);
    // Reset the input so the same file can be re-imported if needed.
    e.target.value = '';
  }

  function handleClearAll() {
    if (
      window.confirm(
        'Clear ALL data? This will permanently delete all sessions and tasks. This cannot be undone.',
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      {/* ── Timer durations ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Timer durations</h2>
        <div className={styles.fields}>
          <DurationField
            label="Work session"
            value={settings.workDuration}
            min={1}
            max={90}
            onChange={(v) => updateSettings({ workDuration: v })}
          />
          <DurationField
            label="Short break"
            value={settings.shortBreakDuration}
            min={1}
            max={30}
            onChange={(v) => updateSettings({ shortBreakDuration: v })}
          />
          <DurationField
            label="Long break"
            value={settings.longBreakDuration}
            min={1}
            max={60}
            onChange={(v) => updateSettings({ longBreakDuration: v })}
          />
          <DurationField
            label="Long break interval"
            value={settings.longBreakInterval}
            min={2}
            max={10}
            unit="pomodoros"
            onChange={(v) => updateSettings({ longBreakInterval: v })}
          />
        </div>
      </section>

      {/* ── Behaviour toggles ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Behaviour</h2>
        <div className={styles.fields}>
          <ToggleField
            label="Auto-start breaks"
            description="Automatically start the break timer after a work session ends."
            checked={settings.autoStartBreaks}
            onChange={(v) => updateSettings({ autoStartBreaks: v })}
          />
          <ToggleField
            label="Auto-start pomodoros"
            description="Automatically start the next work session after a break ends."
            checked={settings.autoStartPomodoros}
            onChange={(v) => updateSettings({ autoStartPomodoros: v })}
          />
          <ToggleField
            label="Sound notifications"
            description="Play a sound when a session completes."
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
        </div>
      </section>

      {/* ── Import / Export ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Data</h2>
        <div className={styles.dataActions}>
          <div className={styles.dataAction}>
            <div>
              <p className={styles.dataActionLabel}>Export data</p>
              <p className={styles.dataActionDesc}>
                Download a JSON backup of all sessions, tasks, and settings.
              </p>
            </div>
            <button className={styles.exportBtn} type="button" onClick={exportToFile}>
              Export
            </button>
          </div>

          <div className={styles.dataAction}>
            <div>
              <p className={styles.dataActionLabel}>Import data</p>
              <p className={styles.dataActionDesc}>
                Restore from a previously exported JSON file. Existing data will be replaced.
              </p>
            </div>
            <button
              className={styles.importBtn}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className={`${styles.section} ${styles.dangerSection}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger zone</h2>
        <div className={styles.dataAction}>
          <div>
            <p className={styles.dataActionLabel}>Clear all data</p>
            <p className={styles.dataActionDesc}>
              Permanently delete all sessions, tasks, and settings. This cannot be undone.
            </p>
          </div>
          <button className={styles.dangerBtn} type="button" onClick={handleClearAll}>
            Clear all
          </button>
        </div>
      </section>
    </div>
  );
}
