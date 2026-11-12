import { useCallback, useRef, useState } from 'react';
import { useSelectedTask } from '../hooks/useSelectedTask';
import { useSettings } from '../hooks/useSettings';
import { useTimer } from '../hooks/useTimer';
import { useTasks } from '../hooks/useTasks';
import { useSessions } from '../hooks/useSessions';
import ModeSelector from '../components/ModeSelector';
import Timer from '../components/Timer';
import TimerPictureInPicture from '../components/Timer/TimerPictureInPicture';
import TaskSelector from '../components/TaskSelector';
import type { SessionType } from '../types';
import type { Settings } from '../types';
import styles from './TimerPage.module.css';

function getTotalSeconds(mode: SessionType, settings: Settings): number {
  if (mode === 'spike') return settings.spikeMinimum * 60;
  if (mode === 'short-break') return settings.shortBreakDuration * 60;
  return settings.longBreakDuration * 60;
}

export default function TimerPage() {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { sessions, addSession, completeSession, cancelSession } = useSessions();
  const { selectedTaskId, setSelectedTaskId } = useSelectedTask();

  const [interruptions, setInterruptions] = useState(0);
  const interruptionsRef = useRef(0);

  const resetInterruptions = useCallback(() => {
    interruptionsRef.current = 0;
    setInterruptions(0);
  }, []);

  const handleInterrupt = useCallback(() => {
    interruptionsRef.current += 1;
    setInterruptions(interruptionsRef.current);
  }, []);

  const handleComplete = useCallback(
    (completedMode: SessionType) => {
      // Record the completed session immediately upon completion.
      const count = completedMode === 'spike' ? interruptionsRef.current : 0;
      const session = addSession(completedMode, selectedTaskId, count);
      completeSession(session.id);
      resetInterruptions();
    },
    [addSession, completeSession, selectedTaskId, resetInterruptions],
  );

  const handleCancelled = useCallback(
    (cancelledMode: SessionType) => {
      // Log the cancelled session (never counted as completed).
      const count = cancelledMode === 'spike' ? interruptionsRef.current : 0;
      const session = addSession(cancelledMode, selectedTaskId, count);
      cancelSession(session.id);
      resetInterruptions();
    },
    [addSession, cancelSession, selectedTaskId, resetInterruptions],
  );

  const timer = useTimer({ settings, onComplete: handleComplete, onCancel: handleCancelled });

  const handleReset = useCallback(() => {
    timer.reset();
    resetInterruptions();
  }, [timer, resetInterruptions]);

  const handleSkip = useCallback(() => {
    timer.skip();
    resetInterruptions();
  }, [timer, resetInterruptions]);

  const handleChangeMode = useCallback(
    (mode: SessionType) => {
      timer.changeMode(mode);
      resetInterruptions();
    },
    [timer, resetInterruptions],
  );

  const totalSeconds = getTotalSeconds(timer.mode, settings);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const completedPomodoros = selectedTask
    ? sessions.filter(
        (session) =>
          session.taskId === selectedTask.id && session.type === 'spike' && session.completed,
      ).length
    : timer.pomodoroCount;

  return (
    <div className={styles.page}>
      <ModeSelector mode={timer.mode} onChange={handleChangeMode} />
      <Timer
        secondsLeft={timer.secondsLeft}
        totalSeconds={totalSeconds}
        isRunning={timer.isRunning}
        mode={timer.mode}
        pomodoroCount={completedPomodoros}
        estimatedSpikes={selectedTask?.estimatedSpikes}
        interruptions={interruptions}
        onInterrupt={handleInterrupt}
        onStart={timer.start}
        onPause={timer.pause}
        onCancel={timer.cancel}
        onReset={handleReset}
        onSkip={handleSkip}
      />
      <TimerPictureInPicture secondsLeft={timer.secondsLeft} />
      <TaskSelector
        tasks={tasks}
        selectedId={selectedTaskId}
        onChange={setSelectedTaskId}
      />
    </div>
  );
}
