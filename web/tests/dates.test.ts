import { describe, expect, it } from "vitest";
import { daysBetween, formatDate, todayInNorway } from "@/lib/dates";

describe("dates", () => {
  it("take today as today in Norway", () => {
    // 23:30 UTC on 31 December is already 1 January in Norway
    expect(todayInNorway(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInNorway(new Date("2026-11-20T12:00:00Z"))).toBe("2026-11-20");
  });

  it("count whole days, across a change to or from summer time", () => {
    expect(daysBetween("2026-11-20", "2026-11-20")).toBe(0);
    expect(daysBetween("2026-11-20", "2026-11-21")).toBe(1);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2026-11-20", "2026-11-19")).toBe(-1);
  });
});

describe("dates as text", () => {
  it("are written the Norwegian way, and the British way in English", () => {
    expect(formatDate("2026-12-07", "nb")).toBe("mandag 7. desember 2026");
    expect(formatDate("2026-12-07", "en")).toBe("Monday, 7 December 2026");
  });
});
