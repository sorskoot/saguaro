import type { TaskDetails } from '../types';

/** Longest task name; a longer thought keeps its full text in the description. */
export const TASK_NAME_MAX = 80;

/** Name and details for a task made from a parking-lot thought. */
export function taskFromThought(text: string): { name: string; details?: TaskDetails } {
  const trimmed = text.trim();
  return {
    name: trimmed.slice(0, TASK_NAME_MAX),
    details: trimmed.length > TASK_NAME_MAX ? { description: trimmed } : undefined,
  };
}
