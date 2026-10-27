# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
