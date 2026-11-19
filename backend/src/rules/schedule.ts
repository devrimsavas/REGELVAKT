// Turns a deadline schedule into concrete business-day dates.
import { makeDate, toBusinessDay, toIsoDate } from "./calendar.js";
import type { DeadlineSchedule, IsoDate, MonthDay } from "./types.js";

// The nominal (unadjusted) dates of a schedule within one calendar year
function datesInYear(schedule: DeadlineSchedule): MonthDay[] {
  switch (schedule.kind) {
    case "annual":
      return [schedule.date];
    case "periodic":
      return schedule.dates;
    case "monthly":
      return Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        day: schedule.day,
      }));
  }
}

// All deadlines from `from` (inclusive) up to `to` (exclusive), oldest first.
// Each date is moved to the next business day when it falls on a weekend or
// a public holiday, so a deadline is compared after that move.
export function deadlinesBetween(
  schedule: DeadlineSchedule,
  from: Date,
  to: Date,
): IsoDate[] {
  const result: IsoDate[] = [];

  // A deadline at the very end of a year can move into the next one,
  // so the year before `from` is included as well
  for (
    let year = from.getUTCFullYear() - 1;
    year <= to.getUTCFullYear();
    year++
  ) {
    for (const { month, day } of datesInYear(schedule)) {
      const deadline = toBusinessDay(makeDate(year, month, day));
      if (deadline >= from && deadline < to) {
        result.push(toIsoDate(deadline));
      }
    }
  }

  return [...new Set(result)].sort();
}

// Deadlines in the twelve months starting with `today`
export function upcomingDeadlines(
  schedule: DeadlineSchedule,
  today: Date,
): IsoDate[] {
  const oneYearLater = makeDate(
    today.getUTCFullYear() + 1,
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  );
  return deadlinesBetween(schedule, today, oneYearLater);
}
