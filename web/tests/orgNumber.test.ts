import { describe, expect, it } from "vitest";
import {
  formatOrgNumber,
  isValidOrgNumber,
  normalizeOrgNumber,
} from "@/lib/orgNumber";

describe("organization numbers", () => {
  it("take the ways people type them", () => {
    expect(normalizeOrgNumber(" 974 760 673 ")).toBe("974760673");
    expect(normalizeOrgNumber("974.760.673")).toBe("974760673");
    expect(normalizeOrgNumber("974-760-673")).toBe("974760673");
  });

  it("are checked with the modulus 11 check digit", () => {
    expect(isValidOrgNumber("974760673")).toBe(true);
    expect(isValidOrgNumber("918794727")).toBe(true);
    expect(isValidOrgNumber("974760674")).toBe(false);
    expect(isValidOrgNumber("97476067")).toBe(false);
    expect(isValidOrgNumber("abcdefghi")).toBe(false);
  });

  it("are written in groups of three", () => {
    expect(formatOrgNumber("974760673")).toBe("974 760 673");
    expect(formatOrgNumber("123")).toBe("123");
  });
});
