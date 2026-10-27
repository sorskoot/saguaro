# sorskoot-pomodoro

A Progressive Web App (PWA) Pomodoro timer built with React, TypeScript, and Vite.

The layout adapts to phones and tablets with scalable timer controls, touch-friendly navigation,
wrapping task and history rows, and stacked settings actions on small screens.
On the Timer page, windows at most 550px wide and 300px high show only the countdown,
centered and scaled to fit. The timer keeps running; enlarge either dimension beyond
that breakpoint to restore navigation and controls.

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

The app is deployed to GitHub Pages at `/sorskoot-pomodoro/`. Pass the base path at build time:

```bash
npm run build -- --base=/sorskoot-pomodoro/
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
  hooks/        React hooks (useTimer, useSettings, usePomodoros, ...)
  services/     Domain services and repositories (TimerService, StorageService, ...)
  components/   Shared UI components
  pages/        Route-level page components
  utils/        Pure utility functions
  types/        Shared TypeScript types
```

## CI

Every push and pull request runs `npm ci` -> `npm run build` -> `npm test` via
`.github/workflows/ci.yml` on Node 22.
