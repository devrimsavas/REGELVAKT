// The daily reminder work: refresh company data from Brreg, send the
// reminders that are due and delete data that is no longer needed.
// Each step is its own function, so the job and the tests can run them
// one by one; runReminders() runs them all in order.
import { literal, Op } from "sequelize";
import { logger } from "../config/logger.js";
import { Assessment } from "../models/Assessment.js";
import { ReminderDelivery } from "../models/ReminderDelivery.js";
import { Subscription } from "../models/Subscription.js";
import { fromIsoDate } from "../rules/calendar.js";
import { assess } from "../rules/engine.js";
import { todayInNorway } from "../utils/today.js";
import { webAppUrl } from "../utils/webAppUrl.js";
import { lookupCompany } from "./brregService.js";
import { getEmailSender } from "./email/emailSender.js";
import {
  type ReminderLine,
  reminderEmail,
  remindersStoppedEmail,
} from "./email/templates.js";
import { manageUrl, oneClickUnsubscribeUrl } from "./subscriptionService.js";

const log = logger.child({ module: "reminders" });

const DAY_MS = 24 * 60 * 60 * 1000;

// How old a company snapshot may be before the job fetches it again
export const REFRESH_AFTER_DAYS = 7;
// Assessments without any subscription are deleted after this many days:
// the snapshot of a sole proprietorship holds the owner's name
export const KEEP_UNSUBSCRIBED_ASSESSMENT_DAYS = 30;
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
  stopped: number;
  failed: number;
}

// Fetches the company again from Brreg for assessments with reminders whose
// snapshot is older than REFRESH_AFTER_DAYS, so changes in the register
// (such as a new VAT registration) reach the reminders. A company that is
// no longer in the register gets no more reminders: its subscribers are
// told and their subscriptions deleted. When Brreg cannot be reached, the
// snapshot is kept and tried again on the next run.
export async function refreshCompanies(
  now = new Date(),
): Promise<RefreshSummary> {
  const summary: RefreshSummary = { refreshed: 0, stopped: 0, failed: 0 };
  const assessments = await assessmentsWithActiveSubscriptions({
    companyRefreshedAt: { [Op.lt]: daysAgo(now, REFRESH_AFTER_DAYS) },
  });

  for (const assessment of assessments) {
    let lookup: Awaited<ReturnType<typeof lookupCompany>>;
    try {
      lookup = await lookupCompany(assessment.orgNumber);
    } catch (error: unknown) {
      log.warn(
        { err: error, assessmentId: assessment.id },
        "Could not refresh the company from Brreg",
      );
      summary.failed++;
      continue;
    }

    if (lookup.status === "active") {
      await assessment.update({
        companySnapshot: lookup.company,
        companyRefreshedAt: now,
      });
      summary.refreshed++;
      continue;
    }

    // Struck off or gone from the register
    for (const subscription of assessment.subscriptions ?? []) {
      try {
        await getEmailSender().send(
          remindersStoppedEmail({
            to: subscription.email,
            language: subscription.language,
            company: companyLine(assessment),
            startUrl: webAppUrl(),
          }),
        );
      } catch (error: unknown) {
        // The reminders stop either way
        log.error(
          { err: error, subscriptionId: subscription.id },
          "Could not send the reminders stopped email",
        );
      }
    }
    await Subscription.destroy({ where: { assessmentId: assessment.id } });
    summary.stopped++;
  }

  return summary;
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
          altinnUrl: obligation.altinnUrl,
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
            assessmentUrl: `${webAppUrl()}/assessments/${assessment.id}`,
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
// - assessments without any subscription, KEEP_UNSUBSCRIBED_ASSESSMENT_DAYS
//   after they were made
// - records of reminders sent more than KEEP_DELIVERIES_DAYS ago
export async function cleanUp(now = new Date()): Promise<CleanupSummary> {
  const unconfirmedSubscriptions = await Subscription.destroy({
    where: { status: "pending", confirmExpiresAt: { [Op.lt]: now } },
  });

  const assessments = await Assessment.destroy({
    where: {
      createdAt: {
        [Op.lt]: daysAgo(now, KEEP_UNSUBSCRIBED_ASSESSMENT_DAYS),
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

export async function runReminders(
  now = new Date(),
): Promise<ReminderRunSummary> {
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
}
