import { describe, expect, it } from "vitest";
import { parseAnswers, questionsFor } from "../src/rules/answers.js";
import { fromIsoDate } from "../src/rules/calendar.js";
import { assess, toCompanyFacts } from "../src/rules/engine.js";
import type { Company } from "../src/types/company.js";

const TODAY = fromIsoDate("2026-11-18");

const company = (overrides: Partial<Company> = {}): Company => ({
  orgNumber: "974760673",
  name: "AYSE FRISØR",
  organizationForm: "ENK",
  organizationFormDescription: "Enkeltpersonforetak",
  address: null,
  industryCode: "96.021",
  industryDescription: "Frisering",
  employees: null,
  hasRegisteredEmployees: false,
  foundedDate: "2026-03-01",
  registrationDate: "2026-03-04",
  vatRegistered: true,
  businessRegisterRegistered: false,
  isBankrupt: false,
  isUnderLiquidation: false,
  isUnderForcedLiquidation: false,
  ...overrides,
});

describe("assess", () => {
  it("does not guess for an unsupported organization form", () => {
    expect(assess(company({ organizationForm: "ORGL" }), {}, TODAY)).toEqual({
      supported: false,
      organizationForm: "ORGL",
    });
  });

  it("gives Ayşe's ENK its obligations, nearest deadline first", () => {
    const result = assess(
      company(),
      { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true },
      TODAY,
    );

    if (!result.supported) throw new Error("expected a supported result");

    expect(result.rulesVersion).toBe("2026.1");
    expect(
      result.obligations.map((item) => [item.id, item.nextDeadline]),
    ).toEqual([
      ["vat-return", "2026-12-10"],
      ["advance-tax-enk", "2026-12-15"],
      ["tax-return-enk", "2027-05-31"],
      ["bookkeeping", null],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("explains why each obligation applies", () => {
    const result = assess(
      company(),
      { vatTerm: "annual", paysSalary: false, expectsProfit: false },
      TODAY,
    );
    if (!result.supported) throw new Error("expected a supported result");

    const vat = result.obligations.find((item) => item.id === "vat-return");
    expect(vat?.reason.en).toContain("annual term");
    expect(vat?.upcomingDeadlines).toEqual(["2027-03-10"]);
  });

  it("shows the VAT return without dates and warns when the term is unknown", () => {
    const result = assess(
      company(),
      { vatTerm: "unknown", paysSalary: false, expectsProfit: false },
      TODAY,
    );
    if (!result.supported) throw new Error("expected a supported result");

    const vat = result.obligations.find((item) => item.id === "vat-return");
    expect(vat?.nextDeadline).toBeNull();
    expect(vat?.upcomingDeadlines).toEqual([]);
    expect(result.warnings.map((w) => w.id)).toEqual(["vat-term-unknown"]);
  });

  it("covers an AS that pays salaries and expects to need VAT", () => {
    const result = assess(
      company({ organizationForm: "AS", vatRegistered: false }),
      { expectsSalesOver50k: true, paysSalary: true },
      TODAY,
    );
    if (!result.supported) throw new Error("expected a supported result");

    expect(result.obligations.map((item) => item.id)).toEqual([
      "a-melding", // 7 December (5 December is a Saturday)
      "employer-contribution", // 15 January
      "shareholder-register", // 1 February (31 January is a Sunday)
      "advance-tax-company", // 15 February
      "tax-return-company", // 31 May
      "general-meeting", // 30 June
      "annual-accounts", // 2 August (31 July is a Saturday)
      "bookkeeping",
    ]);
    expect(result.obligations[0]?.nextDeadline).toBe("2026-12-07");
    expect(result.warnings.map((w) => w.id)).toEqual([
      "vat-registration-required",
    ]);
  });
});

describe("parseAnswers", () => {
  const facts = toCompanyFacts(company());
  if (facts === null) throw new Error("expected supported facts");

  it("accepts a complete set of answers", () => {
    expect(
      parseAnswers(
        { vatTerm: "bimonthly", paysSalary: true, expectsProfit: false },
        facts,
      ),
    ).toEqual({
      ok: true,
      answers: { vatTerm: "bimonthly", paysSalary: true, expectsProfit: false },
    });
  });

  it("reports missing, invalid and unexpected answers", () => {
    const result = parseAnswers(
      { vatTerm: "weekly", paysSalary: "yes", expectsSalesOver50k: true },
      facts,
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        "'expectsSalesOver50k' is not a question for this company",
        "'vatTerm' must be one of: bimonthly, annual, unknown",
        "'paysSalary' must be true or false",
        "'expectsProfit' must be answered",
      ],
    });
  });

  it("rejects anything that is not an object", () => {
    expect(parseAnswers(null, facts).ok).toBe(false);
    expect(parseAnswers([], facts).ok).toBe(false);
  });

  it("asks only the questions that fit the company", () => {
    expect(questionsFor(facts).map((q) => q.id)).toEqual([
      "vatTerm",
      "paysSalary",
      "expectsProfit",
    ]);
  });
});
