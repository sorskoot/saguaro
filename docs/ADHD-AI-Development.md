# ADHD-Friendly, AI-Assisted Development

Ideas for evolving the app from a classic Pomodoro timer into a tool that supports working with AI agents.

## Problem

Pomodoro assumes one task per sprint. AI-assisted development breaks that: start an agent, switch to something else while it runs, come back when it finishes. Tasks rarely end inside a single sprint; they finish in the next one or during a break.

## Principles

- The timer stays central: 25 minute sprints, 5 and 15 minute breaks.
- The app is agnostic of agents and AI tools. All state is entered manually.
- Switching is allowed, but bounded and visible.
- Re-entering a task after a switch must be cheap.
- Capturing a thought must take less than 3 seconds and never break focus.

## Task Model

- A sprint holds several tasks. Tasks carry over between sprints and breaks.
- States: **Active**, **Waiting**, **Done**.
  - Active: being worked on this sprint.
  - Waiting: blocked on something external (an agent running, a review, a build).
  - Done: finished, can complete at any time, including mid-break.
- Soft cap of 3 Active tasks (configurable). Exceeding it shows a prompt, never a block.
- Each task has:
  - **Next action**: a single line describing the very next step.
  - **Where was I**: a short note of context, written when leaving the task.

## Sprint and Break Behavior

- Switching tasks is one tap and is logged.
- A **switch counter** per sprint is shown in the timer view and stored in history.
- Breaks include a **review of Waiting tasks**: which finished, which are still blocked, what is the next action for each.
- A task finishing during a break is marked Done without starting a sprint.

## ADHD-Friendly Mechanics

- **Parking lot**: one-tap capture of intrusive thoughts and side ideas during a sprint. Reviewed during breaks, optionally promoted to tasks.
- **Next action per task**: removes the decision of what to do when returning.
- **Where was I note**: shown on switching back to a task.
- **Break-time review of Waiting tasks**: gives a natural, non-interrupting moment to pick up finished work.
- **Switch counter**: makes context switching visible without judging it.

## Metrics (History)

- Sprints per task, across days.
- Switches per sprint.
- Interruptions per task (see todo).
- Time from Waiting to Done.

## Open Questions

- Should the soft cap apply to Active only, or to Active plus Waiting?
- Does a switch pause or reset any per-task time tracking?
- How are carried-over tasks shown at the start of a new day?
- Should parking lot items persist across days?
