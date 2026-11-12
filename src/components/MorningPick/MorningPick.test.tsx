import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MorningPick, { MORNING_PICK_STORAGE_KEY } from './MorningPick';
import { getDataStore } from '../../services/db/DataStore';
import { getStorageService } from '../../services/StorageService';
import { EventLogRepository } from '../../services/EventLogRepository';
import type { Task } from '../../types';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, color: '#8c8442', state: 'open', createdAt: '', ...overrides };
}

const MORNING = new Date(2026, 10, 12, 9, 0);

function renderGate() {
  return render(
    <MorningPick>
      <p>The timer</p>
    </MorningPick>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MORNING);
  getDataStore().tasks.replaceAll([
    task('a', { name: 'Fix login', whereWasI: 'In the parser', nextAction: 'Run the test' }),
    task('b', { name: 'Write docs' }),
    task('c', { name: 'Waiting job', state: 'waiting' }),
    task('d', { name: 'Finished', state: 'done' }),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MorningPick', () => {
  it('shows open tasks with their notes on the first open of the day', () => {
    renderGate();
    expect(screen.getByRole('region', { name: 'Morning pick' })).toBeInTheDocument();
    expect(screen.queryByText('The timer')).toBeNull();
    expect(screen.getByText('Fix login')).toBeInTheDocument();
    expect(screen.getByText('In the parser')).toBeInTheDocument();
    expect(screen.getByText('Next: Run the test')).toBeInTheDocument();
    expect(screen.getByText('Write docs')).toBeInTheDocument();
    expect(screen.queryByText('Waiting job')).toBeNull();
    expect(screen.queryByText('Finished')).toBeNull();
  });

  it('focuses the tapped task, logs the switch and remembers today', () => {
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: /Write docs/ }));

    expect(screen.getByText('The timer')).toBeInTheDocument();
    expect(getDataStore().tasks.findById('b')?.state).toBe('focus');
    expect(getStorageService().get(MORNING_PICK_STORAGE_KEY)).toBe('2026-11-12');
    expect(new EventLogRepository(getDataStore().events).findByType('focus-switch')).toMatchObject([
      { type: 'focus-switch', fromTaskId: null, toTaskId: 'b' },
    ]);
  });

  it('can be skipped without changing the focus task', () => {
    getDataStore().tasks.save(task('a', { state: 'focus' }));
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(screen.getByText('The timer')).toBeInTheDocument();
    expect(getDataStore().tasks.findById('a')?.state).toBe('focus');
    expect(getStorageService().get(MORNING_PICK_STORAGE_KEY)).toBe('2026-11-12');
  });

  it('does not show again later the same day', () => {
    renderGate().unmount();
    getStorageService().set(MORNING_PICK_STORAGE_KEY, '2026-11-12');
    vi.setSystemTime(new Date(2026, 10, 12, 22, 0));
    renderGate();
    expect(screen.getByText('The timer')).toBeInTheDocument();
  });

  it('counts a late-night open as the same day', () => {
    getStorageService().set(MORNING_PICK_STORAGE_KEY, '2026-11-12');
    vi.setSystemTime(new Date(2026, 10, 13, 1, 30));
    renderGate();
    expect(screen.getByText('The timer')).toBeInTheDocument();
  });

  it('shows again the next morning', () => {
    getStorageService().set(MORNING_PICK_STORAGE_KEY, '2026-11-12');
    vi.setSystemTime(new Date(2026, 10, 13, 4, 0));
    renderGate();
    expect(screen.getByRole('region', { name: 'Morning pick' })).toBeInTheDocument();
  });

  it('stays out of the way when there is nothing to pick', () => {
    getDataStore().tasks.replaceAll([task('c', { state: 'waiting' })]);
    renderGate();
    expect(screen.getByText('The timer')).toBeInTheDocument();
    expect(getStorageService().get(MORNING_PICK_STORAGE_KEY)).toBeNull();
  });
});
