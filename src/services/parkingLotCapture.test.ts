import { captureThought, setActiveSpikeSessionId } from './parkingLotCapture';
import { getDataStore } from './db/DataStore';
import { EventLogRepository } from './EventLogRepository';

beforeEach(() => {
  getDataStore().parkingLot.replaceAll([]);
  setActiveSpikeSessionId(null);
});

describe('captureThought', () => {
  it('saves a trimmed item and logs a capture event with no Spike', () => {
    const item = captureThought('  Reply to Sam ');
    expect(item).toMatchObject({ text: 'Reply to Sam', sessionId: null });
    expect(getDataStore().parkingLot.findById(item!.id)).toMatchObject({ text: 'Reply to Sam' });
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'capture', itemId: item!.id, sessionId: null },
    ]);
  });

  it('links the item and event to the running Spike', () => {
    setActiveSpikeSessionId('spike-1');
    const item = captureThought('Look up flights');
    expect(item?.sessionId).toBe('spike-1');
    expect(new EventLogRepository(getDataStore().events).findAll()).toMatchObject([
      { type: 'capture', sessionId: 'spike-1' },
    ]);
  });

  it('ignores blank text', () => {
    expect(captureThought('   ')).toBeNull();
    expect(getDataStore().parkingLot.findAll()).toHaveLength(0);
    expect(new EventLogRepository(getDataStore().events).findAll()).toHaveLength(0);
  });
});
