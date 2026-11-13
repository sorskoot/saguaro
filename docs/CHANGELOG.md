# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added (data model and event log)

- Task states: `Task.state` (open, focus, waiting, asking, ready, done) replaces
  `archived`. New tasks start Open; Done tasks are hidden like archived ones were.
- New task fields `nextAction`, `whereWasI`, `summary` and `code`. `estimatedSpikes`
  (renamed from `estimatedPomodoros`) is now optional and blank by default.
- Session fields `overtimeSeconds`, `endedEarly` and `breakOverrunSeconds`; the session
  type `'work'` is now `'spike'`.
- Append-only event log (`EventLogRepository`) written on task creation and state
  changes, Spike and break start/end, interruptions and focus switches.
- `ParkingLotRepository` and the `ParkingLotItem` type (capture UI comes later).
- Settings: `spikeMinimum` (was `workDuration`), `breakEndChime` (was `soundEnabled`)
  and `bridgePairingCode`.
- Backup format 2.0 covers tasks, sessions, settings, events and the parking lot.
  Version 1 backups can still be imported and are converted.

### Changed (data model and event log)

- All data now lives in IndexedDB (database `saguaro`) behind the repositories, with a
  persistent-storage request. The old `saguaro_*` localStorage keys are not migrated.
- The chime now plays only when a break ends. Nothing sounds when a Spike ends.
- Clear all data also deletes the IndexedDB data and the event log.
- After a successful import the page reloads.

### Removed (data model and event log)

- The `autoStartBreaks` and `autoStartPomodoros` settings and the auto-start behaviour:
  the next session always starts by choice.

### Added (focus loop)

- A Spike no longer ends on its own. At the minimum the ring fills silently and the
  clock keeps counting up (`+3:12`). The button reads *End early* before the minimum
  (a partial Spike) and *Take a break* after. Cancel is still there, with
  confirmation.
- Breaks are a rest screen: a fixed-length countdown with no tasks or Spike circles
  and a *Skip break* button. One soft chime plays when the break is up (the only
  sound, controlled by `breakEndChime`); the clock then keeps counting the overrun
  silently.
- Re-entry screen after each break: tasks that are Ready or Asking with their
  summaries, parking-lot items with one-tap *Make task* / *Dismiss*, and the next
  Spike's task with its next action and where-was-I note. Start is always one tap
  away; *Not now* returns to the idle timer.
- Morning pick on the first open of each day (a day starts at 04:00 local time): the
  open tasks with their notes; tapping one makes it the selected task.
- Next action and where-was-I inputs in the task form; the next action shows on the
  task row.
- Session records now carry `overtimeSeconds`, `endedEarly` and `breakOverrunSeconds`,
  and the Spike's interruption count.

### Changed (focus loop)

- `useTimer` is now a phase machine (`idle`, `spike`, `break`, `reentry`). Time is
  derived from timestamps; the timer worker only reports elapsed seconds.
- The Spike session is created when the Spike starts, so `spike-start` is logged at
  the real start time and interruptions carry the running Spike's session id.
- The floating timer shows `+m:ss` during overtime and labels breaks.
- Long breaks come after every fourth Spike, partial ones included.

### Removed (focus loop)

- The mode tabs, Reset and Skip buttons, and Pause: a Spike is ended or cancelled, a
  break is skipped.
- The "session completed" notification and the notification permission prompt.

### Added (parking lot)

- Capture a thought in a few seconds: `Ctrl/Cmd+Shift+Space` opens a one-line field in the
  main window or in the floating timer window; Enter saves and closes it, Escape closes
  without saving. No confirmation and no toast, so the screen looks the same afterwards.
- A **+ Thought** button in the floating timer window opens the same field there.
- Each capture logs a `capture` event, linked to the running Spike when there is one.
- A plain parking-lot list on the Tasks page (never on screen during a Spike or break)
  with *Make task* / *Dismiss*, so thoughts can be cleared without waiting for Re-entry.
  Open lists refresh when a new thought is captured.

### Added (task states UI)

- The Tasks page groups tasks by state (Focus, Asking, Ready, Waiting, Open, Done;
  empty groups are hidden). Every task has a button per state, so changing a state is
  one tap. Done still asks first and can be reopened from **Show done tasks**.
- Exactly one Focus task. Focusing a task moves the previous Focus to Open and logs the
  state changes and one `focus-switch`; leaving Focus without picking another task is
  logged as a switch to nothing.
- A gentle, non-blocking note when more than 3 tasks are Waiting, Asking or Ready.
- A skippable where-was-I prompt on the Tasks page when you leave Focus (not on the
  timer page, so it never interrupts a Spike).
- A task's summary shows under its name; its short code (`#k3`) shows only once a
  bridge is paired.

### Changed (task states UI)

- Focus is now a task state owned by `useTasks` (`focusTaskId`, `setFocus`). The
  separate `useSelectedTask` value is gone, along with its `saguaro:selectedTaskId`
  localStorage key.
- Clicking a task row no longer selects it; use its **Focus** button. A new task takes
  Focus only when no task has it.
- Changing a task's state by hand drops its old summary.

### Fixed

- `useTimer`: `advanceMode` now uses `tickRef` to call the live `tick` function,
  preventing `undefined` being passed to `timerService.start` when auto-start is
  enabled.
- `StorageService.get`: errors are now logged instead of silently swallowed.

### Changed

- `StorageService.set`: now catches `JSON.stringify` failures (circular
  references) and `localStorage` quota/security errors and logs them.
- `src/pwa.ts`: `PWA_BASE_PATH` is now derived from `import.meta.env.BASE_URL`
  with trailing-slash normalization, replacing the hard-coded
  `/sorskoot-pomodoro/` value.

### Added

- Timer circles match the selected task's estimated Pomodoros and fill using its
  completed work sessions. Without a task, the existing four-circle cycle remains.

- `.github/workflows/ci.yml`: CI workflow running `npm ci`, `npm run build`, and
  `npm test` on Node 22 for every push and pull request.
