import { render, screen } from '@testing-library/react';
import DailySummary from './DailySummary';
import type { Session } from '../../types';

function spike(over: Partial<Session>): Session {
  return { id: 'x', taskId: null, type: 'spike', completed: true, startTime: '', endTime: '', ...over };
}

describe('DailySummary focus time', () => {
  it('sums recorded durations, including overtime and early ends', () => {
    render(
      <DailySummary
        date="2026-11-12"
        sessions={[
          spike({ startTime: '2026-11-12T09:00:00Z', endTime: '2026-11-12T09:40:00Z', endedEarly: false }),
          spike({ startTime: '2026-11-12T10:00:00Z', endTime: '2026-11-12T10:00:10Z', endedEarly: true }),
        ]}
      />,
    );
    expect(screen.getByText('40m')).toBeInTheDocument();
  });

  it('falls back to 25 minutes for legacy records', () => {
    render(<DailySummary date="2026-11-12" sessions={[spike({})]} />);
    expect(screen.getByText('25m')).toBeInTheDocument();
  });
});
