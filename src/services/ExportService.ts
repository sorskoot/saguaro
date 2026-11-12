import type { IExportService } from './interfaces/IExportService';
import type { DataStore } from './db/DataStore';
import type { AppData, AppEvent, ParkingLotItem, Session, Settings, Task, TaskState } from '../types';
import { APP_DATA_VERSION, DEFAULT_SETTINGS, TASK_STATES } from '../types';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRecordWithId(value: unknown): value is Json & { id: string } {
  return isObject(value) && typeof value.id === 'string' && value.id !== '';
}

function requireRecords(name: string, value: unknown): Json[] {
  if (!Array.isArray(value) || !value.every(isRecordWithId)) {
    throw new Error(`Invalid import data: ${name} must be a list of records with an id`);
  }
  return value;
}

function isTaskState(value: unknown): value is TaskState {
  return TASK_STATES.includes(value as TaskState);
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : undefined;
}

/** Brings a task from any supported backup into the current shape. */
function normalizeTask(raw: Json): Task {
  const {
    archived,
    estimatedPomodoros,
    estimatedSpikes,
    state,
    ...rest
  } = raw;
  const estimate = positiveInteger(estimatedSpikes ?? estimatedPomodoros);
  return {
    ...rest,
    // v1 backups had an `archived` flag, which became the Done state.
    state: isTaskState(state) ? state : archived === true ? 'done' : 'open',
    ...(estimate !== undefined ? { estimatedSpikes: estimate } : {}),
  } as unknown as Task;
}

function normalizeSession(raw: Json): Session {
  return { ...raw, type: raw.type === 'work' ? 'spike' : raw.type } as unknown as Session;
}

/** Merges a backup's settings over the defaults, carrying over renamed v1 settings. */
function normalizeSettings(raw: unknown): Settings {
  if (!isObject(raw)) throw new Error('Invalid import data: settings must be an object');
  const {
    workDuration,
    soundEnabled,
    autoStartBreaks: _autoStartBreaks,
    autoStartPomodoros: _autoStartPomodoros,
    ...rest
  } = raw;
  return {
    ...DEFAULT_SETTINGS,
    ...(typeof workDuration === 'number' ? { spikeMinimum: workDuration } : {}),
    ...(typeof soundEnabled === 'boolean' ? { breakEndChime: soundEnabled } : {}),
    ...rest,
  } as Settings;
}

/**
 * Reads and writes backups. Version 2 backups carry every kind of data,
 * including the event log; version 1 backups (tasks, sessions, settings only)
 * are still accepted and converted.
 */
export class ExportService implements IExportService {
  constructor(private readonly data: DataStore) {}

  exportData(): AppData {
    return {
      version: APP_DATA_VERSION,
      settings: this.data.settings.get() ?? { ...DEFAULT_SETTINGS },
      tasks: this.data.tasks.findAll(),
      sessions: this.data.sessions.findAll(),
      events: this.data.events.findAll(),
      parkingLot: this.data.parkingLot.findAll(),
      exportedAt: new Date().toISOString(),
    };
  }

  /** Replaces all data with the contents of the backup. Throws, changing nothing, if it is invalid. */
  importData(data: unknown): AppData {
    if (!isObject(data)) {
      throw new Error('Invalid import data: not an object');
    }
    const { version, settings, tasks, sessions } = data;
    if (!version || !settings || !Array.isArray(tasks) || !Array.isArray(sessions)) {
      throw new Error('Invalid import data: missing required fields');
    }
    const isV1 = String(version).startsWith('1.');
    const isV2 = version === APP_DATA_VERSION;
    if (!isV1 && !isV2) {
      throw new Error(`Invalid import data: unsupported version ${String(version)}`);
    }
    if (isV2 && (!Array.isArray(data.events) || !Array.isArray(data.parkingLot))) {
      throw new Error('Invalid import data: missing required fields');
    }

    // Validate everything before touching the store, so a bad file changes nothing.
    const appData: AppData = {
      version: APP_DATA_VERSION,
      settings: normalizeSettings(settings),
      tasks: requireRecords('tasks', tasks).map(normalizeTask),
      sessions: requireRecords('sessions', sessions).map(normalizeSession),
      events: (isV2 ? (requireRecords('events', data.events) as unknown as AppEvent[]) : []).sort(
        (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      ),
      parkingLot: isV2 ? (requireRecords('parkingLot', data.parkingLot) as unknown as ParkingLotItem[]) : [],
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    };

    this.data.settings.set(appData.settings);
    this.data.tasks.replaceAll(appData.tasks);
    this.data.sessions.replaceAll(appData.sessions);
    this.data.events.replaceAll(appData.events);
    this.data.parkingLot.replaceAll(appData.parkingLot);
    return appData;
  }
}
