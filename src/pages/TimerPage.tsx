import { useCallback } from 'react';
import { useSelectedTask } from '../hooks/useSelectedTask';
import { useSettings } from '../hooks/useSettings';
import { useTimer } from '../hooks/useTimer';
import { useTasks } from '../hooks/useTasks';
import { usePomodoros } from '../hooks/usePomodoros';
import ModeSelector from '../components/ModeSelector';
import Timer from '../components/Timer';
import TaskSelector from '../components/TaskSelector';
import type { SessionType } from '../types';
import type { Settings } from '../types';
import styles from './TimerPage.module.css';

function getTotalSeconds(mode: SessionType, settings: Settings): number {
  if (mode === 'work') return settings.workDuration * 60;
  if (mode === 'short-break') return settings.shortBreakDuration * 60;
  return settings.longBreakDuration * 60;
}

export default function TimerPage() {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { addSession, completeSession } = usePomodoros();
  const { selectedTaskId, setSelectedTaskId } = useSelectedTask();

  const handleComplete = useCallback(
    (completedMode: SessionType) => {
      // Record the completed session immediately upon completion.
      const session = addSession(completedMode, selectedTaskId);
      completeSession(session.id);
    },
    [addSession, completeSession, selectedTaskId],
  );

  const timer = useTimer({ settings, onComplete: handleComplete });

  const totalSeconds = getTotalSeconds(timer.mode, settings);

  return (
    <div className={styles.page}>
      <ModeSelector mode={timer.mode} onChange={timer.changeMode} />
      <Timer
        secondsLeft={timer.secondsLeft}
        totalSeconds={totalSeconds}
        isRunning={timer.isRunning}
        mode={timer.mode}
        pomodoroCount={timer.pomodoroCount}
        onStart={timer.start}
        onPause={timer.pause}
        onReset={timer.reset}
        onSkip={timer.skip}
      />
      <TaskSelector
        tasks={tasks}
        selectedId={selectedTaskId}
        onChange={setSelectedTaskId}
      />
    </div>
  );
}
