import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TimerPictureInPicture from './TimerPictureInPicture';

function createPipWindow() {
  const events = new EventTarget();
  const pipDocument = document.implementation.createHTMLDocument();
  Object.defineProperty(pipDocument, 'defaultView', { value: window });
  const pipWindow = {
    document: pipDocument,
    addEventListener: events.addEventListener.bind(events),
    close: vi.fn(() => events.dispatchEvent(new Event('pagehide'))),
  };
  return pipWindow;
}

function installApi(requestWindow = vi.fn()) {
  vi.stubGlobal('documentPictureInPicture', { requestWindow });
  return requestWindow;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TimerPictureInPicture', () => {
  it('hides the button when the browser does not support the API', () => {
    vi.stubGlobal('documentPictureInPicture', undefined);
    render(<TimerPictureInPicture secondsLeft={1500} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a styled floating timer and keeps the time synchronized', async () => {
    const pipWindow = createPipWindow();
    const requestWindow = installApi(vi.fn().mockResolvedValue(pipWindow));
    const { rerender } = render(<TimerPictureInPicture secondsLeft={1500} />);
    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));

    await waitFor(() => expect(within(pipWindow.document.body).getByRole('timer')).toHaveTextContent('25:00'));
    expect(requestWindow).toHaveBeenCalledExactlyOnceWith({ width: 320, height: 180 });
    expect(pipWindow.document.title).toBe('Saguaro timer');
    expect(pipWindow.document.head.querySelector('style')?.textContent).toContain('.floating-timer');
    expect(screen.getByRole('button', { name: 'Close floating timer' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<TimerPictureInPicture secondsLeft={1499} />);
    expect(within(pipWindow.document.body).getByRole('timer')).toHaveTextContent('24:59');
    rerender(<TimerPictureInPicture secondsLeft={0} />);
    expect(within(pipWindow.document.body).getByRole('timer')).toHaveTextContent('00:00');
  });

  it('closes from the app and allows reopening after the native window closes', async () => {
    const first = createPipWindow();
    const second = createPipWindow();
    const requestWindow = installApi(vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second));
    render(<TimerPictureInPicture secondsLeft={1500} />);
    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close floating timer' }));
    expect(first.close).toHaveBeenCalledOnce();
    expect(within(first.document.body).queryByRole('timer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));
    await screen.findByRole('button', { name: 'Close floating timer' });
    act(() => second.close());
    expect(screen.getByRole('button', { name: 'Float timer' })).toHaveAttribute('aria-pressed', 'false');
    expect(requestWindow).toHaveBeenCalledTimes(2);
  });

  it('reports opening failures and allows retrying', async () => {
    const pipWindow = createPipWindow();
    installApi(vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValueOnce(pipWindow));
    render(<TimerPictureInPicture secondsLeft={1500} />);
    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open');
    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));
    await screen.findByRole('button', { name: 'Close floating timer' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes the floating window when the timer page unmounts', async () => {
    const pipWindow = createPipWindow();
    installApi(vi.fn().mockResolvedValue(pipWindow));
    const { unmount } = render(<TimerPictureInPicture secondsLeft={1500} />);
    fireEvent.click(screen.getByRole('button', { name: 'Float timer' }));
    await screen.findByRole('button', { name: 'Close floating timer' });
    unmount();
    expect(pipWindow.close).toHaveBeenCalledOnce();
  });

  it('prevents duplicate requests and closes a window opened after unmounting', async () => {
    const pipWindow = createPipWindow();
    let resolveWindow!: (value: typeof pipWindow) => void;
    const requestWindow = installApi(vi.fn(() => new Promise((resolve) => { resolveWindow = resolve; })));
    const { unmount } = render(<TimerPictureInPicture secondsLeft={1500} />);
    const button = screen.getByRole('button', { name: 'Float timer' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(requestWindow).toHaveBeenCalledOnce();
    unmount();
    await act(async () => resolveWindow(pipWindow));
    expect(pipWindow.close).toHaveBeenCalledOnce();
    expect(pipWindow.document.body).toBeEmptyDOMElement();
  });
});
