// Runs the reminder work (services/reminderService.ts) once a day, at
// EMAIL_HOUR Norwegian time (7 by default). It checks every
// REMINDER_CHECK_MINUTES whether today's run is due, so a server started
// after that hour still runs it the same day. If the server restarts after
// a run, the day's work runs again; that is safe, since a reminder is
// never sent twice and the other steps only do what is still left.
import { logger } from "../config/logger.js";
import { runReminders } from "../services/reminderService.js";
import { todayInNorway } from "../utils/today.js";

const log = logger.child({ module: "reminders" });

const DEFAULT_HOUR = 7;
const DEFAULT_CHECK_MINUTES = 15;

function emailHour(): number {
  const hour = Number(process.env.EMAIL_HOUR);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23
    ? hour
    : DEFAULT_HOUR;
}

function checkMinutes(): number {
  const minutes = Number(process.env.REMINDER_CHECK_MINUTES);
  return Number.isInteger(minutes) && minutes > 0
    ? minutes
    : DEFAULT_CHECK_MINUTES;
}

// The hour of the day in Norway, 0-23
export function hourInNorway(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Oslo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

function dayInNorway(now: Date): string {
  return todayInNorway(now).toISOString().slice(0, 10);
}

// Whether today's run is due: the hour has come and it has not run today
export function isRunDue(now: Date, lastRunDay: string | null): boolean {
  return lastRunDay !== dayInNorway(now) && hourInNorway(now) >= emailHour();
}

let lastRunDay: string | null = null;
let timer: NodeJS.Timeout | null = null;
// The run going on, so stopping can wait for it
let currentRun: Promise<void> | null = null;

async function run(now: Date): Promise<void> {
  try {
    const summary = await runReminders(now);
    // A run skipped because another one holds the lock is not today's run;
    // the next check tries again
    if (summary !== null) lastRunDay = dayInNorway(now);
  } catch (error: unknown) {
    // Tried again at the next check
    log.error({ err: error }, "The reminder run failed");
  }
}

function checkAndRun(): void {
  const now = new Date();
  if (currentRun || !isRunDue(now, lastRunDay)) return;

  currentRun = run(now).finally(() => {
    currentRun = null;
  });
}

export function startReminderJob(): void {
  if (timer) return;
  const minutes = checkMinutes();
  log.info(
    `Reminders run daily at ${String(emailHour()).padStart(2, "0")}:00 Norwegian time (checked every ${minutes} min)`,
  );
  checkAndRun();
  // unref: the timer alone does not keep the process running
  timer = setInterval(checkAndRun, minutes * 60 * 1000);
  timer.unref();
}

// Stops the checks and waits for a run that is going on, so the server can
// shut down without cutting a run off in the middle of sending emails
export async function stopReminderJob(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  await currentRun;
}

// For tests: forget that today's run has been done
export function resetReminderJob(): void {
  lastRunDay = null;
}
