import type { IsoDate } from "./dates";
import type { Obligation } from "./types";

// The coming deadlines of all obligations together, the next one first.
// Two on the same day keep a fixed order (by obligation id).
export function nextDeadlines(
  obligations: Obligation[],
  count: number,
): { date: IsoDate; obligation: Obligation }[] {
  return obligations
    .flatMap((obligation) =>
      obligation.upcomingDeadlines.map((date) => ({ date, obligation })),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.obligation.id.localeCompare(b.obligation.id),
    )
    .slice(0, count);
}

// The obligations by their next deadline; those without one (bookkeeping)
// last
export function byNextDeadline(a: Obligation, b: Obligation): number {
  if (a.nextDeadline === b.nextDeadline) return 0;
  if (a.nextDeadline === null) return 1;
  if (b.nextDeadline === null) return -1;
  return a.nextDeadline.localeCompare(b.nextDeadline);
}
