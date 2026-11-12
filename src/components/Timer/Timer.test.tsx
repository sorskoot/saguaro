import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timer from './Timer';

const baseProps = {
  secondsLeft: 100,
  totalSeconds: 1500,
  isRunning: true,
  mode: 'spike' as const,
  pomodoroCount: 0,
  onStart: vi.fn(),
  onPause: vi.fn(),
  onReset: vi.fn(),
  onSkip: vi.fn(),
};

describe('Timer cancel confirmation', () => {
  it('asks for confirmation, then cancels the session', () => {
    const onCancel = vi.fn();
    const onPause = vi.fn();
    render(<Timer {...baseProps} onPause={onPause} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Spike' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPause).not.toHaveBeenCalled();
  });

  it('keeps going when the confirmation is dismissed', () => {
    const onCancel = vi.fn();
    render(<Timer {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('still pauses plainly during breaks', () => {
    const onPause = vi.fn();
    render(<Timer {...baseProps} mode="short-break" onPause={onPause} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});

describe('Timer interruption button', () => {
  it('calls onInterrupt and shows the count', () => {
    const onInterrupt = vi.fn();
    render(<Timer {...baseProps} interruptions={2} onInterrupt={onInterrupt} />);
    const btn = screen.getByRole('button', { name: /interruption \(2\)/i });
    fireEvent.click(btn);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('is disabled when the timer is not running', () => {
    render(<Timer {...baseProps} isRunning={false} onInterrupt={vi.fn()} />);
    expect(screen.getByRole('button', { name: /interruption/i })).toBeDisabled();
  });

  it('is hidden during breaks', () => {
    render(<Timer {...baseProps} mode="short-break" onInterrupt={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /interruption/i })).toBeNull();
  });
});
