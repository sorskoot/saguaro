# Saguaro

A Progressive Web App (PWA) focus timer built with React, TypeScript, and Vite.

The layout adapts to phones and tablets with scalable timer controls, touch-friendly navigation,
wrapping task and history rows, and stacked settings actions on small screens.
On the Timer page, windows at most 550px wide and 300px high show only the countdown,
centered and scaled to fit. The timer keeps running; enlarge either dimension beyond
that breakpoint to restore navigation and controls.

Tasks have a state (Open, Focus, Waiting, Asking, Ready or Done). The Tasks page groups tasks by
state and each task has one button per state. Exactly one task is the Focus; focusing another moves
the old one to Open and offers a skippable where-was-I note. A quiet note appears when more than 3
tasks are Waiting, Asking or Ready; it never blocks anything. Enable **Show done tasks** to include
done tasks, which can be reopened, edited or deleted. They remain hidden by default and in the
timer's task selector.

## Data

All data (tasks, sessions, settings, the event log and the parking lot) is stored in the browser's
IndexedDB, in a database called `saguaro`, and the app asks the browser to keep it from being evicted.
Data from before this change lived in `localStorage` and is not migrated: the app starts fresh.
Export a JSON backup from **Settings** while on the old version if you want to keep it; backups from
the old version can still be imported and are converted to the new format.

Every state change (task states, Spike and break start/end, interruptions, focus switches) is also
written to an append-only event log, so new metrics can be derived later. The event log is included
in exports and is never compacted.

## Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Building

```bash
npm run build
```

The output is written to `dist/`.

## Deployment

### GitHub Pages

The app is deployed to GitHub Pages at `/saguaro/`. Pass the base path at build time:

```bash
npm run build -- --base=/saguaro/
```

The CI/CD pipeline (`.github/workflows/deploy.yml`) runs this automatically on pushes to `main`.

The service worker is registered relative to `BASE_URL`, so it works correctly at any sub-path. See [docs/PWA.md](docs/PWA.md) for details.

### Local preview

```bash
npm run preview
```

## Project structure

```
src/
  hooks/        React hooks (useTimer, useSettings, useSessions, ...)
  services/     Domain services and repositories (TimerService, TaskRepository, EventLogRepository, ...)
  services/db/  IndexedDB layer (DataStore, CollectionStore)
  components/   Shared UI components
  pages/        Route-level page components
  utils/        Pure utility functions
  types/        Shared TypeScript types
```

## CI

Every push and pull request runs `npm ci` -> `npm run build` -> `npm test` via
`.github/workflows/ci.yml` on Node 22.
