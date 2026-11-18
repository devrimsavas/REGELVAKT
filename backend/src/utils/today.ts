import { fromIsoDate } from "../rules/calendar.js";

// Today's date in Norway as a calendar date (UTC midnight), so deadlines
// switch at midnight Norwegian time no matter where the server runs.
export function todayInNorway(now: Date = new Date()): Date {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return fromIsoDate(isoDate);
}
