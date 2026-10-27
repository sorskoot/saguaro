import { render } from '@testing-library/react';
import ProgressRing from './ProgressRing';

it.each([280, 160])('keeps ring geometry scalable at size %i', (size) => {
  const { container } = render(<ProgressRing progress={0.5} size={size} />);
  const svg = container.querySelector('svg');
  expect(svg).toHaveAttribute('viewBox', `0 0 ${size} ${size}`);
  expect(svg).toHaveAttribute('width', String(size));
  expect(svg).toHaveAttribute('height', String(size));
  const radius = (size - 10) / 2;
  const arc = container.querySelectorAll('circle')[1];
  expect(arc).toHaveAttribute('r', String(radius));
  expect(arc).toHaveAttribute('stroke-dashoffset', String(Math.PI * radius));
});
