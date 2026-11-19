// Email reminders: subscribing with a confirmation email (double opt-in),
// confirming, and changing or stopping them with the manage link.
import { UniqueConstraintError } from "sequelize";
import type { Assessment } from "../models/Assessment.js";
import {
  EMAIL_LANGUAGES,
  type EmailLanguage,
  Subscription,
} from "../models/Subscription.js";
import {
  hashToken,
  manageToken,
  randomToken,
  subscriptionIdFromToken,
} from "../utils/tokens.js";
import { webAppUrl } from "../utils/webAppUrl.js";
import { getEmailSender } from "./email/emailSender.js";
import {
  alreadySubscribedEmail,
  confirmationEmail,
} from "./email/templates.js";

// How many days before a deadline a reminder may come
export const REMINDER_DAY_OPTIONS = [1, 3, 7, 14, 30] as const;
export const DEFAULT_REMINDER_DAYS = [14, 3];

// How long the confirmation link works. Unconfirmed subscriptions are
// deleted when it has run out.
export const CONFIRM_LINK_HOURS = 48;

// RFC 5321 allows 254 characters. The pattern only catches obvious typos;
// the confirmation email is the real check.
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidTokenError extends Error {}
export class SubscriptionNotFoundError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface SubscriptionInput {
  email: string;
  language: EmailLanguage;
  reminderDays: number[];
}

export interface SubscriptionSettings {
  language?: EmailLanguage;
  reminderDays?: number[];
}

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isLanguage(value: unknown): value is EmailLanguage {
  return (EMAIL_LANGUAGES as readonly unknown[]).includes(value);
}

// One to five different numbers from REMINDER_DAY_OPTIONS, stored with the
// earliest reminder first
function parseReminderDays(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (
    !value.every((day) =>
      (REMINDER_DAY_OPTIONS as readonly unknown[]).includes(day),
    )
  ) {
    return null;
  }
  const days = [...new Set(value as number[])];
  return days.length === value.length ? days.sort((a, b) => b - a) : null;
}

const DAYS_ERROR = `reminderDays must be a list of different numbers from: ${REMINDER_DAY_OPTIONS.join(", ")}`;
const LANGUAGE_ERROR = `language must be one of: ${EMAIL_LANGUAGES.join(", ")}`;

function field(body: unknown, name: string): unknown {
  return typeof body === "object" && body !== null && name in body
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

// The body of a new subscription. Every problem is listed at once.
// language and reminderDays may be left out for the defaults.
export function parseSubscriptionInput(
  body: unknown,
): Parsed<SubscriptionInput> {
  const errors: string[] = [];

  const rawEmail = field(body, "email");
  const email =
    typeof rawEmail === "string" ? normalizeEmail(rawEmail) : undefined;
  if (
    email === undefined ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    errors.push("email must be a valid email address");
  }

  const rawLanguage = field(body, "language") ?? "nb";
  if (!isLanguage(rawLanguage)) errors.push(LANGUAGE_ERROR);

  const rawDays = field(body, "reminderDays") ?? DEFAULT_REMINDER_DAYS;
  const reminderDays = parseReminderDays(rawDays);
  if (reminderDays === null) errors.push(DAYS_ERROR);

  // Consent must be given, not assumed: the web app shows what the emails
  // are and the privacy notice next to the checkbox
  if (field(body, "consent") !== true) {
    errors.push("consent must be true");
  }

  if (errors.length > 0 || email === undefined || reminderDays === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { email, language: rawLanguage as EmailLanguage, reminderDays },
  };
}

// The settings that may be changed later; at least one must be given
export function parseSettings(body: unknown): Parsed<SubscriptionSettings> {
  const errors: string[] = [];
  const settings: SubscriptionSettings = {};

  const language = field(body, "language");
  if (language !== undefined) {
    if (isLanguage(language)) settings.language = language;
    else errors.push(LANGUAGE_ERROR);
  }

  const rawDays = field(body, "reminderDays");
  if (rawDays !== undefined) {
    const days = parseReminderDays(rawDays);
    if (days) settings.reminderDays = days;
    else errors.push(DAYS_ERROR);
  }

  if (language === undefined && rawDays === undefined) {
    errors.push("Give language, reminderDays or both");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: settings };
}

// ---- Links ----

export function confirmUrl(token: string): string {
  return `${webAppUrl()}/reminders/confirm?token=${encodeURIComponent(token)}`;
}

export function manageUrl(subscriptionId: string): string {
  return `${webAppUrl()}/reminders/manage?token=${encodeURIComponent(manageToken(subscriptionId))}`;
}

// Mail programs post to this address for their own unsubscribe button.
// The web app passes it on to POST /api/subscriptions/unsubscribe.
export function oneClickUnsubscribeUrl(subscriptionId: string): string {
  return `${webAppUrl()}/reminders/unsubscribe/one-click?token=${encodeURIComponent(manageToken(subscriptionId))}`;
}

function companyLine(assessment: Assessment) {
  return {
    companyName: assessment.companySnapshot.name,
    orgNumber: assessment.orgNumber,
  };
}

// ---- Subscribing ----

// Starts a subscription and emails a confirmation link. The caller answers
// the same way whatever happens here, so the form cannot be used to find
// out which addresses already get reminders:
// - new address: a pending subscription and a confirmation email
// - pending: new settings and a new link (the old one stops working)
// - already active: nothing changes; an email tells the owner so
export async function subscribe(
  assessment: Assessment,
  input: SubscriptionInput,
): Promise<void> {
  const existing = await Subscription.findOne({
    where: { assessmentId: assessment.id, email: input.email },
  });

  if (existing?.status === "active") {
    await getEmailSender().send(
      alreadySubscribedEmail({
        to: existing.email,
        language: input.language,
        company: companyLine(assessment),
        manageUrl: manageUrl(existing.id),
        oneClickUnsubscribeUrl: oneClickUnsubscribeUrl(existing.id),
      }),
    );
    return;
  }

  const token = randomToken();
  const now = new Date();
  const values = {
    language: input.language,
    reminderDays: input.reminderDays,
    confirmTokenHash: hashToken(token),
    confirmExpiresAt: new Date(
      now.getTime() + CONFIRM_LINK_HOURS * 60 * 60 * 1000,
    ),
    consentedAt: now,
  };

  if (existing) {
    await existing.update(values);
  } else {
    try {
      await Subscription.create({
        ...values,
        assessmentId: assessment.id,
        email: input.email,
        status: "pending",
      });
    } catch (error: unknown) {
      // The same address was sent twice at the same moment; the other
      // request sends the email
      if (error instanceof UniqueConstraintError) return;
      throw error;
    }
  }

  await getEmailSender().send(
    confirmationEmail({
      to: input.email,
      language: input.language,
      company: companyLine(assessment),
      confirmUrl: confirmUrl(token),
      validHours: CONFIRM_LINK_HOURS,
    }),
  );
}

// ---- Confirming ----

// Turns a pending subscription on. Using the link again later is fine:
// the subscription is simply already active.
export async function confirm(token: unknown): Promise<Subscription> {
  if (typeof token !== "string" || token.length === 0 || token.length > 200) {
    throw new InvalidTokenError("This link is not valid or has expired");
  }

  const subscription = await Subscription.findOne({
    where: { confirmTokenHash: hashToken(token) },
  });

  if (!subscription) {
    throw new InvalidTokenError("This link is not valid or has expired");
  }
  if (subscription.status === "active") {
    return subscription;
  }
  if (
    subscription.confirmExpiresAt === null ||
    subscription.confirmExpiresAt.getTime() <= Date.now()
  ) {
    throw new InvalidTokenError("This link is not valid or has expired");
  }

  await subscription.update({
    status: "active",
    confirmedAt: new Date(),
    confirmExpiresAt: null,
  });
  return subscription;
}

// ---- Managing ----

// The subscription a manage token was made for
export async function findByManageToken(token: unknown): Promise<Subscription> {
  const id = subscriptionIdFromToken(token);
  if (id === null) {
    throw new InvalidTokenError("This link is not valid");
  }
  const subscription = await Subscription.findByPk(id);
  if (!subscription) {
    throw new SubscriptionNotFoundError(
      "These reminders have been stopped or do not exist",
    );
  }
  return subscription;
}

export async function updateSettings(
  token: unknown,
  settings: SubscriptionSettings,
): Promise<Subscription> {
  const subscription = await findByManageToken(token);
  return subscription.update(settings);
}

// Stops the reminders by deleting the subscription, email address
// included. Stopping ones that are already gone is not an error, so the
// link can be used twice.
export async function unsubscribe(token: unknown): Promise<void> {
  const id = subscriptionIdFromToken(token);
  if (id === null) {
    throw new InvalidTokenError("This link is not valid");
  }
  await Subscription.destroy({ where: { id } });
}

// What the web app's manage page shows
export function toSubscriptionView(
  subscription: Subscription,
  assessment: Assessment,
) {
  return {
    assessmentId: assessment.id,
    orgNumber: assessment.orgNumber,
    companyName: assessment.companySnapshot.name,
    email: subscription.email,
    language: subscription.language,
    reminderDays: subscription.reminderDays,
    status: subscription.status,
    confirmedAt: subscription.confirmedAt,
  };
}
