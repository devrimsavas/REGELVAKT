// Deadlines are calendar dates without a time of day (YYYY-MM-DD), and
// "today" is today in Norway, whatever the server's own time zone is.

export type IsoDate = string;

// Today's date in Norway
export function todayInNorway(now: Date = new Date()): IsoDate {
  // sv-SE writes dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Whole days from `today` to `date`: 0 today, 1 tomorrow, negative when
// it has passed
export function daysBetween(today: IsoDate, date: IsoDate): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// A date as a Date at noon UTC, which is the same calendar day in Norway:
// for formatting with the Europe/Oslo time zone
export function dateForFormatting(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

// The language tag for formatting dates: British English writes them the
// way Norwegians read them ("Monday, 7 December 2026"), not the American
// way ("Monday, December 7, 2026")
const DATE_LOCALES = { nb: "nb-NO", en: "en-GB" } as const;

export function formatDate(
  date: IsoDate,
  locale: keyof typeof DATE_LOCALES,
  weekday: "long" | "short" = "long",
): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Europe/Oslo",
    weekday,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateForFormatting(date));
}

// "2026-12" -> "desember 2026" / "December 2026"
export function formatMonth(
  month: string,
  locale: keyof typeof DATE_LOCALES,
): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Europe/Oslo",
    month: "long",
    year: "numeric",
  }).format(dateForFormatting(`${month}-15`));
}
