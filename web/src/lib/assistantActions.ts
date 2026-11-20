"use server";

import { getLocale } from "next-intl/server";
import { apiFetch } from "./api";
import { type ApiError, apiErrorOf } from "./apiErrors";
import { type AssistantAnswer, MAX_QUESTION, MIN_QUESTION } from "./assistant";

export type AskError =
  | { key: "tooShort" | "tooLong" | "notReady" | "dailyLimit" }
  | ApiError;

export type AskResult =
  | { ok: true; answer: AssistantAnswer }
  | { ok: false; error: AskError };

// Asks the assistant one question, about the assessment's company when
// there is one. The answer comes in the language the page is shown in.
export async function askQuestion(
  question: string,
  assessmentId: string | null,
): Promise<AskResult> {
  const text = question.trim();
  if (text.length < MIN_QUESTION) return { ok: false, error: { key: "tooShort" } };
  if (text.length > MAX_QUESTION) return { ok: false, error: { key: "tooLong" } };

  const result = await apiFetch<AssistantAnswer>("/api/assistant/ask", {
    method: "POST",
    body: {
      question: text,
      language: await getLocale(),
      ...(assessmentId ? { assessmentId } : {}),
    },
  });
  if (result.ok) return { ok: true, answer: result.data };

  if (result.status === 503) return { ok: false, error: { key: "notReady" } };
  // The assistant's daily limit has no wait; the limit per address has one
  if (result.status === 429 && result.retryAfterSeconds === undefined) {
    return { ok: false, error: { key: "dailyLimit" } };
  }
  return { ok: false, error: apiErrorOf(result, "assessment") };
}
