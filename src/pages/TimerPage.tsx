import { useCallback, useRef, useState } from 'react';
import { useSelectedTask } from '../hooks/useSelectedTask';
import { useSettings } from '../hooks/useSettings';
import { useTimer } from '../hooks/useTimer';
import type { BreakType, SpikeEndInfo } from '../hooks/useTimer';
import { useTasks } from '../hooks/useTasks';
import { useSessions } from '../hooks/useSessions';
import Timer from '../components/Timer';
import TimerPictureInPicture from '../components/Timer/TimerPictureInPicture';
import TaskSelector from '../components/TaskSelector';
import { logEvent } from '../services/eventLog';
import styles from './TimerPage.module.css';

export default function TimerPage() {
  const { settings } = useSettings();
  const { tasks } = useTasks();
  const { sessions, addSession, completeSession, cancelSession } = useSessions();
  const { selectedTaskId, setSelectedTaskId } = useSelectedTask();

  const [interruptions, setInterruptions] = useState(0);
  const interruptionsRef = useRef(0);
  // The Spike and break that are running, so what happens next is recorded against them.
  const spikeSessionIdRef = useRef<string | null>(null);
  const breakSessionIdRef = useRef<string | null>(null);

  const resetInterruptions = useCallback(() => {
    interruptionsRef.current = 0;
    setInterruptions(0);
  }, []);

  const handleInterrupt = useCallback(() => {
    interruptionsRef.current += 1;
    setInterruptions(interruptionsRef.current);
    logEvent({
      type: 'interruption',
      sessionId: spikeSessionIdRef.current,
      taskId: selectedTaskId,
    });
  }, [selectedTaskId]);

  const handleSpikeStart = useCallback(() => {
    resetInterruptions();
    spikeSessionIdRef.current = addSession('spike', selectedTaskId).id;
  }, [addSession, selectedTaskId, resetInterruptions]);

  const handleSpikeEnd = useCallback(
    ({ endedEarly, overtimeSeconds }: SpikeEndInfo) => {
      const id = spikeSessionIdRef.current;
      if (id) {
        completeSession(id, {
          endedEarly,
          overtimeSeconds,
          interruptions: interruptionsRef.current,
        });
      }
      spikeSessionIdRef.current = null;
      resetInterruptions();
    },
    [completeSession, resetInterruptions],
  );

  const handleSpikeCancel = useCallback(() => {
    const id = spikeSessionIdRef.current;
    if (id) cancelSession(id, { interruptions: interruptionsRef.current });
    spikeSessionIdRef.current = null;
    resetInterruptions();
  }, [cancelSession, resetInterruptions]);

  const handleBreakStart = useCallback(
    (breakType: BreakType) => {
      breakSessionIdRef.current = addSession(breakType, selectedTaskId).id;
    },
    [addSession, selectedTaskId],
  );

  const handleBreakEnd = useCallback(
    ({ overrunSeconds }: { overrunSeconds: number }) => {
      const id = breakSessionIdRef.current;
      if (id) {
        completeSession(id, { breakOverrunSeconds: overrunSeconds });
      }
      breakSessionIdRef.current = null;
    },
    [completeSession],
  );

  const timer = useTimer({
    settings,
    onSpikeStart: handleSpikeStart,
    onSpikeEnd: handleSpikeEnd,
    onSpikeCancel: handleSpikeCancel,
    onBreakStart: handleBreakStart,
    onBreakEnd: handleBreakEnd,
  });

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  // Task-scoped counts only make sense against an estimate; otherwise the circles
  // show the timer's own 4-Spike cycle, which must not change when switching tasks.
  const completedSpikes = selectedTask?.estimatedSpikes !== undefined
    ? sessions.filter(
        (session) =>
          session.taskId === selectedTask.id && session.type === 'spike' && session.completed,
      ).length
    : timer.spikeCount;
  const overtimeShown = timer.phase === 'spike' && timer.secondsLeft === 0;

  return (
    <div className={styles.page}>
      <Timer
        phase={timer.phase}
        mode={timer.mode}
        secondsLeft={timer.secondsLeft}
        totalSeconds={timer.totalSeconds}
        overtimeSeconds={timer.overtimeSeconds}
        spikeCount={completedSpikes}
        estimatedSpikes={selectedTask?.estimatedSpikes}
        interruptions={interruptions}
        onInterrupt={handleInterrupt}
        onStart={timer.start}
        onEndSpike={timer.endSpike}
        onCancel={timer.cancel}
        onSkipBreak={timer.skipBreak}
      />
      <TimerPictureInPicture
        secondsLeft={timer.secondsLeft}
        overtimeSeconds={overtimeShown ? timer.overtimeSeconds : undefined}
        label={timer.mode === 'spike' ? 'Spike' : 'Break'}
      />
      <TaskSelector
        tasks={tasks}
        selectedId={selectedTaskId}
        onChange={setSelectedTaskId}
      />
    </div>
  );
}
