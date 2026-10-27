import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

it.each(['/', '/tasks', '/history', '/settings'])(
  'enables the time-only layout only on the timer route (%s)',
  (route) => {
    const { container } = render(
      <MemoryRouter initialEntries={[route]}>
        <Layout>Page content</Layout>
      </MemoryRouter>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-timer-view', String(route === '/'));
  },
);

it('updates the layout when navigating away from and back to the timer', () => {
  const { container } = render(
    <MemoryRouter>
      <Layout>Page content</Layout>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Tasks' }));
  expect(container.firstElementChild).toHaveAttribute('data-timer-view', 'false');
  fireEvent.click(screen.getByRole('link', { name: 'Timer' }));
  expect(container.firstElementChild).toHaveAttribute('data-timer-view', 'true');
});
