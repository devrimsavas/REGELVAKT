"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { apiFetch } from "./api";
import { looksLikeBot } from "./botCheck";
import { type ApiError, apiErrorOf } from "./apiErrors";
import {
  looksLikeEmail,
  reminderDaysFromForm,
  type SubscriptionView,
} from "./reminders";

// ---- Ordering reminders ----

export interface SubscribeState {
  sent: boolean;
  // What the user has to fix
  invalid: ("email" | "days" | "consent")[];
  // A problem the user cannot fix in the form
  problem: "bankrupt" | "sendFailed" | ApiError | null;
  // What was typed, so the field keeps it
  email: string;
}

export async function subscribe(
  assessmentId: string,
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // A bot gets the same answer as a person, so it learns nothing, and no
  // email is sent
  if (looksLikeBot(formData)) {
    console.info("Reminder form: sent by what looked like a bot; ignored");
    return { sent: true, invalid: [], problem: null, email: "" };
  }

  const email = String(formData.get("email") ?? "").trim();
  const reminderDays = reminderDaysFromForm(formData);
  const consent = formData.get("consent") === "yes";

  const invalid: SubscribeState["invalid"] = [];
  if (!looksLikeEmail(email)) invalid.push("email");
  if (reminderDays.length === 0) invalid.push("days");
  if (!consent) invalid.push("consent");
  if (invalid.length > 0) {
    return { sent: false, invalid, problem: null, email };
  }

  const result = await apiFetch(
    `/api/assessments/${encodeURIComponent(assessmentId)}/subscriptions`,
    {
      method: "POST",
      // The emails are in the language the page is shown in
      body: { email, language: await getLocale(), reminderDays, consent },
    },
  );
  if (result.ok) return { sent: true, invalid: [], problem: null, email: "" };

  const problem =
    result.status === 422
      ? "bankrupt"
      : result.status === 502
        ? "sendFailed"
        : result.status === 400
          ? null
          : apiErrorOf(result, "assessment");
  return {
    sent: false,
    // The API found the address invalid (its check is the same as ours,
    // so this is rare)
    invalid: result.status === 400 ? ["email"] : [],
    problem,
    email,
  };
}

// ---- The links in the emails ----

export interface TokenState {
  // The link's token is wrong, too old or already used
  invalid: boolean;
  error: ApiError | null;
}

// The confirmation link's page has a button: links in emails are sometimes
// opened by mail filters before the user sees them, and that should not
// start the reminders
export async function confirmReminders(
  _previous: TokenState,
  formData: FormData,
): Promise<TokenState> {
  const token = String(formData.get("token") ?? "");
  const result = await apiFetch<SubscriptionView & { manageToken: string }>(
    "/api/subscriptions/confirm",
    { method: "POST", body: { token } },
  );
  if (!result.ok) {
    return result.status === 400 || result.status === 404
      ? { invalid: true, error: null }
      : { invalid: false, error: apiErrorOf(result) };
  }
  redirect(
    `/reminders/manage?token=${encodeURIComponent(result.data.manageToken)}&confirmed=1`,
  );
}

export interface SettingsState extends TokenState {
  saved: boolean;
  daysMissing: boolean;
}

export async function saveSettings(
  token: string,
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const reminderDays = reminderDaysFromForm(formData);
  const language = formData.get("language") === "en" ? "en" : "nb";
  if (reminderDays.length === 0) {
    return { saved: false, daysMissing: true, invalid: false, error: null };
  }

  const result = await apiFetch("/api/subscriptions", {
    method: "PATCH",
    body: { token, reminderDays, language },
  });
  if (result.ok) {
    return { saved: true, daysMissing: false, invalid: false, error: null };
  }
  return {
    saved: false,
    daysMissing: false,
    invalid: result.status === 400 || result.status === 404,
    error:
      result.status === 400 || result.status === 404
        ? null
        : apiErrorOf(result),
  };
}

// The form's state and data are passed after the token; neither is needed
export async function stopReminders(token: string): Promise<TokenState> {
  const result = await apiFetch("/api/subscriptions/unsubscribe", {
    method: "POST",
    body: { token },
  });
  if (!result.ok) {
    return result.status === 400 || result.status === 404
      ? { invalid: true, error: null }
      : { invalid: false, error: apiErrorOf(result) };
  }
  redirect("/reminders/stopped");
}

// ---- Deleting ----

export interface DeleteState {
  error: ApiError | null;
}

export async function deleteAssessment(
  assessmentId: string,
): Promise<DeleteState> {
  const result = await apiFetch(
    `/api/assessments/${encodeURIComponent(assessmentId)}`,
    { method: "DELETE" },
  );
  // Already gone is as good as deleted
  if (!result.ok && result.status !== 404) {
    return { error: apiErrorOf(result, "assessment") };
  }
  redirect("/?deleted=1");
}
