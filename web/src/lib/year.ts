import type { IsoDate } from "./dates";
import type { Obligation } from "./types";

export interface MonthOfDeadlines {
  // YYYY-MM
  month: string;
  deadlines: { date: IsoDate; obligation: Obligation }[];
}

// The twelve months starting with this one, each with its deadlines in
// date order. Months without deadlines are kept, so the year has no gaps.
export function deadlinesByMonth(
  obligations: Obligation[],
  today: IsoDate,
): MonthOfDeadlines[] {
  const [year = 0, month = 1] = today.split("-").map(Number);
  const months: MonthOfDeadlines[] = Array.from({ length: 12 }, (_, i) => {
    const index = month - 1 + i;
    const y = year + Math.floor(index / 12);
    const m = (index % 12) + 1;
    return { month: `${y}-${String(m).padStart(2, "0")}`, deadlines: [] };
  });

  for (const obligation of obligations) {
    for (const date of obligation.upcomingDeadlines) {
      months
        .find((entry) => date.startsWith(entry.month))
        ?.deadlines.push({ date, obligation });
    }
  }
  for (const entry of months) {
    entry.deadlines.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.obligation.id.localeCompare(b.obligation.id),
    );
  }
  return months;
}
