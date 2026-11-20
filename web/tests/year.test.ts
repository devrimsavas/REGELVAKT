import { describe, expect, it } from "vitest";
import { formatMonth } from "@/lib/dates";
import type { Obligation } from "@/lib/types";
import { deadlinesByMonth } from "@/lib/year";

function obligation(id: string, dates: string[]): Obligation {
  const text = { nb: id, en: id };
  return {
    id,
    title: text,
    description: text,
    reason: text,
    sourceUrl: "https://example.test",
    filingUrl: null,
    nextDeadline: dates[0] ?? null,
    upcomingDeadlines: dates,
  };
}

describe("the year ahead", () => {
  const months = deadlinesByMonth(
    [
      obligation("vat-return", ["2026-12-10", "2027-02-10"]),
      obligation("a-melding", ["2026-12-07", "2027-11-05"]),
    ],
    "2026-11-20",
  );

  it("has twelve months from this one, across the new year", () => {
    expect(months.map((m) => m.month)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
    ]);
  });

  it("puts each deadline in its month, in date order", () => {
    expect(months[1]?.deadlines.map((d) => d.date)).toEqual([
      "2026-12-07",
      "2026-12-10",
    ]);
    expect(months[0]?.deadlines).toEqual([]);
  });

  it("leaves out a deadline a year from now, past the twelfth month", () => {
    expect(
      months.flatMap((m) => m.deadlines).map((d) => d.date),
    ).not.toContain("2027-11-05");
  });

  it("names the months in the page's language", () => {
    expect(formatMonth("2026-12", "nb")).toBe("desember 2026");
    expect(formatMonth("2026-12", "en")).toBe("December 2026");
  });
});
