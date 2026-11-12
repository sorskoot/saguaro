import { countInPlay, exceedsSoftCap, SOFT_CAP } from './softCap';
import type { Task, TaskState } from '../types';

const make = (states: TaskState[]): Task[] =>
  states.map((state, i) => ({ id: String(i), name: `T${i}`, color: '#000', createdAt: '', state }));

describe('soft cap', () => {
  it('counts Waiting, Asking and Ready only', () => {
    expect(countInPlay(make(['open', 'focus', 'done', 'waiting', 'asking', 'ready']))).toBe(3);
  });

  it('is exceeded only above the cap', () => {
    expect(exceedsSoftCap(make(Array(SOFT_CAP).fill('waiting')))).toBe(false);
    expect(exceedsSoftCap(make(['waiting', 'waiting', 'asking', 'ready']))).toBe(true);
  });
});
