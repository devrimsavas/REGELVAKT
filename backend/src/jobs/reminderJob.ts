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

// Whether today's run is due: the hour has come and it has not run today
export function isRunDue(now: Date, lastRunDay: string | null): boolean {
  const today = todayInNorway(now).toISOString().slice(0, 10);
  return lastRunDay !== today && hourInNorway(now) >= emailHour();
}

let lastRunDay: string | null = null;
let isRunning = false;

async function checkAndRun(): Promise<void> {
  const now = new Date();
  if (isRunning || !isRunDue(now, lastRunDay)) return;

  isRunning = true;
  try {
    await runReminders(now);
    lastRunDay = todayInNorway(now).toISOString().slice(0, 10);
  } catch (error: unknown) {
    // Tried again at the next check
    log.error({ err: error }, "The reminder run failed");
  } finally {
    isRunning = false;
  }
}

export function startReminderJob(): void {
  const minutes = checkMinutes();
  log.info(
    `Reminders run daily at ${String(emailHour()).padStart(2, "0")}:00 Norwegian time (checked every ${minutes} min)`,
  );
  void checkAndRun();
  // unref: the timer alone does not keep the process running
  setInterval(() => void checkAndRun(), minutes * 60 * 1000).unref();
}
