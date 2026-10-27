import { fireEvent, render, screen } from '@testing-library/react';
import TaskForm from './TaskForm';

describe('TaskForm', () => {
  it('submits the task estimate as a number', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Write tests' },
    });
    fireEvent.change(screen.getByLabelText('Estimated Pomodoros'), {
      target: { value: '4' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Write tests', '#e74c3c', 4);
  });

  it('prefills the estimate when editing a task', () => {
    render(
      <TaskForm
        initial={{ name: 'Write tests', estimatedPomodoros: 3 }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Estimated Pomodoros')).toHaveValue(3);
  });

  it('requires a positive whole-number estimate', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Write tests' },
    });
    fireEvent.change(screen.getByLabelText('Estimated Pomodoros'), {
      target: { value: '1.5' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
