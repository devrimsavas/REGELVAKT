// The deadline texts are written by hand; these tests keep them from
// drifting away from the schedules the reminders and calendars use.
// The assistant takes its dates from these texts (source [1]), so a wrong
// date here would be a wrong answer.
import { describe, expect, it } from "vitest";
import { toCompany } from "../src/mappers/companyMapper.js";
import { OBLIGATIONS } from "../src/rules/obligations.js";
import type {
  DeadlineSchedule,
  Facts,
  ObligationDefinition,
  VatTerm,
} from "../src/rules/types.js";
import {
  companyRulesSource,
  formatDateNb,
  generalRulesSource,
} from "../src/services/rulesSource.js";
import { enkAnswers, enkEnhet } from "./helpers/assessments.js";

const MONTHS_NB = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Every combination of facts the rules can be asked about
function allFacts(): Facts[] {
  const result: Facts[] = [];
  const booleans = [true, false, null];
  const vatTerms: (VatTerm | null)[] = ["bimonthly", "annual", "unknown", null];
  for (const organizationForm of ["ENK", "AS"] as const)
    for (const vatRegistered of [true, false])
      for (const vatTerm of vatTerms)
        for (const paysSalary of booleans)
          for (const expectsProfit of booleans)
            for (const expectsSalesOver50k of booleans)
              result.push({
                organizationForm,
                vatRegistered,
                windingUp: null,
                employeesHint: null,
                vatTerm,
                paysSalary,
                expectsProfit,
                expectsSalesOver50k,
              });
  return result;
}

// Every schedule an obligation can have, for any company it applies to
function schedulesOf(obligation: ObligationDefinition): DeadlineSchedule[] {
  return allFacts()
    .filter((facts) => obligation.appliesTo(facts))
    .map((facts) => obligation.schedule(facts))
    .filter((schedule) => schedule !== null);
}

const key = (month: number, day: number) => `${month}-${day}`;

// The fixed dates of the schedules, as "month-day"
function scheduleDates(schedules: DeadlineSchedule[]): Set<string> {
  const dates = new Set<string>();
  for (const schedule of schedules) {
    if (schedule.kind === "annual")
      dates.add(key(schedule.date.month, schedule.date.day));
    if (schedule.kind === "periodic")
      for (const date of schedule.dates) dates.add(key(date.month, date.day));
  }
  return dates;
}

// "10. april" in Norwegian, "10 April" in English
function datesInText(text: string, months: string[], dot: string): Set<string> {
  const pattern = new RegExp(
    `\\b(\\d{1,2})${dot} (${months.join("|")})\\b`,
    "g",
  );
  const dates = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    dates.add(key(months.indexOf(match[2] ?? "") + 1, Number(match[1])));
  }
  return dates;
}

describe("the deadline text of every obligation", () => {
  for (const obligation of OBLIGATIONS) {
    describe(obligation.id, () => {
      const schedules = schedulesOf(obligation);

      it("names exactly the schedule's dates, in both languages", () => {
        const expected = scheduleDates(schedules);
        expect(
          datesInText(obligation.deadlineText.nb, MONTHS_NB, "\\."),
        ).toEqual(expected);
        expect(datesInText(obligation.deadlineText.en, MONTHS_EN, "")).toEqual(
          expected,
        );
      });

      it("names the day of a monthly deadline", () => {
        for (const schedule of schedules) {
          if (schedule.kind !== "monthly") continue;
          expect(obligation.deadlineText.nb).toContain(
            `den ${schedule.day}. hver måned`,
          );
          expect(obligation.deadlineText.en).toMatch(
            new RegExp(`the ${schedule.day}(st|nd|rd|th) of every month`),
          );
        }
      });

      it("says who it applies to, in both languages", () => {
        expect(obligation.audience.nb.length).toBeGreaterThan(5);
        expect(obligation.audience.en.length).toBeGreaterThan(5);
      });
    });
  }

  it("covers every kind of schedule the rules use", () => {
    const kinds = new Set(OBLIGATIONS.flatMap(schedulesOf).map((s) => s.kind));
    expect(kinds).toEqual(new Set(["annual", "periodic", "monthly"]));
  });
});

describe("the rules as the assistant's source", () => {
  it("writes dates the Norwegian way", () => {
    expect(formatDateNb("2026-12-10")).toBe("10. desember 2026");
    expect(formatDateNb("2027-01-05")).toBe("5. januar 2027");
  });

  it("lists every obligation when there is no company", () => {
    const source = generalRulesSource("en");
    expect(source.url).toBeNull();
    expect(source.heading).toBe(
      "The obligations and deadlines in Regelvakt's rules",
    );
    for (const obligation of OBLIGATIONS) {
      expect(source.text).toContain(obligation.deadlineText.nb);
    }
  });

  it("gives the general rules for an organization form the rules do not cover", () => {
    const company = {
      ...toCompany(enkEnhet),
      organizationForm: "NUF",
    };
    const source = companyRulesSource(
      { id: "x", companySnapshot: company, answers: enkAnswers },
      new Date("2026-11-20T00:00:00Z"),
      "nb",
    );
    expect(source).toEqual(generalRulesSource("nb"));
  });

  it("moves a deadline on a weekend to the next business day", () => {
    // 10 April 2027 is a Saturday
    const source = companyRulesSource(
      {
        id: "x",
        companySnapshot: toCompany(enkEnhet),
        answers: enkAnswers,
      },
      new Date("2027-03-01T00:00:00Z"),
      "nb",
    );
    expect(source.text).toContain(
      "Fristene de neste tolv månedene: 12. april 2027,",
    );
  });
});
