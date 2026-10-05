import { isWithinWorkHours, msUntilNextTick, type Briefing, type ReminderPayload } from "../shared/briefing";
import { describeError, log } from "./log";
import { areRemindersPaused, areRemindersStoppedToday } from "./store";

// The repeating project reminder. A timer fires at :00 and :30 of every hour; each tick asks
// the panel for the schedule and a project check-in, and shows it only inside the person's
// work hours. The schedule comes from the clock (not "30 minutes after launch"), so it keeps
// its rhythm across restarts, and any failure just skips that tick.

export interface ReminderDeps {
  fetchReminder: () => Promise<ReminderPayload | null>;
  /** Show the check-in unless something more important is already on screen. */
  show: (briefing: Briefing) => void;
}

let timer: NodeJS.Timeout | null = null;

async function tick(deps: ReminderDeps): Promise<void> {
  try {
    if (areRemindersPaused() || areRemindersStoppedToday()) return;
    const payload = await deps.fetchReminder();
    if (!payload || !payload.enabled || payload.quiet || !payload.briefing) return;
    if (!isWithinWorkHours(new Date(), payload)) return;
    deps.show(payload.briefing);
  } catch (err) {
    log("warn", `Reminder tick failed: ${describeError(err)}`);
  }
}

/** `testIntervalMs` (development builds only) replaces the :00/:30 alignment so the flow can be tried quickly. */
export function startReminders(deps: ReminderDeps, testIntervalMs?: number): void {
  stopReminders();
  const schedule = () => {
    timer = setTimeout(() => {
      void tick(deps).finally(schedule);
    }, testIntervalMs ?? msUntilNextTick());
  };
  schedule();
}

export function stopReminders(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
