import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timer from './Timer';

const baseProps = {
  phase: 'spike' as const,
  mode: 'spike' as const,
  secondsLeft: 100,
  totalSeconds: 1500,
  overtimeSeconds: 0,
  spikeCount: 0,
  onStart: vi.fn(),
  onEndSpike: vi.fn(),
  onSkipBreak: vi.fn(),
};

describe('Timer Spike controls', () => {
  it('starts a Spike from idle', () => {
    const onStart = vi.fn();
    render(<Timer {...baseProps} phase="idle" secondsLeft={1500} onStart={onStart} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('offers End early before the minimum', () => {
    const onEndSpike = vi.fn();
    render(<Timer {...baseProps} onEndSpike={onEndSpike} />);
    expect(screen.queryByRole('button', { name: 'Take a break' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End early' }));
    expect(onEndSpike).toHaveBeenCalledTimes(1);
  });

  it('counts up with a full ring and offers Take a break once the minimum is reached', () => {
    const onEndSpike = vi.fn();
    const { container } = render(
      <Timer {...baseProps} secondsLeft={0} overtimeSeconds={192} onEndSpike={onEndSpike} />,
    );
    expect(screen.getByText('+3:12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End early' })).toBeNull();
    const arc = container.querySelectorAll('circle')[1];
    expect(arc.getAttribute('stroke-dashoffset')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Take a break' }));
    expect(onEndSpike).toHaveBeenCalledTimes(1);
  });
});

describe('Timer cancel confirmation', () => {
  it('asks for confirmation, then cancels the session', () => {
    const onCancel = vi.fn();
    const onEndSpike = vi.fn();
    render(<Timer {...baseProps} onEndSpike={onEndSpike} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Spike' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEndSpike).not.toHaveBeenCalled();
  });

  it('keeps going when the confirmation is dismissed', () => {
    const onCancel = vi.fn();
    render(<Timer {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'End early' })).toBeInTheDocument();
  });

  it('cannot cancel a break', () => {
    render(<Timer {...baseProps} phase="break" mode="short-break" onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('Timer break', () => {
  it('counts down and lets the break be skipped', () => {
    const onSkipBreak = vi.fn();
    render(
      <Timer {...baseProps} phase="break" mode="short-break" secondsLeft={240} totalSeconds={300} onSkipBreak={onSkipBreak} />,
    );
    expect(screen.getByText('Short Break')).toBeInTheDocument();
    expect(screen.getByText('04:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip break' }));
    expect(onSkipBreak).toHaveBeenCalledTimes(1);
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

  it('is disabled when no Spike is running', () => {
    render(<Timer {...baseProps} phase="idle" onInterrupt={vi.fn()} />);
    expect(screen.getByRole('button', { name: /interruption/i })).toBeDisabled();
  });

  it('is hidden during breaks', () => {
    render(<Timer {...baseProps} phase="break" mode="short-break" onInterrupt={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /interruption/i })).toBeNull();
  });
});
