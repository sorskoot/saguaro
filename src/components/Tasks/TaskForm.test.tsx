import { fireEvent, render, screen } from '@testing-library/react';
import TaskForm from './TaskForm';

describe('TaskForm', () => {
  it('submits the task estimate as a number', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Write tests' },
    });
    fireEvent.change(screen.getByLabelText('Estimated Spikes'), {
      target: { value: '4' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Write tests', '#8c8442', 4, {
      description: undefined,
      link: undefined,
    });
  });

  it('submits a trimmed description and link', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Fix bug' } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: '  Crash on start  ' },
    });
    fireEvent.change(screen.getByLabelText('Link (optional)'), {
      target: { value: 'https://github.com/sorskoot/saguaro/issues/1' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Fix bug', '#8c8442', undefined, {
      description: 'Crash on start',
      link: 'https://github.com/sorskoot/saguaro/issues/1',
    });
  });

  it('prefills description and link when editing', () => {
    render(
      <TaskForm
        initial={{ name: 'Fix bug', description: 'Notes', link: 'https://example.com/1' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Notes');
    expect(screen.getByLabelText('Link (optional)')).toHaveValue('https://example.com/1');
  });

  it('rejects links that are not http(s) URLs', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Fix bug' } });
    fireEvent.change(screen.getByLabelText('Link (optional)'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefills the estimate when editing a task', () => {
    render(
      <TaskForm
        initial={{ name: 'Write tests', estimatedSpikes: 3 }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Estimated Spikes')).toHaveValue(3);
  });

  it('requires a positive whole-number estimate', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Write tests' },
    });
    fireEvent.change(screen.getByLabelText('Estimated Spikes'), {
      target: { value: '1.5' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a trimmed next action and where-was-I note', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Fix bug' } });
    fireEvent.change(screen.getByLabelText('Next action (optional)'), {
      target: { value: '  Reproduce with the failing test ' },
    });
    fireEvent.change(screen.getByLabelText('Where was I (optional)'), {
      target: { value: ' Stuck on the parser ' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Fix bug', '#8c8442', undefined, {
      description: undefined,
      link: undefined,
      nextAction: 'Reproduce with the failing test',
      whereWasI: 'Stuck on the parser',
    });
  });

  it('prefills the notes when editing', () => {
    render(<TaskForm initial={{ name: 'Fix bug', nextAction: 'Run it', whereWasI: 'Halfway' }} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Next action (optional)')).toHaveValue('Run it');
    expect(screen.getByLabelText('Where was I (optional)')).toHaveValue('Halfway');
  });
});
