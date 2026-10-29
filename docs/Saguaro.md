# Saguaro

How the Pomodoro app turns into **Saguaro**: a focus timer that works well alongside AI agents, and just as well without them.

This replaces `ADHD-AI-Development.md`.

## Why

Classic Pomodoro assumes one task per sprint and a hard stop. That fits poorly in two situations:

- **Working with AI agents.** You start an agent, switch to something else while it runs, and come back when it's done. Tasks finish mid-break or two sprints later.
- **Attention that doesn't follow the clock.** The bell at minute 25 often breaks focus that took 20 minutes to build. Re-entering a task costs more than staying on it.

Saguaro is designed for attention that is hard to start, easy to lose, and sometimes deep. The app never names a condition or labels the user. It just behaves kindly.

## Principles

- Protect focus. Nothing interrupts a Spike: no sounds, no toasts, no required actions.
- Re-entry must be cheap. Every task remembers what was next and where you were.
- Capturing a thought takes under 3 seconds and never leaves the current context.
- Switching is allowed, logged, and never judged in the moment.
- Rest is rest. Breaks don't show work.
- Useful for anything: code, writing, chores, studying. AI features stay hidden until a bridge is paired.
- Offline-first. The PWA owns all data and works fully without the bridge.

## Vocabulary

The theme is a light touch. **Spike** is the only themed term; everything else uses plain words.

| Old            | Saguaro         |
| -------------- | --------------- |
| Pomodoro       | Spike           |
| Short break    | Short break     |
| Long break     | Long break      |
| Est. pomodoros | Est. Spikes     |

The cactus theme lives in the visuals (see [Growth](#growth)).

## The Spike

- **25 minutes is a minimum, not a limit.** At 25:00 the ring completes and the clock keeps counting up silently (`+3:12`).
- **No sound when a Spike reaches 25 minutes.** Nothing changes except the ring quietly filling.
- **No action is needed to continue.** Overtime just happens.
- **You end it.** The button reads *End early* before 25:00 (the Spike counts as partial) and *Take a break* after.
- **No cues during long overtime.** No hydration hints, no color shifts. You decide when to stop.

## Breaks

- Fixed lengths: **5 min** short, **15 min** long, with a long break after every **4 Spikes**. They don't scale with Spike length.
- **A break is a rest screen.** It shows no tasks, agent updates or parking lot. Breaks must not encourage work.
- Agent events and captures that arrive during a break are held back until it ends.
- When the break is up, a **soft chime** plays. This is the only sound in the app, and it can be turned off. The rest screen becomes Re-entry.
- Breaks can run over silently, just as Spikes do.
- *After v1:* suggested break activities on the rest screen (stretch, walk, water, look outside).

## Re-entry

Shown when a break ends and before the next Spike starts:

1. **What happened**: tasks that became *Ready* or *Asking*, with their one-line summaries.
2. **Parking lot**: new items, each with one-tap *Make task* or *Dismiss*.
3. **Next Spike**: the suggested Focus task, its *next action* and *where was I* note, and a **Start** button.

Everything here is optional. Start is always one tap away.

## Morning pick

The first time the app opens each day, it shows the open tasks with their *where was I* notes. You tap the one to Focus on first. One decision, no planning ritual. The other tasks stay in the list as they were.

## Tasks

### States

| State      | Meaning                                                         |
| ---------- | --------------------------------------------------------------- |
| **Focus**  | You're on it. The current Spike is about this task.             |
| **Waiting**| Someone or something else is on it: an agent, a colleague, the oven. |
| **Asking** | It needs your input to continue.                                |
| **Ready**  | Handed back to you; check the result.                           |
| **Done**   | Finished. Can happen any time, including during a break.        |

- With the bridge, agents set these states. Without it, you set them by hand. It's the same model either way.
- **Exactly one Focus task.** Switching Focus is one tap and is logged.
- **Soft cap of 3** on Waiting + Asking + Ready. Above it, a gentle note appears. It never blocks anything.
- Done replaces today's *archived* flag.

### Fields

- **Name**, **color** (as today).
- **Est. Spikes**: optional, blank by default.
- **Next action**: one line, the very next physical step.
- **Where was I**: a short context note, written when leaving the task (by you or an agent), and shown when coming back.
- **Summary**: one line from whoever last changed the state ("tests pass, PR ready for review").
- **Code**: a short handle like `#k3`, used to link agents to a task. Shown only once a bridge has been paired.

## Parking lot

- Text-only capture of side thoughts during a Spike: a global keyboard shortcut, a button in the Picture-in-Picture timer, or an agent via MCP.
- Items persist across days until they're promoted to a task or dismissed.
- They appear only at Re-entry, never during a Spike or a break.

## Growth

The reward for focus is visual, not numeric:

- Each completed Spike adds to **today's saguaro**.
- Every extra 5 minutes of overtime adds a spine or a flower.
- Tasks show the Spikes spent on them as small spines.

## History and metrics

Keep as much as possible; any metric might help with self-improvement. Store a raw **event log** (Spike start/end, switches, state changes, captures, bridge events) so new metrics can be derived later without changing what is recorded.

Shown in v1:

- Spikes per task, across days
- Overtime minutes per Spike and per day
- Switches per Spike (History only, never live on the timer)
- Time from Waiting to Ready per task
- Partial Spikes (ended early)
- Break overrun
- Parking lot captures per Spike, and how many were promoted vs dismissed

## The bridge

A small Node.js tool that connects AI agents on your machine to the Saguaro PWA in the browser.

```
Agent (Claude Code, …) ──MCP stdio──▶ saguaro-bridge ◀──WebSocket── Saguaro PWA (GitHub Pages)
Claude Code hook ──CLI──────────────▶       │
                                      127.0.0.1 only
```

### Shape

- One npm package, `saguaro-bridge`, living in this repo under `/bridge` as an npm workspace. Message types are shared with the app in a single `protocol.ts`.
- **MCP stdio server** for agents.
- **Hook CLI** for reliable signals that don't depend on the agent deciding to call a tool, e.g. a Claude Code `Stop` hook running `saguaro notify --task k3 --status ready --summary "…"`.
- **WebSocket server** on `127.0.0.1`. The PWA connects to it as a client.

### Data ownership

- The PWA is the source of truth.
- The bridge keeps no state, except a small queue of events received while the app is closed. The queue is replayed on reconnect.

### MCP tools (v1)

| Tool                 | Does                                                           |
| -------------------- | -------------------------------------------------------------- |
| `get_current_task`   | Returns the Focus task (or a given code) with next action and where-was-I. |
| `set_task_status`    | Sets Waiting / Asking / Ready / Done, with an optional one-line summary. |
| `set_where_was_i`    | Writes the re-entry note when the agent stops.                 |
| `add_to_parking_lot` | Captures a side finding without derailing the user.            |

### Linking

Agents are linked by **task code**. You tell the agent "working on #k3", or set it in the hook config or an env var. Events never guess a target.

### Security

- Listens on `127.0.0.1` only.
- Checks the `Origin` header against the GitHub Pages URL (plus `localhost` for dev).
- **One-time pairing**: the bridge prints a code, and you paste it into Settings once. Unpaired connections are rejected.
- Chrome's local network access permission prompt is expected on first connect. Document it in the setup guide.

### Surfacing agent events

- **During a Spike**: the task's state changes and a quiet dot appears in the task list and the Picture-in-Picture timer. No sound, no toast.
- **During a break**: held back until Re-entry.

## Settings changes

- Remove `autoStartBreaks` and `autoStartPomodoros`. Spikes end only by choice, and the next Spike starts from Re-entry.
- Replace `soundEnabled` with `breakEndChime`.
- Rename `workDuration` to `spikeMinimum` (default 25).
- Add bridge pairing (hidden behind a *Connect an agent bridge* link until it's used).
- Add the parking lot shortcut.

## Rename and rollout

- Rename the app, manifest, icons and page title to **Saguaro**, and the package name from `sorskoot-pomodoro` to `saguaro`.
- **Fresh start**: new storage keys, no migration of the old data.
- **One release.** Everything in this doc ships together; there are no intermediate phases.

## Decided defaults (revisit if wrong)

- *Asking* and *Ready* both count toward the soft cap.
- A Spike ended early still counts toward the 4-Spike long-break cycle.
- The global capture shortcut is `Ctrl/Cmd+Shift+Space` while the app or its Picture-in-Picture window has focus. Browsers can't register true OS-wide shortcuts.
