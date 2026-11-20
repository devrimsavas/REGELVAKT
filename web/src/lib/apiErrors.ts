import type { ApiResult } from "./api";

// What went wrong with an API call, as a key in the "apiErrors" texts.
// The API's own messages are in English and meant for developers; the
// page shows these instead.
export type ApiErrorKey =
  | "unreachable"
  | "tooManyRequests"
  | "brregUnavailable"
  | "companyNotFound"
  | "companyStruckOff"
  | "assessmentNotFound"
  | "notSupported"
  | "invalidAnswers"
  | "unexpected";

export interface ApiError {
  key: ApiErrorKey;
  // With tooManyRequests: whole minutes to wait, at least 1
  minutes?: number;
}

// `subject` is what a 404 is about: the company asked for, or a stored
// assessment
export function apiErrorOf(
  result: ApiResult<unknown> & { ok: false },
  subject: "company" | "assessment" = "company",
): ApiError {
  switch (result.status) {
    case 0:
      return { key: "unreachable" };
    case 429:
      return {
        key: "tooManyRequests",
        minutes: Math.max(1, Math.ceil((result.retryAfterSeconds ?? 60) / 60)),
      };
    case 502:
      return { key: "brregUnavailable" };
    case 404:
      return {
        key: subject === "company" ? "companyNotFound" : "assessmentNotFound",
      };
    case 410:
      return { key: "companyStruckOff" };
    case 422:
      return { key: "notSupported" };
    case 400:
      return { key: "invalidAnswers" };
    default:
      return { key: "unexpected" };
  }
}
