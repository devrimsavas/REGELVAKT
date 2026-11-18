import { describe, expect, it } from "vitest";
import { fromIsoDate, makeDate } from "../src/rules/calendar.js";
import { OBLIGATIONS } from "../src/rules/obligations.js";
import { QUESTIONS } from "../src/rules/questions.js";
import { deadlinesBetween, upcomingDeadlines } from "../src/rules/schedule.js";
import type { CompanyFacts, Facts } from "../src/rules/types.js";
import { WARNINGS } from "../src/rules/warnings.js";

const enk: CompanyFacts = {
  organizationForm: "ENK",
  vatRegistered: true,
  employeesHint: null,
};
const as: CompanyFacts = {
  organizationForm: "AS",
  vatRegistered: false,
  employeesHint: null,
};

const facts = (company: CompanyFacts, answers: Partial<Facts> = {}): Facts => ({
  ...company,
  vatTerm: null,
  expectsSalesOver50k: null,
  paysSalary: null,
  expectsProfit: null,
  ...answers,
});

const obligation = (id: string) => {
  const found = OBLIGATIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown obligation ${id}`);
  return found;
};

const appliesIds = (f: Facts) =>
  OBLIGATIONS.filter((item) => item.appliesTo(f)).map((item) => item.id);

// Every deadline in 2026 for one obligation
const in2026 = (id: string, f: Facts) => {
  const schedule = obligation(id).schedule(f);
  if (!schedule) throw new Error(`${id} has no schedule`);
  return deadlinesBetween(schedule, makeDate(2026, 1, 1), makeDate(2027, 1, 1));
};

describe("questions", () => {
  const asked = (company: CompanyFacts) =>
    QUESTIONS.filter((q) => q.askWhen(company)).map((q) => q.id);

  it("asks a VAT registered ENK about the VAT term, salaries and profit", () => {
    expect(asked(enk)).toEqual(["vatTerm", "paysSalary", "expectsProfit"]);
  });

  it("asks an AS without VAT about expected sales and salaries", () => {
    expect(asked(as)).toEqual(["expectsSalesOver50k", "paysSalary"]);
  });

  it("has unique ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("which obligations apply", () => {
  it("ENK with VAT, profit and no employees", () => {
    expect(
      appliesIds(facts(enk, { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true })),
    ).toEqual(["tax-return-enk", "advance-tax-enk", "vat-return", "bookkeeping"]);
  });

  it("ENK without profit pays no advance tax", () => {
    expect(appliesIds(facts(enk, { expectsProfit: false }))).not.toContain(
      "advance-tax-enk",
    );
  });

  it("AS without VAT that pays salaries", () => {
    expect(appliesIds(facts(as, { paysSalary: true }))).toEqual([
      "tax-return-company",
      "advance-tax-company",
      "a-melding",
      "employer-contribution",
      "shareholder-register",
      "general-meeting",
      "annual-accounts",
      "bookkeeping",
    ]);
  });

  it("every obligation has a source and texts in both languages", () => {
    for (const item of OBLIGATIONS) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.title.nb && item.title.en).toBeTruthy();
      expect(item.description.nb && item.description.en).toBeTruthy();
    }
  });
});

// Expected dates are the published 2026 deadlines (Skatteetaten, DNB, Sticos),
// which already include the moves for weekends and public holidays
describe("2026 deadlines", () => {
  it("bimonthly VAT return", () => {
    expect(in2026("vat-return", facts(enk, { vatTerm: "bimonthly" }))).toEqual([
      "2026-02-10",
      "2026-04-10",
      "2026-06-10",
      "2026-08-31",
      "2026-10-12", // 10 October is a Saturday
      "2026-12-10",
    ]);
  });

  it("annual VAT return", () => {
    expect(in2026("vat-return", facts(enk, { vatTerm: "annual" }))).toEqual([
      "2026-03-10",
    ]);
  });

  it("no VAT deadlines while the term is unknown", () => {
    expect(obligation("vat-return").schedule(facts(enk, { vatTerm: "unknown" }))).toBeNull();
  });

  it("tax return moves from Sunday 31 May to 1 June", () => {
    expect(in2026("tax-return-enk", facts(enk))).toEqual(["2026-06-01"]);
  });

  it("advance tax for ENK", () => {
    expect(in2026("advance-tax-enk", facts(enk))).toEqual([
      "2026-03-16",
      "2026-06-15",
      "2026-09-15",
      "2026-12-15",
    ]);
  });

  it("advance tax for AS", () => {
    expect(in2026("advance-tax-company", facts(as))).toEqual([
      "2026-02-16",
      "2026-04-15",
    ]);
  });

  it("a-melding on the 5th, moved past Easter and weekends", () => {
    const dates = in2026("a-melding", facts(as, { paysSalary: true }));
    expect(dates).toHaveLength(12);
    expect(dates.slice(0, 9)).toEqual([
      "2026-01-05",
      "2026-02-05",
      "2026-03-05",
      "2026-04-07", // 5 April is Easter Sunday, 6 April 2. påskedag
      "2026-05-05",
      "2026-06-05",
      "2026-07-06",
      "2026-08-05",
      "2026-09-07",
    ]);
  });

  it("employer's contribution every other month", () => {
    expect(in2026("employer-contribution", facts(as, { paysSalary: true }))).toEqual([
      "2026-01-15",
      "2026-03-16",
      "2026-05-15",
      "2026-07-15",
      "2026-09-15",
      "2026-11-16",
    ]);
  });

  it("shareholder register statement moves to Monday 2 February", () => {
    expect(in2026("shareholder-register", facts(as))).toEqual(["2026-02-02"]);
  });

  it("general meeting and annual accounts", () => {
    expect(in2026("general-meeting", facts(as))).toEqual(["2026-06-30"]);
    expect(in2026("annual-accounts", facts(as))).toEqual(["2026-07-31"]);
  });

  it("bookkeeping has no deadline", () => {
    expect(obligation("bookkeeping").schedule(facts(enk))).toBeNull();
  });
});

describe("upcomingDeadlines", () => {
  it("lists the next twelve months, starting today", () => {
    const schedule = obligation("advance-tax-enk").schedule(facts(enk));
    if (!schedule) throw new Error("no schedule");
    expect(upcomingDeadlines(schedule, fromIsoDate("2026-11-18"))).toEqual([
      "2026-12-15",
      "2027-03-15",
      "2027-06-15",
      "2027-09-15",
    ]);
  });

  it("includes a deadline that is today", () => {
    const schedule = obligation("advance-tax-enk").schedule(facts(enk));
    if (!schedule) throw new Error("no schedule");
    expect(upcomingDeadlines(schedule, fromIsoDate("2026-12-15"))[0]).toBe(
      "2026-12-15",
    );
  });
});

describe("warnings", () => {
  const warningIds = (f: Facts) =>
    WARNINGS.filter((w) => w.appliesTo(f)).map((w) => w.id);

  it("warns about VAT registration above NOK 50,000", () => {
    expect(warningIds(facts(as, { expectsSalesOver50k: true }))).toEqual([
      "vat-registration-required",
    ]);
    expect(warningIds(facts(as, { expectsSalesOver50k: false }))).toEqual([]);
  });

  it("warns when the VAT term is unknown", () => {
    expect(warningIds(facts(enk, { vatTerm: "unknown" }))).toEqual([
      "vat-term-unknown",
    ]);
  });
});
