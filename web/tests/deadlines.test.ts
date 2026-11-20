import { describe, expect, it } from "vitest";
import { byNextDeadline, nextDeadlines } from "@/lib/deadlines";
import type { Obligation } from "@/lib/types";

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

describe("deadlines", () => {
  const vat = obligation("vat-return", ["2026-12-10", "2027-02-10"]);
  const aMelding = obligation("a-melding", ["2026-12-07", "2027-01-05"]);
  const aga = obligation("employer-contribution", ["2027-01-15"]);
  const bookkeeping = obligation("bookkeeping", []);

  it("are listed together, the next first, as many as asked for", () => {
    expect(
      nextDeadlines([vat, aMelding, aga, bookkeeping], 4).map(
        (row) => `${row.date} ${row.obligation.id}`,
      ),
    ).toEqual([
      "2026-12-07 a-melding",
      "2026-12-10 vat-return",
      "2027-01-05 a-melding",
      "2027-01-15 employer-contribution",
    ]);
  });

  it("on the same day keep a fixed order", () => {
    const other = obligation("advance-tax", ["2026-12-10"]);
    expect(
      nextDeadlines([vat, other], 2).map((row) => row.obligation.id),
    ).toEqual(["advance-tax", "vat-return"]);
  });

  it("order the obligations, those without one last", () => {
    expect(
      [bookkeeping, vat, aga, aMelding].sort(byNextDeadline).map((o) => o.id),
    ).toEqual(["a-melding", "vat-return", "employer-contribution", "bookkeeping"]);
  });
});
