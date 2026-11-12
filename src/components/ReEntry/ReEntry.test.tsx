import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ReEntry from './ReEntry';
import type { ParkingLotItem, Task } from '../../types';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, color: '#8c8442', state: 'open', createdAt: '', ...overrides };
}

const item: ParkingLotItem = { id: 'p1', text: 'Email Sam', createdAt: '', sessionId: null };

const baseProps = {
  tasks: [task('a'), task('b')],
  selectedTaskId: null,
  onSelectTask: vi.fn(),
  parkingItems: [],
  onMakeTask: vi.fn(),
  onDismissItem: vi.fn(),
  onStart: vi.fn(),
  onNotNow: vi.fn(),
};

describe('ReEntry', () => {
  it('always offers Start and Not now, even with nothing else to show', () => {
    const onStart = vi.fn();
    const onNotNow = vi.fn();
    render(<ReEntry {...baseProps} onStart={onStart} onNotNow={onNotNow} />);
    expect(screen.queryByText('What happened')).toBeNull();
    expect(screen.queryByText('Parking lot')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });

  it('lists Ready and Asking tasks with their summaries and nothing else', () => {
    render(
      <ReEntry
        {...baseProps}
        tasks={[
          task('a', { name: 'Fix login', state: 'ready', summary: 'Tests pass, PR is up' }),
          task('b', { name: 'Docs', state: 'asking', summary: 'Which version number?' }),
          task('c', { name: 'Waiting one', state: 'waiting', summary: 'Still running' }),
          task('d', { name: 'Plain', state: 'open' }),
        ]}
      />,
    );
    const section = screen.getByRole('region', { name: 'What happened' });
    expect(within(section).getByText('Fix login')).toBeInTheDocument();
    expect(within(section).getByText('Ready')).toBeInTheDocument();
    expect(within(section).getByText('Tests pass, PR is up')).toBeInTheDocument();
    expect(within(section).getByText('Docs')).toBeInTheDocument();
    expect(within(section).getByText('Asking')).toBeInTheDocument();
    expect(within(section).queryByText('Waiting one')).toBeNull();
    expect(within(section).queryByText('Plain')).toBeNull();
  });

  it('turns parking-lot items into tasks or dismisses them in one tap', () => {
    const onMakeTask = vi.fn();
    const onDismissItem = vi.fn();
    render(
      <ReEntry {...baseProps} parkingItems={[item]} onMakeTask={onMakeTask} onDismissItem={onDismissItem} />,
    );
    expect(screen.getByText('Email Sam')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Make task: Email Sam' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Email Sam' }));
    expect(onMakeTask).toHaveBeenCalledWith(item);
    expect(onDismissItem).toHaveBeenCalledWith(item);
  });

  it('shows the next Spike task with its next action and where-was-I note before Start', () => {
    render(
      <ReEntry
        {...baseProps}
        tasks={[task('a', { nextAction: 'Run the failing test', whereWasI: 'Midway through the parser' })]}
        selectedTaskId="a"
      />,
    );
    expect(screen.getByText('Run the failing test')).toBeInTheDocument();
    expect(screen.getByText('Midway through the parser')).toBeInTheDocument();
  });

  it('lets the next task be changed', () => {
    const onSelectTask = vi.fn();
    render(<ReEntry {...baseProps} onSelectTask={onSelectTask} />);
    fireEvent.change(screen.getByLabelText('Task:'), { target: { value: 'b' } });
    expect(onSelectTask).toHaveBeenCalledWith('b');
  });
});
