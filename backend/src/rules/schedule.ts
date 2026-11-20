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

// A deadline, and the date in the rules it comes from when it was moved
// off a weekend or a public holiday (the same date when it was not)
export interface DeadlineDetail {
  date: IsoDate;
  nominal: IsoDate;
}

// All deadlines from `from` (inclusive) up to `to` (exclusive), oldest
// first. Each date is moved to the next business day when it falls on a
// weekend or a public holiday (unless the schedule is fixed), so a deadline
// is compared after that move.
export function deadlineDetailsBetween(
  schedule: DeadlineSchedule,
  from: Date,
  to: Date,
): DeadlineDetail[] {
  const result = new Map<IsoDate, IsoDate>();

  // A deadline at the very end of a year can move into the next one,
  // so the year before `from` is included as well
  for (
    let year = from.getUTCFullYear() - 1;
    year <= to.getUTCFullYear();
    year++
  ) {
    for (const { month, day } of datesInYear(schedule)) {
      const nominal = makeDate(year, month, day);
      const deadline = schedule.fixed ? nominal : toBusinessDay(nominal);
      const date = toIsoDate(deadline);
      if (deadline >= from && deadline < to && !result.has(date)) {
        result.set(date, toIsoDate(nominal));
      }
    }
  }

  return [...result]
    .map(([date, nominal]) => ({ date, nominal }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function deadlinesBetween(
  schedule: DeadlineSchedule,
  from: Date,
  to: Date,
): IsoDate[] {
  return deadlineDetailsBetween(schedule, from, to).map(({ date }) => date);
}

function oneYearAfter(today: Date): Date {
  return makeDate(
    today.getUTCFullYear() + 1,
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  );
}

// Deadlines in the twelve months starting with `today`
export function upcomingDeadlines(
  schedule: DeadlineSchedule,
  today: Date,
): IsoDate[] {
  return deadlinesBetween(schedule, today, oneYearAfter(today));
}

// The same, with the date each one was moved from
export function upcomingDeadlineDetails(
  schedule: DeadlineSchedule,
  today: Date,
): DeadlineDetail[] {
  return deadlineDetailsBetween(schedule, today, oneYearAfter(today));
}
