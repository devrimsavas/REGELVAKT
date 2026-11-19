import { describe, expect, it } from "vitest";
import {
  easterSunday,
  fromIsoDate,
  isBusinessDay,
  norwegianPublicHolidays,
  toBusinessDay,
  toIsoDate,
} from "../src/rules/calendar.js";

const businessDay = (value: string) =>
  toIsoDate(toBusinessDay(fromIsoDate(value)));

describe("easterSunday", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
  ])("finds Easter Sunday %i", (year, expected) => {
    expect(toIsoDate(easterSunday(year))).toBe(expected);
  });
});

describe("norwegianPublicHolidays", () => {
  it("lists all twelve holidays of 2026", () => {
    expect([...norwegianPublicHolidays(2026)].sort()).toEqual([
      "2026-01-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-05",
      "2026-04-06",
      "2026-05-01",
      "2026-05-14",
      "2026-05-17",
      "2026-05-24",
      "2026-05-25",
      "2026-12-25",
      "2026-12-26",
    ]);
  });
});

describe("isBusinessDay", () => {
  it("is true on an ordinary weekday", () => {
    expect(isBusinessDay(fromIsoDate("2026-11-18"))).toBe(true);
  });

  it("is false on weekends and holidays", () => {
    expect(isBusinessDay(fromIsoDate("2026-11-21"))).toBe(false); // Saturday
    expect(isBusinessDay(fromIsoDate("2026-11-22"))).toBe(false); // Sunday
    expect(isBusinessDay(fromIsoDate("2026-05-17"))).toBe(false);
  });
});

describe("toBusinessDay", () => {
  it("keeps a deadline that is already a business day", () => {
    expect(businessDay("2026-06-10")).toBe("2026-06-10");
  });

  it("moves a Sunday deadline to Monday", () => {
    expect(businessDay("2026-05-31")).toBe("2026-06-01");
  });

  it("moves past Easter until the first business day", () => {
    // Skjærtorsdag, Langfredag, the weekend and 2. påskedag are all closed
    expect(businessDay("2026-04-02")).toBe("2026-04-07");
  });

  it("moves across the new year", () => {
    // 1 January 2028 is a Saturday
    expect(businessDay("2027-12-31")).toBe("2027-12-31");
    expect(businessDay("2028-01-01")).toBe("2028-01-03");
  });
});

describe("fromIsoDate", () => {
  it("rejects dates that do not exist", () => {
    expect(() => fromIsoDate("2026-02-30")).toThrow();
    expect(() => fromIsoDate("18.11.2026")).toThrow();
  });
});
