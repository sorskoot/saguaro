import { ExportService } from './ExportService';
import {
  DEFAULT_SETTINGS,
  type AppData,
  type AppEvent,
  type ParkingLotItem,
  type Session,
  type Task,
  type Settings,
} from '../types';
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

const sampleEvent: AppEvent = {
  id: '0k0000000-0001-abcd1234',
  timestamp: '2024-01-01T09:00:00.000Z',
  type: 'spike-start',
  sessionId: 'sess-1',
  taskId: 'task-1',
};

const sampleParkingItem: ParkingLotItem = {
  id: 'park-1',
  text: 'Reply to Sam',
  createdAt: '2024-01-01T09:10:00.000Z',
  sessionId: 'sess-1',
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
    it('returns AppData with the correct shape when storage is empty', async () => {
      expect(service.exportData()).toMatchObject({
        version: expect.any(String),
        settings: DEFAULT_SETTINGS,
        tasks: [],
        sessions: [],
        events: [],
        parkingLot: [],
        exportedAt: expect.any(String),
      });
    });

    it('writes the current backup version', async () => {
      expect(service.exportData().version).toBe('2.0');
    });

    it('includes the event log and the parking lot', async () => {
      data.events.save(sampleEvent);
      data.parkingLot.save(sampleParkingItem);

      const exported = service.exportData();
      expect(exported.events).toEqual([sampleEvent]);
      expect(exported.parkingLot).toEqual([sampleParkingItem]);
    });

    it('includes stored settings', async () => {
      data.settings.set(sampleSettings);

      expect(service.exportData().settings).toEqual(sampleSettings);
    });

    it('includes stored tasks', async () => {
      data.tasks.save(sampleTask);

      expect(service.exportData().tasks).toEqual([sampleTask]);
    });

    it('exports sessions with task associations', async () => {
      data.sessions.save(sampleSession);

      expect(service.exportData().sessions).toEqual([sampleSession]);
    });

    it('exportedAt is a valid ISO date string', async () => {
      const { exportedAt } = service.exportData();

      expect(new Date(exportedAt).toISOString()).toBe(exportedAt);
    });
  });

  describe('importData()', () => {
    const validPayload: AppData = {
      version: '2.0',
      settings: sampleSettings,
      tasks: [sampleTask],
      sessions: [sampleSession],
      events: [sampleEvent],
      parkingLot: [sampleParkingItem],
      exportedAt: '2024-01-01T12:00:00.000Z',
    };

    it('writes settings, tasks, and sessions to the data store', async () => {
      await service.importData(validPayload);

      expect(data.settings.get()).toEqual(sampleSettings);
      expect(data.tasks.findAll()).toEqual([sampleTask]);
      expect(data.sessions.findAll()).toEqual([sampleSession]);
      expect(data.events.findAll()).toEqual([sampleEvent]);
      expect(data.parkingLot.findAll()).toEqual([sampleParkingItem]);
    });

    it('round-trips: exporting and importing into a fresh store restores everything', async () => {
      data.settings.set(sampleSettings);
      data.tasks.save(sampleTask);
      data.sessions.save(sampleSession);
      data.events.save(sampleEvent);
      data.parkingLot.save(sampleParkingItem);
      const backup = JSON.parse(JSON.stringify(service.exportData()));

      const restored = new DataStore();
      await new ExportService(restored).importData(backup);

      expect(new ExportService(restored).exportData()).toEqual({
        ...backup,
        exportedAt: expect.any(String),
      });
    });

    it('replaces existing data rather than merging with it', async () => {
      data.tasks.save({ ...sampleTask, id: 'old' });
      data.events.save({ ...sampleEvent, id: 'old-event' });

      await service.importData(validPayload);

      expect(data.tasks.findAll().map((t) => t.id)).toEqual(['task-1']);
      expect(data.events.findAll().map((e) => e.id)).toEqual([sampleEvent.id]);
    });

    it('sorts imported events chronologically', async () => {
      const later = { ...sampleEvent, id: '0k0000000-0002-abcd1234' };
      await service.importData({ ...validPayload, events: [later, sampleEvent] });

      expect(data.events.findAll().map((e) => e.id)).toEqual([sampleEvent.id, later.id]);
    });

    it('fills in missing settings from the defaults', async () => {
      await service.importData({ ...validPayload, settings: { spikeMinimum: 40 } });

      expect(data.settings.get()).toEqual({ ...DEFAULT_SETTINGS, spikeMinimum: 40 });
    });

    it('defaults a missing task state to open', async () => {
      const { state: _state, ...stateless } = sampleTask;
      await service.importData({ ...validPayload, tasks: [stateless] });

      expect(data.tasks.findAll()[0].state).toBe('open');
    });

    it('rejects unsupported versions without changing anything', async () => {
      data.tasks.save(sampleTask);

      await expect(service.importData({ ...validPayload, version: '3.0' })).rejects.toThrow(
        'unsupported version',
      );
      expect(data.tasks.findAll()).toEqual([sampleTask]);
    });

    it('rejects records without an id and leaves existing data untouched', async () => {
      data.tasks.save(sampleTask);

      await expect(
        service.importData({ ...validPayload, events: [{ type: 'spike-start' }] }),
      ).rejects.toThrow('events[0] needs an id');
      await expect(service.importData({ ...validPayload, settings: 'nope' })).rejects.toThrow(
        'settings must be an object',
      );
      expect(data.tasks.findAll()).toEqual([sampleTask]);
      expect(data.events.findAll()).toEqual([]);
    });

    it('rejects records that lack required fields, so a bad backup cannot break the next load', async () => {
      data.tasks.save(sampleTask);

      await expect(
        service.importData({ ...validPayload, tasks: [{ id: 'a' }, { id: 'b' }] }),
      ).rejects.toThrow('needs a string "name"');
      await expect(
        service.importData({ ...validPayload, sessions: [{ id: 's', type: 'nap', startTime: 'x', completed: true }] }),
      ).rejects.toThrow('unknown type');
      await expect(
        service.importData({ ...validPayload, events: [{ id: 'e' }] }),
      ).rejects.toThrow('needs a string "type"');
      await expect(
        service.importData({ ...validPayload, parkingLot: [{ id: 'p', text: 1, createdAt: 'x' }] }),
      ).rejects.toThrow('needs a string "text"');
      await expect(
        service.importData({ ...validPayload, settings: { spikeMinimum: 'long' } }),
      ).rejects.toThrow('settings needs a number "spikeMinimum"');
      expect(data.tasks.findAll()).toEqual([sampleTask]);
    });

    it('rejects when the backup cannot be saved, leaving existing data in place', async () => {
      data.tasks.save(sampleTask);
      vi.spyOn(data, 'replaceAll').mockRejectedValue(new Error('quota exceeded'));

      await expect(service.importData(validPayload)).rejects.toThrow('quota exceeded');
      expect(data.tasks.findAll()).toEqual([sampleTask]);
    });

    it('requires the event log and parking lot in a version 2 backup', async () => {
      const { events: _events, ...withoutEvents } = validPayload;
      expect(() => service.parse(withoutEvents)).toThrow('missing required fields');
    });

    describe('version 1 backups', () => {
      const v1Backup = {
        version: '1.0',
        exportedAt: '2024-01-01T12:00:00.000Z',
        settings: {
          workDuration: 30,
          shortBreakDuration: 4,
          longBreakDuration: 12,
          longBreakInterval: 3,
          autoStartBreaks: true,
          autoStartPomodoros: true,
          soundEnabled: false,
        },
        tasks: [
          { id: 'a', name: 'Active', color: '#111', estimatedPomodoros: 3, createdAt: '2024-01-01T00:00:00.000Z', archived: false },
          { id: 'b', name: 'Archived', color: '#222', estimatedPomodoros: 0, createdAt: '2024-01-02T00:00:00.000Z', archived: true },
        ],
        sessions: [
          { id: 's1', taskId: 'a', type: 'work', startTime: '2024-01-01T09:00:00.000Z', endTime: '2024-01-01T09:25:00.000Z', completed: true },
          { id: 's2', taskId: null, type: 'short-break', startTime: '2024-01-01T09:25:00.000Z', endTime: '2024-01-01T09:30:00.000Z', completed: true },
        ],
      };

      it('converts tasks: archived becomes done, estimatedPomodoros becomes estimatedSpikes', async () => {
        await service.importData(v1Backup);

        const [active, archived] = data.tasks.findAll();
        expect(active).toMatchObject({ id: 'a', state: 'open', estimatedSpikes: 3 });
        expect(active).not.toHaveProperty('archived');
        expect(active).not.toHaveProperty('estimatedPomodoros');
        expect(archived).toMatchObject({ id: 'b', state: 'done' });
        expect(archived).not.toHaveProperty('estimatedSpikes');
      });

      it("renames the 'work' session type to 'spike'", async () => {
        await service.importData(v1Backup);

        expect(data.sessions.findAll().map((s) => s.type)).toEqual(['spike', 'short-break']);
      });

      it('carries over renamed settings and drops the removed ones', async () => {
        await service.importData(v1Backup);

        const settings = data.settings.get()!;
        expect(settings).toMatchObject({
          spikeMinimum: 30,
          breakEndChime: false,
          shortBreakDuration: 4,
          longBreakDuration: 12,
          longBreakInterval: 3,
        });
        expect(settings).not.toHaveProperty('workDuration');
        expect(settings).not.toHaveProperty('soundEnabled');
        expect(settings).not.toHaveProperty('autoStartBreaks');
        expect(settings).not.toHaveProperty('autoStartPomodoros');
      });

      it('imports with an empty event log and parking lot', async () => {
        const imported = await service.importData(v1Backup);

        expect(imported.version).toBe('2.0');
        expect(imported.events).toEqual([]);
        expect(imported.parkingLot).toEqual([]);
      });
    });

    it('returns the imported AppData', async () => {
      expect(await service.importData(validPayload)).toEqual(validPayload);
    });

    it('throws when the input is not an object', async () => {
      expect(() => service.parse(null)).toThrow('Invalid import data');
      expect(() => service.parse(42)).toThrow('Invalid import data');
    });

    it('throws when required fields are missing or invalid', async () => {
      expect(() => service.parse({ settings: sampleSettings, tasks: [], sessions: [] }))
        .toThrow('Invalid import data');
      expect(() => service.parse({ version: '1.0', tasks: [], sessions: [] }))
        .toThrow('Invalid import data');
      expect(() => service.parse({
        version: '1.0',
        settings: sampleSettings,
        tasks: 'invalid',
        sessions: [],
      })).toThrow('Invalid import data');
      expect(() => service.parse({
        version: '1.0',
        settings: sampleSettings,
        tasks: [],
        sessions: null,
      })).toThrow('Invalid import data');
    });
  });
});
