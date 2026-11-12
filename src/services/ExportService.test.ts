import { ExportService } from './ExportService';
import { DEFAULT_SETTINGS, type AppData, type Session, type Task, type Settings } from '../types';
import { DataStore } from './db/DataStore';

const sampleTask: Task = {
  id: 'task-1',
  name: 'Write tests',
  color: '#aabbcc',
  estimatedSpikes: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  state: 'open',
};

const sampleSession: Session = {
  id: 'sess-1',
  taskId: 'task-1',
  type: 'spike',
  startTime: '2024-01-01T09:00:00.000Z',
  endTime: '2024-01-01T09:25:00.000Z',
  completed: true,
};

const sampleSettings: Settings = {
  ...DEFAULT_SETTINGS,
  spikeMinimum: 30,
};

describe('ExportService', () => {
  let data: DataStore;
  let service: ExportService;

  beforeEach(() => {
    data = new DataStore();
    service = new ExportService(data);
  });

  describe('exportData()', () => {
    it('returns AppData with the correct shape when storage is empty', () => {
      expect(service.exportData()).toMatchObject({
        version: expect.any(String),
        settings: DEFAULT_SETTINGS,
        tasks: [],
        sessions: [],
        exportedAt: expect.any(String),
      });
    });

    it('includes stored settings', () => {
      data.settings.set(sampleSettings);

      expect(service.exportData().settings).toEqual(sampleSettings);
    });

    it('includes stored tasks', () => {
      data.tasks.save(sampleTask);

      expect(service.exportData().tasks).toEqual([sampleTask]);
    });

    it('exports sessions with task associations', () => {
      data.sessions.save(sampleSession);

      expect(service.exportData().sessions).toEqual([sampleSession]);
    });

    it('exportedAt is a valid ISO date string', () => {
      const { exportedAt } = service.exportData();

      expect(new Date(exportedAt).toISOString()).toBe(exportedAt);
    });
  });

  describe('importData()', () => {
    const validPayload: AppData = {
      version: '1.0',
      settings: sampleSettings,
      tasks: [sampleTask],
      sessions: [sampleSession],
      exportedAt: '2024-01-01T12:00:00.000Z',
    };

    it('writes settings, tasks, and sessions to the data store', () => {
      service.importData(validPayload);

      expect(data.settings.get()).toEqual(sampleSettings);
      expect(data.tasks.findAll()).toEqual([sampleTask]);
      expect(data.sessions.findAll()).toEqual([sampleSession]);
    });

    it('returns the imported AppData', () => {
      expect(service.importData(validPayload)).toEqual(validPayload);
    });

    it('throws when the input is not an object', () => {
      expect(() => service.importData(null)).toThrow('Invalid import data');
      expect(() => service.importData(42)).toThrow('Invalid import data');
    });

    it('throws when required fields are missing or invalid', () => {
      expect(() => service.importData({ settings: sampleSettings, tasks: [], sessions: [] }))
        .toThrow('Invalid import data');
      expect(() => service.importData({ version: '1.0', tasks: [], sessions: [] }))
        .toThrow('Invalid import data');
      expect(() => service.importData({
        version: '1.0',
        settings: sampleSettings,
        tasks: 'invalid',
        sessions: [],
      })).toThrow('Invalid import data');
      expect(() => service.importData({
        version: '1.0',
        settings: sampleSettings,
        tasks: [],
        sessions: null,
      })).toThrow('Invalid import data');
    });
  });
});
