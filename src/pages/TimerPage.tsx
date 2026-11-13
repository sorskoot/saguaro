import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTimer } from '../hooks/useTimer';
import type { BreakType, SpikeEndInfo } from '../hooks/useTimer';
import { useTasks } from '../hooks/useTasks';
import { useSessions } from '../hooks/useSessions';
import Timer from '../components/Timer';
import TimerPictureInPicture from '../components/Timer/TimerPictureInPicture';
import TaskSelector from '../components/TaskSelector';
import ReEntry from '../components/ReEntry';
import { useParkingLot } from '../hooks/useParkingLot';
import { DEFAULT_TASK_COLOR } from '../types';
import type { ParkingLotItem, Task } from '../types';
import { logEvent } from '../services/eventLog';
import { setActiveSpikeSessionId } from '../services/parkingLotCapture';
import styles from './TimerPage.module.css';

const TASK_NAME_MAX = 80;

interface ReEntryContainerProps {
  tasks: Task[];
  addTask: ReturnType<typeof useTasks>['addTask'];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onStart: () => void;
  onNotNow: () => void;
}

/** Reads the parking lot when Re-entry appears, so it shows everything captured so far. */
function ReEntryContainer({
  tasks,
  addTask,
  selectedTaskId,
  onSelectTask,
  onStart,
  onNotNow,
}: ReEntryContainerProps) {
  const { items, resolveItem } = useParkingLot();

  const handleMakeTask = (item: ParkingLotItem) => {
    const text = item.text.trim();
    const task = addTask(
      text.slice(0, TASK_NAME_MAX),
      DEFAULT_TASK_COLOR,
      undefined,
      text.length > TASK_NAME_MAX ? { description: text } : undefined,
    );
    resolveItem(item.id, 'promoted', task.id);
  };

  return (
    <ReEntry
      tasks={tasks}
      selectedTaskId={selectedTaskId}
      onSelectTask={onSelectTask}
      parkingItems={items}
      onMakeTask={handleMakeTask}
      onDismissItem={(item) => resolveItem(item.id, 'dismissed')}
      onStart={onStart}
      onNotNow={onNotNow}
    />
  );
}

export default function TimerPage() {
  const { settings } = useSettings();
  const { tasks, addTask, focusTaskId: selectedTaskId, setFocus: setSelectedTaskId } = useTasks();
  const { sessions, addSession, completeSession, cancelSession } = useSessions();

  const [interruptions, setInterruptions] = useState(0);
  const interruptionsRef = useRef(0);
  // The Spike and break that are running, so what happens next is recorded against them.
  const spikeSessionIdRef = useRef<string | null>(null);
  const breakSessionIdRef = useRef<string | null>(null);

  // A thought captured after leaving this page is no longer tied to a Spike.
  useEffect(() => () => setActiveSpikeSessionId(null), []);

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
    setActiveSpikeSessionId(spikeSessionIdRef.current);
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
      setActiveSpikeSessionId(null);
      resetInterruptions();
    },
    [completeSession, resetInterruptions],
  );

  const handleSpikeCancel = useCallback(() => {
    const id = spikeSessionIdRef.current;
    if (id) cancelSession(id, { interruptions: interruptionsRef.current });
    spikeSessionIdRef.current = null;
    setActiveSpikeSessionId(null);
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
  // Breaks are a rest screen: no tasks, no agent state, no parking lot.
  const resting = timer.phase === 'break';
  const overtimeShown =
    (timer.phase === 'spike' && timer.secondsLeft === 0) || timer.phase === 'reentry';

  const floatingTimer = (
    <TimerPictureInPicture
      secondsLeft={timer.secondsLeft}
      overtimeSeconds={overtimeShown ? timer.overtimeSeconds : undefined}
      label={timer.mode === 'spike' ? 'Spike' : 'Break'}
    />
  );

  if (timer.phase === 'reentry') {
    return (
      <div className={styles.page}>
        <ReEntryContainer
          tasks={tasks}
          addTask={addTask}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onStart={timer.start}
          onNotNow={timer.dismissReentry}
        />
        {floatingTimer}
      </div>
    );
  }

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
      {floatingTimer}
      {!resting && (
        <TaskSelector
          tasks={tasks}
          selectedId={selectedTaskId}
          onChange={setSelectedTaskId}
        />
      )}
    </div>
  );
}
