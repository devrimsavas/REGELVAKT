import { describe, expect, it } from "vitest";
import { isValidOrgNumber } from "../src/utils/orgNumber.js";

describe("isValidOrgNumber", () => {
  it("accepts organization numbers with a correct check digit", () => {
    // Brønnøysundregistrene and Skatteetaten
    expect(isValidOrgNumber("974760673")).toBe(true);
    expect(isValidOrgNumber("974761076")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidOrgNumber("974760674")).toBe(false);
  });

  it("rejects anything that is not exactly 9 digits", () => {
    expect(isValidOrgNumber("97476067")).toBe(false);
    expect(isValidOrgNumber("9747606730")).toBe(false);
    expect(isValidOrgNumber("97476067a")).toBe(false);
    expect(isValidOrgNumber(974760673)).toBe(false);
    expect(isValidOrgNumber(undefined)).toBe(false);
  });
});
