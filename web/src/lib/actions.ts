"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "./api";
import { type ApiError, apiErrorOf } from "./apiErrors";
import { answersFromForm } from "./answers";
import { isValidOrgNumber, normalizeOrgNumber } from "./orgNumber";
import type { Assessment } from "./types";

// ---- Search ----

export interface SearchState {
  error: "empty" | "invalid" | null;
  // What was typed, so the field keeps it
  value: string;
}

// Checks the organization number and goes on to its questions. The
// company itself is looked up there.
export async function searchCompany(
  _previous: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const value = String(formData.get("orgNumber") ?? "");
  const orgNumber = normalizeOrgNumber(value);
  if (orgNumber === "") return { error: "empty", value };
  if (!isValidOrgNumber(orgNumber)) return { error: "invalid", value };
  redirect(`/start/${orgNumber}`);
}

// ---- Answers ----

export interface QuestionsState {
  // Questions left unanswered
  missing: string[];
  error: ApiError | null;
}

function questionIdsOf(formData: FormData): string[] {
  return String(formData.get("questionIds") ?? "")
    .split(",")
    .filter(Boolean);
}

// Makes the assessment and shows it
export async function createAssessment(
  orgNumber: string,
  _previous: QuestionsState,
  formData: FormData,
): Promise<QuestionsState> {
  const { answers, missing } = answersFromForm(
    formData,
    questionIdsOf(formData),
  );
  if (missing.length > 0) return { missing, error: null };

  const result = await apiFetch<Assessment>("/api/assessments", {
    method: "POST",
    body: { orgNumber, answers },
  });
  if (!result.ok) return { missing: [], error: apiErrorOf(result) };
  redirect(`/assessments/${result.data.id}`);
}

// Saves new answers and goes back to the assessment, which says so
export async function updateAnswers(
  assessmentId: string,
  _previous: QuestionsState,
  formData: FormData,
): Promise<QuestionsState> {
  const { answers, missing } = answersFromForm(
    formData,
    questionIdsOf(formData),
  );
  if (missing.length > 0) return { missing, error: null };

  const result = await apiFetch<Assessment>(
    `/api/assessments/${encodeURIComponent(assessmentId)}`,
    { method: "PATCH", body: { answers } },
  );
  if (!result.ok)
    return { missing: [], error: apiErrorOf(result, "assessment") };
  redirect(`/assessments/${assessmentId}?updated=1`);
}
