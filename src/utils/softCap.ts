import type { Task } from '../types';

/** More than this many tasks out with someone else (or waiting on you) is worth a gentle note. */
export const SOFT_CAP = 3;

/** Waiting, Asking and Ready all hold part of your attention; Open and Done do not. */
export function countInPlay(tasks: readonly Task[]): number {
  return tasks.filter(
    (task) => task.state === 'waiting' || task.state === 'asking' || task.state === 'ready',
  ).length;
}

export function exceedsSoftCap(tasks: readonly Task[]): boolean {
  return countInPlay(tasks) > SOFT_CAP;
}
