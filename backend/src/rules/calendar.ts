// Calendar helpers for deadlines. Dates are handled as UTC midnight so the
// server's time zone can never shift a deadline by a day.
import type { IsoDate } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(value: IsoDate): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || toIsoDate(date) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Easter Sunday in the Gregorian calendar (the "Anonymous Gregorian" method)
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDate(year, month, day);
}

// Norwegian public holidays (helligdager) of a year, as YYYY-MM-DD
export function norwegianPublicHolidays(year: number): Set<IsoDate> {
  const easter = easterSunday(year);

  return new Set(
    [
      makeDate(year, 1, 1), // Nyttårsdag
      addDays(easter, -3), // Skjærtorsdag
      addDays(easter, -2), // Langfredag
      easter, // 1. påskedag
      addDays(easter, 1), // 2. påskedag
      makeDate(year, 5, 1), // Offentlig høytidsdag
      makeDate(year, 5, 17), // Grunnlovsdag
      addDays(easter, 39), // Kristi himmelfartsdag
      addDays(easter, 49), // 1. pinsedag
      addDays(easter, 50), // 2. pinsedag
      makeDate(year, 12, 25), // 1. juledag
      makeDate(year, 12, 26), // 2. juledag
    ].map(toIsoDate),
  );
}

// Holidays are computed once per year and reused
const holidayCache = new Map<number, Set<IsoDate>>();

function holidaysOf(year: number): Set<IsoDate> {
  let holidays = holidayCache.get(year);
  if (holidays === undefined) {
    holidays = norwegianPublicHolidays(year);
    holidayCache.set(year, holidays);
  }
  return holidays;
}

export function isBusinessDay(date: Date): boolean {
  const weekday = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (weekday === 0 || weekday === 6) {
    return false;
  }
  return !holidaysOf(date.getUTCFullYear()).has(toIsoDate(date));
}

// A deadline on a weekend or public holiday moves to the next business day
export function toBusinessDay(date: Date): Date {
  let result = date;
  while (!isBusinessDay(result)) {
    result = addDays(result, 1);
  }
  return result;
}
