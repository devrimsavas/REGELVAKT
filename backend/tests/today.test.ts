import { describe, expect, it } from "vitest";
import { toIsoDate } from "../src/rules/calendar.js";
import { todayInNorway } from "../src/utils/today.js";

describe("todayInNorway", () => {
  it("uses the Norwegian date, not the UTC date", () => {
    // 23:30 UTC on 31 December is already 1 January in Norway
    expect(toIsoDate(todayInNorway(new Date("2026-12-31T23:30:00Z")))).toBe(
      "2027-01-01",
    );
    expect(toIsoDate(todayInNorway(new Date("2026-11-18T10:00:00Z")))).toBe(
      "2026-11-18",
    );
  });
});
