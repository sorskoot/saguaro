---
name: manage-todo
description: List, add, start, complete, cancel or reopen tasks in the repo's `todo` file, which uses the TODO+ (VS Code extension) format. Use when asked to update the todo, tick off / mark done a task, add a todo item, or see what is left to do.
---

# Manage the `todo` file (TODO+ format)

The project's backlog is the extensionless file `todo` at the repo root, written for the
**TODO+** VS Code extension. Don't hand-edit it with Edit/sed: it is **CRLF** with 4-space
indents and every state change needs a `@done(yy-mm-dd hh:mm)` style stamp.
Use the driver instead. Paths below are relative to the repo root.

## Driver

```bash
node .claude/skills/manage-todo/todo.mjs list                      # open tasks, with line numbers
node .claude/skills/manage-todo/todo.mjs list --all                # include done / cancelled
node .claude/skills/manage-todo/todo.mjs list --project History    # filter by section
node .claude/skills/manage-todo/todo.mjs stats                     # {"open":12,"done":5,"cancelled":0}
node .claude/skills/manage-todo/todo.mjs add "Write more tests" --to General --tags high
node .claude/skills/manage-todo/todo.mjs start "Add a button to note"
node .claude/skills/manage-todo/todo.mjs done 7
node .claude/skills/manage-todo/todo.mjs cancel "Parking lot"
node .claude/skills/manage-todo/todo.mjs reopen 7
```

- A task reference is a **line number** (from `list`) or a **unique substring** (case-insensitive).
  Ambiguous or missing refs exit 1 with a one-line error.
- Line numbers shift after `add`, so re-run `list` between edits or use substrings.
- `--to` takes a section name (`General`, `History`, `Tasks`, `ADHD / AI Driven Development`);
  a `Parent/Child` suffix also works. New tasks go after the section's last task.
- `--file <path>` runs against another file; use it with a scratch copy to experiment.
- Output of a mutation is `<line>: <new line text>`.

## TODO+ format (what the driver writes)

| State | Line |
|---|---|
| open | `☐ text` |
| in progress | `☐ text @started(26-11-02 23:10)` |
| done | `✓ text @done(26-11-02 23:10)` |
| cancelled | `✘ text @cancelled(26-11-02 23:10)` |

Sections are lines ending in `:`; tasks are nested 4 spaces deeper. Other lines (e.g. `## Ideas`)
are left alone. Timestamps use local time, `yy-mm-dd hh:mm`, matching the existing entries.

## Gotchas

- `git diff todo` after a run should show only the intended lines; the driver preserves CRLF and
  the trailing newline. Don't pipe the file through tools that normalise line endings.
- `start` then `done` leaves the `@started(...)` tag in place. The extension would add `@lasted`;
  the driver doesn't.
- Git Bash `grep -c $'\r'` reports 0 on this file even though it's CRLF; check with `cat -A` or `xxd`.
- Always commit changes to `todo` only when the user asks.

## Verified

Every command above was run on a scratch copy (`--file`) and the diff against the original
contained only the expected lines, with CRLF preserved. `list` and `stats` were also run on the real file.
