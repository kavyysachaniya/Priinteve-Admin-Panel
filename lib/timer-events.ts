// Browser event that tells timer widgets (the header chip, timer tabs) to refetch at once
// instead of waiting for their next poll. Fire it after any start/pause/resume/stop.
export const TIMER_CHANGED_EVENT = "timer-changed";

export function notifyTimerChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TIMER_CHANGED_EVENT));
}
