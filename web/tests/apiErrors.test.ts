import { describe, expect, it } from "vitest";
import { apiErrorOf } from "@/lib/apiErrors";

const failed = (status: number, retryAfterSeconds?: number) => ({
  ok: false as const,
  status,
  error: "x",
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

describe("what went wrong with an API call", () => {
  it("is told by its status", () => {
    expect(apiErrorOf(failed(0))).toEqual({ key: "unreachable" });
    expect(apiErrorOf(failed(502))).toEqual({ key: "brregUnavailable" });
    expect(apiErrorOf(failed(410))).toEqual({ key: "companyStruckOff" });
    expect(apiErrorOf(failed(422))).toEqual({ key: "notSupported" });
    expect(apiErrorOf(failed(400))).toEqual({ key: "invalidAnswers" });
    expect(apiErrorOf(failed(500))).toEqual({ key: "unexpected" });
  });

  it("says whether a company or an assessment was not found", () => {
    expect(apiErrorOf(failed(404))).toEqual({ key: "companyNotFound" });
    expect(apiErrorOf(failed(404), "assessment")).toEqual({
      key: "assessmentNotFound",
    });
  });

  it("gives the wait in whole minutes, at least one", () => {
    expect(apiErrorOf(failed(429, 61))).toEqual({
      key: "tooManyRequests",
      minutes: 2,
    });
    expect(apiErrorOf(failed(429, 5))).toMatchObject({ minutes: 1 });
    expect(apiErrorOf(failed(429))).toMatchObject({ minutes: 1 });
  });
});
