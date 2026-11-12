/** Whether a Spike or break is running, readable from outside the timer page. */
let active = false;

export function setTimerActive(value: boolean): void {
  active = value;
}

export function isTimerActive(): boolean {
  return active;
}
