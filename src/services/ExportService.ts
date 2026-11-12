import type { IExportService } from './interfaces/IExportService';
import type { DataStore } from './db/DataStore';
import type {
  AppData,
  AppEvent,
  ParkingLotItem,
  Session,
  SessionType,
  Settings,
  Task,
  TaskState,
} from '../types';
import { APP_DATA_VERSION, DEFAULT_SETTINGS, TASK_STATES } from '../types';

type Json = Record<string, unknown>;

const SESSION_TYPES: readonly SessionType[] = ['spike', 'short-break', 'long-break'];

function isObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`Invalid import data: ${message}`);
}

/** Requires `record[field]` to be a value of the given type; `what` names the record for the error. */
function need(
  record: Json,
  field: string,
  type: 'string' | 'number' | 'boolean',
  what: string,
): void {
  if (typeof record[field] !== type) fail(`${what} needs a ${type} "${field}"`);
}

function needRecords(name: string, value: unknown): Json[] {
  if (!Array.isArray(value)) fail(`${name} must be a list`);
  value.forEach((item, index) => {
    if (!isObject(item)) fail(`${name}[${index}] must be an object`);
    if (typeof item.id !== 'string' || item.id === '') fail(`${name}[${index}] needs an id`);
  });
  return value as Json[];
}

function isTaskState(value: unknown): value is TaskState {
  return TASK_STATES.includes(value as TaskState);
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : undefined;
}

/** Brings a task from any supported backup into the current shape, and checks it. */
function toTask(raw: Json): Task {
  const { archived, estimatedPomodoros, estimatedSpikes, state, ...rest } = raw;
  const estimate = positiveInteger(estimatedSpikes ?? estimatedPomodoros);
  const task = {
    ...rest,
    // v1 backups had an `archived` flag, which became the Done state.
    state: isTaskState(state) ? state : archived === true ? 'done' : 'open',
    ...(estimate !== undefined ? { estimatedSpikes: estimate } : {}),
  };
  const what = `task "${String(raw.id)}"`;
  need(task, 'name', 'string', what);
  need(task, 'color', 'string', what);
  need(task, 'createdAt', 'string', what);
  return task as unknown as Task;
}

function toSession(raw: Json): Session {
  const session = { ...raw, type: raw.type === 'work' ? 'spike' : raw.type };
  const what = `session "${String(raw.id)}"`;
  if (!SESSION_TYPES.includes(session.type as SessionType)) fail(`${what} has an unknown type`);
  need(session, 'startTime', 'string', what);
  need(session, 'completed', 'boolean', what);
  return session as unknown as Session;
}

function toEvent(raw: Json): AppEvent {
  const what = `event "${String(raw.id)}"`;
  need(raw, 'type', 'string', what);
  need(raw, 'timestamp', 'string', what);
  return raw as unknown as AppEvent;
}

function toParkingItem(raw: Json): ParkingLotItem {
  const what = `parking lot item "${String(raw.id)}"`;
  need(raw, 'text', 'string', what);
  need(raw, 'createdAt', 'string', what);
  return raw as unknown as ParkingLotItem;
}

/** Merges a backup's settings over the defaults, carrying over renamed v1 settings. */
function toSettings(raw: unknown): Settings {
  if (!isObject(raw)) fail('settings must be an object');
  const {
    workDuration,
    soundEnabled,
    autoStartBreaks: _autoStartBreaks,
    autoStartPomodoros: _autoStartPomodoros,
    ...rest
  } = raw;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(typeof workDuration === 'number' ? { spikeMinimum: workDuration } : {}),
    ...(typeof soundEnabled === 'boolean' ? { breakEndChime: soundEnabled } : {}),
    ...rest,
  };
  for (const field of ['spikeMinimum', 'shortBreakDuration', 'longBreakDuration', 'longBreakInterval']) {
    need(settings, field, 'number', 'settings');
  }
  need(settings, 'breakEndChime', 'boolean', 'settings');
  const code = settings.bridgePairingCode;
  if (code !== null && typeof code !== 'string') fail('settings needs a string or null "bridgePairingCode"');
  return settings as unknown as Settings;
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

  /**
   * Checks a backup and converts it to the current format without touching any
   * stored data. Throws if anything in it is missing or has the wrong type.
   */
  parse(data: unknown): AppData {
    if (!isObject(data)) fail('not an object');
    const { version, settings, tasks, sessions } = data;
    if (!version || !settings || !Array.isArray(tasks) || !Array.isArray(sessions)) {
      fail('missing required fields');
    }
    const isV1 = String(version).startsWith('1.');
    const isV2 = version === APP_DATA_VERSION;
    if (!isV1 && !isV2) fail(`unsupported version ${String(version)}`);
    if (isV2 && (!Array.isArray(data.events) || !Array.isArray(data.parkingLot))) {
      fail('missing required fields');
    }

    return {
      version: APP_DATA_VERSION,
      settings: toSettings(settings),
      tasks: needRecords('tasks', tasks).map(toTask),
      sessions: needRecords('sessions', sessions).map(toSession),
      events: (isV2 ? needRecords('events', data.events).map(toEvent) : []).sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      ),
      parkingLot: isV2 ? needRecords('parkingLot', data.parkingLot).map(toParkingItem) : [],
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    };
  }

  /**
   * Replaces all data with the contents of the backup. Rejects, changing
   * nothing, if the backup is invalid or cannot be saved.
   */
  async importData(data: unknown): Promise<AppData> {
    const appData = this.parse(data);
    await this.data.replaceAll(appData);
    return appData;
  }
}
