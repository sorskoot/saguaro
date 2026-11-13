import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaptureField from './CaptureField';

describe('CaptureField', () => {
  it('is focused on open, saves on Enter and then closes', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CaptureField onSubmit={onSubmit} onClose={onClose} />);
    const input = screen.getByRole('textbox', { name: 'Capture a thought' });
    expect(input).toHaveFocus();

    await userEvent.type(input, 'Buy milk{Enter}');
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Buy milk');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape without saving', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CaptureField onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
