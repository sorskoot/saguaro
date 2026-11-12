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
