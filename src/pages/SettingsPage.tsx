import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useExport } from '../hooks/useExport';
import { getDataStore } from '../services/db/DataStore';
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

  async function handleClearAll() {
    if (
      window.confirm(
        'Clear ALL data? This will permanently delete all sessions, tasks and the event log. This cannot be undone.',
      )
    ) {
      await getDataStore().clearAll();
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
            label="Spike minimum"
            value={settings.spikeMinimum}
            min={1}
            max={90}
            onChange={(v) => updateSettings({ spikeMinimum: v })}
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
            unit="Spikes"
            onChange={(v) => updateSettings({ longBreakInterval: v })}
          />
        </div>
      </section>

      {/* ── Behaviour toggles ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Behaviour</h2>
        <div className={styles.fields}>
          <ToggleField
            label="Break-end chime"
            description="Play a soft chime when a break ends."
            checked={settings.breakEndChime}
            onChange={(v) => updateSettings({ breakEndChime: v })}
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
          <button className={styles.dangerBtn} type="button" onClick={() => void handleClearAll()}>
            Clear all
          </button>
        </div>
      </section>
    </div>
  );
}
