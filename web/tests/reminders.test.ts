import { describe, expect, it } from "vitest";
import { looksLikeEmail, reminderDaysFromForm } from "@/lib/reminders";

describe("reminder settings from a form", () => {
  it("take the ticked days, the earliest reminder first", () => {
    const form = new FormData();
    form.append("days", "3");
    form.append("days", "30");
    form.append("days", "14");
    expect(reminderDaysFromForm(form)).toEqual([30, 14, 3]);
  });

  it("leave out days the API does not offer, and repeats", () => {
    const form = new FormData();
    form.append("days", "3");
    form.append("days", "3");
    form.append("days", "2");
    form.append("days", "x");
    expect(reminderDaysFromForm(form)).toEqual([3]);
  });

  it("catch obviously wrong email addresses", () => {
    expect(looksLikeEmail("ayse@example.com")).toBe(true);
    expect(looksLikeEmail("ayse@example")).toBe(false);
    expect(looksLikeEmail("ayse example.com")).toBe(false);
    expect(looksLikeEmail(`${"a".repeat(250)}@x.no`)).toBe(false);
  });
});
