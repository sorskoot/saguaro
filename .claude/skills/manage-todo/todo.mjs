#!/usr/bin/env node
// Driver for the TODO+ formatted `todo` file at the repo root.
// Usage: node .claude/skills/manage-todo/todo.mjs <cmd> [args] [--file path]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const fi = args.indexOf('--file');
let file = path.resolve(here, '../../../todo');
if (fi >= 0) { file = path.resolve(args[fi + 1]); args.splice(fi, 2); }
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };

const raw = fs.readFileSync(file, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const endsNl = raw.endsWith('\n');
const lines = raw.split(/\r?\n/);
if (endsNl) lines.pop();

const IND = 4;
const indentOf = (l) => l.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
const kind = (l) => {
  const t = l.trim();
  if (t.startsWith('☐')) return 'open';
  if (t.startsWith('✓')) return 'done';
  if (t.startsWith('✘')) return 'cancelled';
  if (/^[^@#].*:(\s+@\S+)*\s*$/.test(t) && !t.startsWith('#')) return 'project';
  return 'other';
};
const stamp = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getFullYear() % 100)}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const save = () => fs.writeFileSync(file, lines.join(eol) + (endsNl ? eol : ''), 'utf8');

// project path for each line, e.g. "TODO/General"
const paths = [];
{ const stack = [];
  lines.forEach((l, i) => {
    const k = kind(l), ind = indentOf(l);
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    paths[i] = stack.map((s) => s.name).join('/');
    if (k === 'project') stack.push({ ind, name: l.trim().replace(/:\s*(@\S+\s*)*$/, '') });
  });
}

function resolve(ref) {
  if (/^\d+$/.test(ref)) {
    const i = Number(ref) - 1;
    if (!lines[i] || !['open', 'done', 'cancelled'].includes(kind(lines[i]))) throw new Error(`line ${ref} is not a task`);
    return i;
  }
  const hits = lines.map((l, i) => [l, i]).filter(([l, i]) => ['open', 'done', 'cancelled'].includes(kind(l)) && l.toLowerCase().includes(ref.toLowerCase()));
  if (hits.length !== 1) throw new Error(`"${ref}" matched ${hits.length} tasks; use a line number`);
  return hits[0][1];
}

function setState(ref, sym, tag) {
  const i = resolve(ref);
  const m = lines[i].match(/^(\s*)[☐✓✘]\s?(.*)$/);
  let body = m[2].replace(/\s*@(done|cancelled)\([^)]*\)/g, '');
  if (tag) body += ` @${tag}(${stamp()})`;
  lines[i] = `${m[1]}${sym} ${body}`;
  save();
  console.log(`${i + 1}: ${lines[i].trim()}`);
}

const cmd = args.shift();
try {
switch (cmd) {
  case 'list': {
    const all = bool('--all');
    const proj = flag('--project');
    lines.forEach((l, i) => {
      const k = kind(l);
      if (k === 'project') { if (!proj || (paths[i] + '/' + l).toLowerCase().includes(proj.toLowerCase())) console.log(`${String(i + 1).padStart(3)}  ${l.trimEnd()}`); return; }
      if (k === 'other') return;
      if (!all && k !== 'open') return;
      if (proj && !paths[i].toLowerCase().includes(proj.toLowerCase())) return;
      console.log(`${String(i + 1).padStart(3)}  ${l.trimEnd()}`);
    });
    break;
  }
  case 'stats': {
    const c = { open: 0, done: 0, cancelled: 0 };
    lines.forEach((l) => { const k = kind(l); if (k in c) c[k]++; });
    console.log(JSON.stringify(c));
    break;
  }
  case 'add': {
    const to = flag('--to') ?? 'General';
    const tags = (flag('--tags') ?? '').split(',').filter(Boolean).map((t) => ' @' + t.replace(/^@/, '')).join('');
    const text = args.join(' ').trim();
    if (!text) throw new Error('add needs task text');
    const want = to.toLowerCase();
    const pi = lines.findIndex((l, i) => kind(l) === 'project' && (`${paths[i]}/${l.trim().replace(/:.*$/, '')}`.replace(/^\//, '').toLowerCase().endsWith(want)));
    if (pi < 0) throw new Error(`project "${to}" not found (try: list)`);
    const pind = indentOf(lines[pi]);
    // end of block = last non-blank line before indent <= pind
    let end = pi;
    for (let j = pi + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') continue;
      if (indentOf(lines[j]) <= pind) break;
      end = j;
    }
    // match indent of existing children if any, else pind+4
    const child = lines.slice(pi + 1, end + 1).find((l) => ['open', 'done', 'cancelled'].includes(kind(l)) && indentOf(l) > pind);
    const ind = child ? indentOf(child) : pind + IND;
    // insert after the last direct task child of this project, not after a nested sub-project's tasks
    let at = end;
    for (let j = end; j > pi; j--) { if (indentOf(lines[j]) === ind && ['open', 'done', 'cancelled'].includes(kind(lines[j]))) { at = j; break; } }
    lines.splice(at + 1, 0, `${' '.repeat(ind)}☐ ${text}${tags}`);
    save();
    console.log(`${at + 2}: ${lines[at + 1].trim()}`);
    break;
  }
  case 'done': setState(args[0], '✓', 'done'); break;
  case 'cancel': setState(args[0], '✘', 'cancelled'); break;
  case 'reopen': setState(args[0], '☐', null); break;
  case 'start': {
    const i = resolve(args[0]);
    if (kind(lines[i]) !== 'open') throw new Error('only open tasks can be started');
    if (!/@started\(/.test(lines[i])) lines[i] += ` @started(${stamp()})`;
    save(); console.log(`${i + 1}: ${lines[i].trim()}`);
    break;
  }
  default:
    console.log('commands: list [--all] [--project X] | stats | add "text" [--to Project] [--tags a,b] | start|done|cancel|reopen <line|substring>  [--file path]');
    process.exit(cmd ? 1 : 0);
}
} catch (e) { console.error("error: " + e.message); process.exit(1); }
