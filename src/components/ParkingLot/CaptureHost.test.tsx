import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaptureHost from './CaptureHost';
import { getDataStore } from '../../services/db/DataStore';

const shortcut = { code: 'Space', ctrlKey: true, shiftKey: true };

beforeEach(() => {
  getDataStore().parkingLot.replaceAll([]);
});

describe('CaptureHost', () => {
  it('renders nothing until the shortcut is pressed', () => {
    render(<CaptureHost />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens on the shortcut, saves on Enter, closes and restores focus', async () => {
    render(
      <>
        <button>Elsewhere</button>
        <CaptureHost />
      </>,
    );
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    fireEvent.keyDown(window, shortcut);

    const input = await screen.findByRole('textbox', { name: 'Capture a thought' });
    expect(input).toHaveFocus();
    await userEvent.type(input, 'Call the bank{Enter}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    expect(getDataStore().parkingLot.findAll()).toMatchObject([{ text: 'Call the bank' }]);
  });

  it('closes on Escape without saving', async () => {
    render(<CaptureHost />);
    fireEvent.keyDown(window, shortcut);
    const input = await screen.findByRole('textbox');
    await userEvent.type(input, 'never mind{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(getDataStore().parkingLot.findAll()).toHaveLength(0);
  });
});
