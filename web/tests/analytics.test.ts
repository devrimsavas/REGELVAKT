import { describe, expect, it } from "vitest";
import { countedPath, counterOrigin, counterUrl } from "@/lib/analytics";

describe("the page view counter", () => {
  it("is on only with an https address", () => {
    expect(counterUrl(undefined)).toBeNull();
    expect(counterUrl("")).toBeNull();
    expect(counterUrl("not an address")).toBeNull();
    expect(counterUrl("http://regelvakt.goatcounter.com/count")).toBeNull();
    expect(counterUrl("https://regelvakt.goatcounter.com/count")).toBe(
      "https://regelvakt.goatcounter.com/count",
    );
    expect(counterOrigin("https://regelvakt.goatcounter.com/count")).toBe(
      "https://regelvakt.goatcounter.com",
    );
  });

  it("never counts an assessment's id or an organization number", () => {
    expect(
      countedPath("/assessments/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b/calendar"),
    ).toBe("/assessments/:id/calendar");
    expect(countedPath("/assessments/3F2B8C1E-9A4D-4E6F-8B7A-1C2D3E4F5A6B")).toBe(
      "/assessments/:id",
    );
    expect(countedPath("/start/974760673")).toBe("/start/:org");
  });

  it("leaves other paths as they are", () => {
    expect(countedPath("/")).toBe("/");
    expect(countedPath("/assistent")).toBe("/assistent");
    expect(countedPath("/reminders/manage")).toBe("/reminders/manage");
    expect(countedPath("/start/12345")).toBe("/start/12345");
  });
});
