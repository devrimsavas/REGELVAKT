import { describe, expect, it } from "vitest";
import { Assessment } from "../src/models/Assessment.js";
import type { Company } from "../src/types/company.js";

const company: Company = {
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
};

describe("Assessment model", () => {
  it("stores and reads back an assessment", async () => {
    const created = await Assessment.create({
      orgNumber: company.orgNumber,
      companySnapshot: company,
      answers: { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true },
      rulesVersion: "2026.1",
    });

    // A random UUID, not a running number
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const found = await Assessment.findByPk(created.id);

    expect(found?.orgNumber).toBe("974760673");
    expect(found?.companySnapshot).toEqual(company);
    expect(found?.answers).toEqual({
      vatTerm: "bimonthly",
      paysSalary: false,
      expectsProfit: true,
    });
    expect(found?.rulesVersion).toBe("2026.1");
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("starts every test with an empty table", async () => {
    expect(await Assessment.count()).toBe(0);
  });
});
