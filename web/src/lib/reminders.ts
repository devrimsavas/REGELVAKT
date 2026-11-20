// The reminder settings, as the API accepts them
export const REMINDER_DAY_OPTIONS = [30, 14, 7, 3, 1] as const;
export const DEFAULT_REMINDER_DAYS = [14, 3];

// The days ticked in a form: checkboxes named "days"
export function reminderDaysFromForm(formData: FormData): number[] {
  return formData
    .getAll("days")
    .map(Number)
    .filter((day) => (REMINDER_DAY_OPTIONS as readonly number[]).includes(day))
    .filter((day, index, days) => days.indexOf(day) === index)
    .sort((a, b) => b - a);
}

// Only catches obvious typos, like the API; the confirmation email is the
// real check
export function looksLikeEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface SubscriptionView {
  assessmentId: string;
  orgNumber: string;
  companyName: string;
  email: string;
  language: "nb" | "en";
  reminderDays: number[];
  status: "pending" | "active";
  confirmedAt: string | null;
}
