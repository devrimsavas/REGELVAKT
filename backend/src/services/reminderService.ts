// The daily reminder work: refresh company data from Brreg, send the
// reminders that are due and delete data that is no longer needed.
// Each step is its own function, so the job and the tests can run them
// one by one; runReminders() runs them all in order.
import { literal, Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { logger } from "../config/logger.js";
import { Assessment } from "../models/Assessment.js";
import { ReminderDelivery } from "../models/ReminderDelivery.js";
import { Subscription } from "../models/Subscription.js";
import { fromIsoDate } from "../rules/calendar.js";
import { assess } from "../rules/engine.js";
import { todayInNorway } from "../utils/today.js";
import { webAppUrl } from "../utils/webAppUrl.js";
import { answersNeedUpdate } from "./assessmentService.js";
import { lookupCompany } from "./brregService.js";
import { type Email, getEmailSender } from "./email/emailSender.js";
import {
  answersOutdatedEmail,
  type ReminderLine,
  reminderEmail,
  remindersStoppedEmail,
  type StopReason,
} from "./email/templates.js";
import { manageUrl, oneClickUnsubscribeUrl } from "./subscriptionService.js";

const log = logger.child({ module: "reminders" });

const DAY_MS = 24 * 60 * 60 * 1000;

// How old a company snapshot may be before the job fetches it again
export const REFRESH_AFTER_DAYS = 7;
// Assessments without any subscription are deleted when they have not been
// used for this many days: the snapshot of a sole proprietorship holds the
// owner's name. Reading the page or fetching the calendar counts as use.
export const KEEP_UNUSED_ASSESSMENT_DAYS = 30;
// The record of sent reminders is kept this long
export const KEEP_DELIVERIES_DAYS = 365;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function companyLine(assessment: Assessment) {
  return {
    companyName: assessment.companySnapshot.name,
    orgNumber: assessment.orgNumber,
  };
}

// Assessments with at least one active subscription, with those
// subscriptions loaded
function assessmentsWithActiveSubscriptions(where = {}) {
  return Assessment.findAll({
    where,
    include: [
      {
        model: Subscription,
        where: { status: "active" },
        required: true,
      },
    ],
    order: [["createdAt", "ASC"]],
  });
}

// ---- 1. Refresh company data ----

export interface RefreshSummary {
  refreshed: number;
  answersOutdated: number;
  stopped: number;
  failed: number;
}

// Fetches the company again from Brreg for assessments with reminders whose
// snapshot is older than REFRESH_AFTER_DAYS, so changes in the register
// (such as a new VAT registration) reach the reminders. When the new data
// makes the answers no longer fit (a newly VAT-registered company has not
// told its VAT term), the subscribers are asked by email to answer again,
// once: the reminders go on meanwhile. A company that is
// no longer in the register gets no more reminders: its subscribers are
// told and their subscriptions deleted. When Brreg cannot be reached, the
// snapshot is kept and tried again on the next run.
export async function refreshCompanies(
  now = new Date(),
): Promise<RefreshSummary> {
  const summary: RefreshSummary = {
    refreshed: 0,
    answersOutdated: 0,
    stopped: 0,
    failed: 0,
  };
  const assessments = await assessmentsWithActiveSubscriptions({
    companyRefreshedAt: { [Op.lt]: daysAgo(now, REFRESH_AFTER_DAYS) },
  });

  for (const assessment of assessments) {
    let lookup: Awaited<ReturnType<typeof lookupCompany>>;
    try {
      lookup = await lookupCompany(assessment.orgNumber, { fresh: true });
    } catch (error: unknown) {
      log.warn(
        { err: error, assessmentId: assessment.id },
        "Could not refresh the company from Brreg",
      );
      summary.failed++;
      continue;
    }

    if (lookup.status === "active" && lookup.company.isBankrupt) {
      await stopReminders(assessment, "bankrupt");
      // The new data is kept, so the page shows the bankruptcy
      await assessment.update({
        companySnapshot: lookup.company,
        companyRefreshedAt: now,
      });
      summary.stopped++;
      continue;
    }

    if (lookup.status === "active") {
      const answersFitBefore = !answersNeedUpdate(assessment);
      await assessment.update({
        companySnapshot: lookup.company,
        companyRefreshedAt: now,
      });
      summary.refreshed++;

      if (answersFitBefore && answersNeedUpdate(assessment)) {
        summary.answersOutdated++;
        await tellSubscribers(assessment, (subscription) =>
          answersOutdatedEmail({
            to: subscription.email,
            language: subscription.language,
            company: companyLine(assessment),
            assessmentUrl: assessmentUrl(assessment),
            manageUrl: manageUrl(subscription.id),
            oneClickUnsubscribeUrl: oneClickUnsubscribeUrl(subscription.id),
          }),
        );
      }
      continue;
    }

    // Struck off or gone from the register
    await stopReminders(assessment, "deleted");
    summary.stopped++;
  }

  return summary;
}

// Tells the subscribers why, then deletes the subscriptions. The reminders
// stop even if an email cannot be sent.
async function stopReminders(
  assessment: Assessment,
  reason: StopReason,
): Promise<void> {
  await tellSubscribers(assessment, (subscription) =>
    remindersStoppedEmail({
      to: subscription.email,
      language: subscription.language,
      company: companyLine(assessment),
      reason,
      startUrl: webAppUrl(),
    }),
  );
  await Subscription.destroy({ where: { assessmentId: assessment.id } });
}

// Sends each active subscriber of the assessment an email; one that fails
// is logged and does not stop the others
async function tellSubscribers(
  assessment: Assessment,
  build: (subscription: Subscription) => Email,
): Promise<void> {
  for (const subscription of assessment.subscriptions ?? []) {
    try {
      await getEmailSender().send(build(subscription));
    } catch (error: unknown) {
      log.error(
        { err: error, subscriptionId: subscription.id },
        "Could not send an email to a subscriber",
      );
    }
  }
}

function assessmentUrl(assessment: Assessment): string {
  return `${webAppUrl()}/assessments/${assessment.id}`;
}

// ---- 2. Send reminders ----

// A deadline to remind about, and every reminder day it covers
export interface DueReminder {
  obligationId: string;
  line: ReminderLine;
  daysBefore: number[];
}

// The reminders a subscription should get today. A reminder is due when a
// deadline is at most that many days away and that reminder has not been
// sent. If the job did not run on the day itself (the server was down),
// it is sent on the next run instead of being lost. When several reminder
// days are due for the same deadline at once (such as 14 and 3 days for a
// subscription made 2 days before it), one line covers them all.
export function dueReminders(
  assessment: Assessment,
  subscription: Subscription,
  delivered: ReadonlySet<string>,
  today: Date,
): DueReminder[] {
  // A bankrupt company's obligations are the trustee's (see refreshCompanies)
  if (assessment.companySnapshot.isBankrupt) return [];

  const result = assess(assessment.companySnapshot, assessment.answers, today);
  if (!result.supported) return [];

  const due: DueReminder[] = [];
  for (const obligation of result.obligations) {
    for (const deadline of obligation.upcomingDeadlines) {
      const daysLeft = Math.round(
        (fromIsoDate(deadline).getTime() - today.getTime()) / DAY_MS,
      );
      const covered = subscription.reminderDays.filter(
        (days) => daysLeft <= days,
      );
      const isNew = covered.some(
        (days) => !delivered.has(deliveryKey(obligation.id, deadline, days)),
      );
      if (covered.length === 0 || !isNew) continue;

      due.push({
        obligationId: obligation.id,
        daysBefore: covered,
        line: {
          title: obligation.title[subscription.language],
          deadline,
          daysLeft,
          sourceUrl: obligation.sourceUrl,
          filingUrl: obligation.filingUrl,
        },
      });
    }
  }

  return due.sort((a, b) => a.line.daysLeft - b.line.daysLeft);
}

function deliveryKey(
  obligationId: string,
  deadline: string,
  daysBefore: number,
): string {
  return `${obligationId}|${deadline}|${daysBefore}`;
}

export interface SendSummary {
  emailsSent: number;
  remindersSent: number;
  failed: number;
}

// One email per subscription with everything due today, then a record of
// what was sent. An email that fails is tried again on the next run.
export async function sendDueReminders(now = new Date()): Promise<SendSummary> {
  const summary: SendSummary = { emailsSent: 0, remindersSent: 0, failed: 0 };
  const today = todayInNorway(now);
  const assessments = await assessmentsWithActiveSubscriptions();

  for (const assessment of assessments) {
    for (const subscription of assessment.subscriptions ?? []) {
      const sent = await ReminderDelivery.findAll({
        where: { subscriptionId: subscription.id },
        attributes: ["obligationId", "deadline", "daysBefore"],
      });
      const delivered = new Set(
        sent.map((d) => deliveryKey(d.obligationId, d.deadline, d.daysBefore)),
      );

      const due = dueReminders(assessment, subscription, delivered, today);
      if (due.length === 0) continue;

      try {
        await getEmailSender().send(
          reminderEmail({
            to: subscription.email,
            language: subscription.language,
            company: companyLine(assessment),
            lines: due.map((reminder) => reminder.line),
            assessmentUrl: assessmentUrl(assessment),
            manageUrl: manageUrl(subscription.id),
            oneClickUnsubscribeUrl: oneClickUnsubscribeUrl(subscription.id),
          }),
        );
      } catch (error: unknown) {
        log.error(
          { err: error, subscriptionId: subscription.id },
          "Could not send a reminder email",
        );
        summary.failed++;
        continue;
      }

      await ReminderDelivery.bulkCreate(
        due.flatMap((reminder) =>
          reminder.daysBefore.map((daysBefore) => ({
            subscriptionId: subscription.id,
            obligationId: reminder.obligationId,
            deadline: reminder.line.deadline,
            daysBefore,
            sentAt: now,
          })),
        ),
        { ignoreDuplicates: true },
      );
      summary.emailsSent++;
      summary.remindersSent += due.length;
    }
  }

  return summary;
}

// ---- 3. Clean up ----

export interface CleanupSummary {
  unconfirmedSubscriptions: number;
  assessments: number;
  deliveries: number;
}

// Deletes what is no longer needed:
// - subscriptions never confirmed, once the confirmation link has run out
//   (CONFIRM_LINK_HOURS)
// - assessments without any subscription that have not been used for
//   KEEP_UNUSED_ASSESSMENT_DAYS
// - records of reminders sent more than KEEP_DELIVERIES_DAYS ago
export async function cleanUp(now = new Date()): Promise<CleanupSummary> {
  const unconfirmedSubscriptions = await Subscription.destroy({
    where: { status: "pending", confirmExpiresAt: { [Op.lt]: now } },
  });

  const assessments = await Assessment.destroy({
    where: {
      lastAccessedAt: {
        [Op.lt]: daysAgo(now, KEEP_UNUSED_ASSESSMENT_DAYS),
      },
      id: {
        [Op.notIn]: literal("(SELECT assessment_id FROM subscriptions)"),
      },
    },
  });

  const deliveries = await ReminderDelivery.destroy({
    where: { sentAt: { [Op.lt]: daysAgo(now, KEEP_DELIVERIES_DAYS) } },
  });

  return { unconfirmedSubscriptions, assessments, deliveries };
}

// ---- All of it ----

export interface ReminderRunSummary {
  refresh: RefreshSummary;
  send: SendSummary;
  cleanup: CleanupSummary;
}

// A fixed number naming the reminder run's lock in PostgreSQL
export const REMINDER_LOCK_KEY = 7_364_020;

// Runs the three steps, or nothing if another run is going on. Two runs at
// the same time (two servers during a restart, or `npm run reminders` while
// the server runs) could send the same email twice: the record of sent
// reminders is written after sending. A PostgreSQL advisory lock lets only
// one run go on; it is held by a transaction that lasts the whole run, so
// it is let go when the run ends, fails or loses its connection.
export async function runReminders(
  now = new Date(),
): Promise<ReminderRunSummary | null> {
  return sequelize.transaction(async (transaction) => {
    const [row] = await sequelize.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(:key) AS locked",
      {
        replacements: { key: REMINDER_LOCK_KEY },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    if (!row?.locked) {
      log.warn("Another reminder run is going on; this one does nothing");
      return null;
    }

    // Clean-up first: no reminders for what is about to be deleted
    const cleanup = await cleanUp(now);
    const refresh = await refreshCompanies(now);
    const send = await sendDueReminders(now);
    const summary = { refresh, send, cleanup };
    log.info(
      summary,
      `Reminders: ${send.emailsSent} emails sent, ${send.failed} failed`,
    );
    return summary;
  });
}
