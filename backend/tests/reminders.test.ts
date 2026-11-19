import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hourInNorway, isRunDue } from "../src/jobs/reminderJob.js";
import { Assessment } from "../src/models/Assessment.js";
import { ReminderDelivery } from "../src/models/ReminderDelivery.js";
import { Subscription } from "../src/models/Subscription.js";
import {
  EmailError,
  setEmailSender,
} from "../src/services/email/emailSender.js";
import { formatDate } from "../src/services/email/templates.js";
import {
  cleanUp,
  refreshCompanies,
  runReminders,
  sendDueReminders,
} from "../src/services/reminderService.js";
import { createAssessment, enkEnhet } from "./helpers/assessments.js";
import { useEmails } from "./helpers/emails.js";
import { LEVELS, useLogs } from "./helpers/logs.js";

const emails = useEmails();
const logs = useLogs();

const DAY_MS = 24 * 60 * 60 * 1000;

// Morning in Norway on the given date (08:00 in winter)
function morning(isoDate: string): Date {
  return new Date(`${isoDate}T07:00:00Z`);
}

// The test company is an ENK with VAT every two months and expected profit.
// Around the end of November 2026 its next deadlines are:
//   VAT return   Thursday 10 December 2026
//   advance tax  Tuesday 15 December 2026
let assessment: Assessment;

beforeEach(async () => {
  assessment = await createAssessment();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function subscribe(
  values: Partial<{
    email: string;
    language: "nb" | "en";
    reminderDays: number[];
    status: "pending" | "active";
    confirmExpiresAt: Date | null;
  }> = {},
  forAssessment: Assessment = assessment,
) {
  return Subscription.create({
    assessmentId: forAssessment.id,
    email: "ayse@example.com",
    language: "nb",
    reminderDays: [14, 3],
    status: "active",
    consentedAt: new Date(),
    confirmedAt: new Date(),
    ...values,
  });
}

describe("sending reminders", () => {
  it("sends a reminder when a deadline is the chosen number of days away", async () => {
    const subscription = await subscribe();

    const summary = await sendDueReminders(morning("2026-11-26"));

    expect(summary).toEqual({ emailsSent: 1, remindersSent: 1, failed: 0 });
    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe("ayse@example.com");
    expect(emails[0]?.subject).toBe(
      "Frist om 14 dager: Mva-melding (AYSE FRISØR)",
    );
    expect(emails[0]?.text).toContain(
      "Frist: torsdag 10. desember 2026 (om 14 dager)",
    );
    const deliveries = await ReminderDelivery.findAll();
    expect(deliveries.map((d) => d.get({ plain: true }))).toEqual([
      expect.objectContaining({
        subscriptionId: subscription.id,
        obligationId: "vat-return",
        deadline: "2026-12-10",
        daysBefore: 14,
      }),
    ]);
  });

  it("links to the assessment, the source and the manage page", async () => {
    await subscribe();

    await sendDueReminders(morning("2026-11-26"));

    const text = emails[0]?.text ?? "";
    expect(text).toContain(
      `Se alle frister: http://web.test/assessments/${assessment.id}`,
    );
    expect(text).toContain("Les mer: https://www.skatteetaten.no/");
    expect(text).toContain(
      "Endre eller stopp påminnelsene: http://web.test/reminders/manage?token=",
    );
    expect(emails[0]?.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("never sends the same reminder twice", async () => {
    await subscribe();

    await sendDueReminders(morning("2026-11-26"));
    await sendDueReminders(morning("2026-11-26"));
    await sendDueReminders(morning("2026-11-27"));

    expect(emails).toHaveLength(1);
  });

  it("sends the next reminder when its day comes", async () => {
    await subscribe();

    await sendDueReminders(morning("2026-11-26")); // VAT, 14 days
    await sendDueReminders(morning("2026-12-01")); // advance tax, 14 days
    await sendDueReminders(morning("2026-12-07")); // VAT, 3 days

    expect(emails.map((e) => e.subject)).toEqual([
      "Frist om 14 dager: Mva-melding (AYSE FRISØR)",
      "Frist om 14 dager: Forskuddsskatt (AYSE FRISØR)",
      "Frist om 3 dager: Mva-melding (AYSE FRISØR)",
    ]);
  });

  it("sends a missed reminder on the next run instead of losing it", async () => {
    await subscribe();

    // The server was down on 26 and 27 November
    await sendDueReminders(morning("2026-11-28"));

    expect(emails[0]?.subject).toBe(
      "Frist om 12 dager: Mva-melding (AYSE FRISØR)",
    );
  });

  it("covers several reminder days for one deadline with one line", async () => {
    await subscribe();

    // Subscribed only two days before the VAT deadline (and seven before
    // the advance tax)
    await sendDueReminders(morning("2026-12-08"));
    await sendDueReminders(morning("2026-12-09"));

    expect(emails).toHaveLength(1);
    expect(emails[0]?.text).toContain(
      "Frist: torsdag 10. desember 2026 (om 2 dager)",
    );
    const days = (
      await ReminderDelivery.findAll({ order: [["daysBefore", "DESC"]] })
    )
      .filter((d) => d.obligationId === "vat-return")
      .map((d) => d.daysBefore);
    expect(days).toEqual([14, 3]);
  });

  it("puts every due deadline in one email, the nearest first", async () => {
    await subscribe({ reminderDays: [30] });

    await sendDueReminders(morning("2026-11-26"));

    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe("2 frister nærmer seg for AYSE FRISØR");
    const text = emails[0]?.text ?? "";
    expect(text.indexOf("Mva-melding")).toBeLessThan(
      text.indexOf("Forskuddsskatt"),
    );
  });

  it("uses the deadline moved to the next business day", async () => {
    await subscribe({ reminderDays: [14] });

    // 10 October 2026 is a Saturday, so the VAT return is due Monday 12th
    await sendDueReminders(morning("2026-09-28"));

    expect(emails[0]?.text).toContain("mandag 12. oktober 2026 (om 14 dager)");
  });

  it("says today and tomorrow in words", async () => {
    await subscribe({ reminderDays: [1] });

    await sendDueReminders(morning("2026-12-09"));
    await sendDueReminders(morning("2026-12-15"));

    expect(emails.map((e) => e.subject)).toEqual([
      "Frist i morgen: Mva-melding (AYSE FRISØR)",
      "Frist i dag: Forskuddsskatt (AYSE FRISØR)",
    ]);
  });

  it("writes in the subscription's language", async () => {
    await subscribe({ language: "en" });

    await sendDueReminders(morning("2026-11-26"));

    expect(emails[0]?.subject).toBe(
      "Deadline in 14 days: VAT return (AYSE FRISØR)",
    );
    expect(emails[0]?.text).toContain(
      "Deadline: Thursday 10 December 2026 (in 14 days)",
    );
  });

  it("sends each subscriber of an assessment their own email", async () => {
    await subscribe();
    await subscribe({ email: "regnskap@example.com", language: "en" });

    await sendDueReminders(morning("2026-11-26"));

    expect(emails.map((e) => e.to).sort()).toEqual([
      "ayse@example.com",
      "regnskap@example.com",
    ]);
  });

  it("sends nothing to unconfirmed subscriptions", async () => {
    await subscribe({ status: "pending" });

    await sendDueReminders(morning("2026-11-26"));

    expect(emails).toHaveLength(0);
  });

  it("tries a failed email again on the next run", async () => {
    await subscribe();
    setEmailSender({
      async send() {
        throw new EmailError("Resend refused the email (500)");
      },
    });

    const failed = await sendDueReminders(morning("2026-11-26"));

    expect(failed).toEqual({ emailsSent: 0, remindersSent: 0, failed: 1 });
    expect(await ReminderDelivery.count()).toBe(0);
    expect(
      logs.lines.some(
        (l) =>
          l.msg === "Could not send a reminder email" &&
          l.level === LEVELS.error,
      ),
    ).toBe(true);

    setEmailSender({
      async send(email) {
        emails.push(email);
      },
    });
    await sendDueReminders(morning("2026-11-27"));
    expect(emails[0]?.subject).toBe(
      "Frist om 13 dager: Mva-melding (AYSE FRISØR)",
    );
  });
});

describe("refreshing company data", () => {
  function mockBrreg(status: number, body?: unknown) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    );
  }

  const inEightDays = () => new Date(Date.now() + 8 * DAY_MS);

  it("fetches a snapshot older than a week and stores the new data", async () => {
    await subscribe();
    const fetchMock = mockBrreg(200, {
      ...enkEnhet,
      naeringskode1: { kode: "96.022", beskrivelse: "Skjønnhetspleie" },
    });
    const now = inEightDays();

    const summary = await refreshCompanies(now);

    expect(summary).toEqual({
      refreshed: 1,
      answersOutdated: 0,
      stopped: 0,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await assessment.reload();
    expect(assessment.companySnapshot.industryCode).toBe("96.022");
    expect(assessment.companyRefreshedAt.getTime()).toBe(now.getTime());
    // The answers still fit, so nobody is asked anything
    expect(emails).toHaveLength(0);
  });

  it("asks the subscribers to answer again when the new data needs it", async () => {
    // Not VAT-registered when the assessment was made
    const notVat = { ...enkEnhet, registrertIMvaregisteret: false };
    const before = await createAssessment({
      enhet: notVat,
      answers: {
        expectsSalesOver50k: true,
        paysSalary: false,
        expectsProfit: true,
      },
    });
    await subscribe({}, before);
    // Now registered: the VAT term is a new question
    mockBrreg(200, enkEnhet);

    const summary = await refreshCompanies(inEightDays());

    expect(summary.answersOutdated).toBe(1);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe(
      "Opplysningene om AYSE FRISØR har endret seg",
    );
    expect(emails[0]?.text).toContain(
      `Svar på spørsmålene: http://web.test/assessments/${before.id}`,
    );
    // The subscription goes on
    expect(
      await Subscription.count({ where: { assessmentId: before.id } }),
    ).toBe(1);

    // Asked once: the next refresh finds the answers already out of date
    await refreshCompanies(new Date(Date.now() + 16 * DAY_MS));
    expect(emails).toHaveLength(1);
  });

  it("leaves recent snapshots and assessments without reminders alone", async () => {
    const withoutReminders = await createAssessment();
    await subscribe({ status: "pending" }, withoutReminders);
    await subscribe();
    const fetchMock = mockBrreg(200, enkEnhet);

    await refreshCompanies(new Date(Date.now() + 6 * DAY_MS));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops the reminders for a company that is gone from the register", async () => {
    await subscribe();
    mockBrreg(404);

    const summary = await refreshCompanies(inEightDays());

    expect(summary).toEqual({
      refreshed: 0,
      answersOutdated: 0,
      stopped: 1,
      failed: 0,
    });
    expect(await Subscription.count()).toBe(0);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe("Påminnelsene for AYSE FRISØR er stoppet");
  });

  it("keeps the snapshot and tries again later when Brreg cannot be reached", async () => {
    await subscribe();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const before = assessment.companyRefreshedAt.getTime();

    const summary = await refreshCompanies(inEightDays());

    expect(summary).toEqual({
      refreshed: 0,
      answersOutdated: 0,
      stopped: 0,
      failed: 1,
    });
    await assessment.reload();
    expect(assessment.companyRefreshedAt.getTime()).toBe(before);
    expect(await Subscription.count()).toBe(1);
  });
});

describe("cleaning up", () => {
  it("deletes unconfirmed subscriptions whose link has run out", async () => {
    await subscribe({
      email: "expired@example.com",
      status: "pending",
      confirmExpiresAt: new Date(Date.now() - 1000),
    });
    await subscribe({
      email: "waiting@example.com",
      status: "pending",
      confirmExpiresAt: new Date(Date.now() + DAY_MS),
    });

    const summary = await cleanUp(new Date());

    expect(summary.unconfirmedSubscriptions).toBe(1);
    const left = await Subscription.findAll();
    expect(left.map((s) => s.email)).toEqual(["waiting@example.com"]);
  });

  it("deletes assessments without subscriptions after 30 days", async () => {
    const withReminders = await createAssessment();
    await subscribe({}, withReminders);

    expect(
      (await cleanUp(new Date(Date.now() + 29 * DAY_MS))).assessments,
    ).toBe(0);
    const summary = await cleanUp(new Date(Date.now() + 31 * DAY_MS));

    expect(summary.assessments).toBe(1);
    const left = await Assessment.findAll();
    expect(left.map((a) => a.id)).toEqual([withReminders.id]);
  });

  it("deletes the record of reminders sent more than a year ago", async () => {
    const subscription = await subscribe();
    await ReminderDelivery.bulkCreate([
      {
        subscriptionId: subscription.id,
        obligationId: "vat-return",
        deadline: "2025-10-10",
        daysBefore: 3,
        sentAt: new Date(Date.now() - 366 * DAY_MS),
      },
      {
        subscriptionId: subscription.id,
        obligationId: "vat-return",
        deadline: "2026-10-12",
        daysBefore: 3,
        sentAt: new Date(Date.now() - 40 * DAY_MS),
      },
    ]);

    const summary = await cleanUp(new Date());

    expect(summary.deliveries).toBe(1);
    expect(await ReminderDelivery.count()).toBe(1);
  });
});

describe("a whole run", () => {
  it("cleans up, refreshes, sends and logs a summary", async () => {
    await subscribe();

    const summary = await runReminders(morning("2026-11-26"));

    expect(summary?.send.emailsSent).toBe(1);
    const line = logs.lines.find((l) => l.msg?.startsWith("Reminders:"));
    expect(line?.msg).toBe("Reminders: 1 emails sent, 0 failed");
    // No email addresses in the logs
    expect(logs.raw.join("")).not.toContain("ayse@example.com");
  });
});

describe("the daily schedule", () => {
  it("runs from 07:00 Norwegian time, once a day", () => {
    // 05:59 and 06:00 UTC are 06:59 and 07:00 in Norwegian winter time
    expect(isRunDue(new Date("2026-11-26T05:59:00Z"), null)).toBe(false);
    expect(isRunDue(new Date("2026-11-26T06:00:00Z"), null)).toBe(true);
    expect(isRunDue(new Date("2026-11-26T15:00:00Z"), "2026-11-26")).toBe(
      false,
    );
    expect(isRunDue(new Date("2026-11-27T06:00:00Z"), "2026-11-26")).toBe(true);
  });

  it("follows summer time", () => {
    // 05:00 UTC is 07:00 in Norwegian summer time
    expect(hourInNorway(new Date("2026-06-01T05:00:00Z"))).toBe(7);
    expect(hourInNorway(new Date("2026-12-01T05:00:00Z"))).toBe(6);
  });

  it("can be moved with EMAIL_HOUR", () => {
    vi.stubEnv("EMAIL_HOUR", "9");

    expect(isRunDue(new Date("2026-11-26T07:00:00Z"), null)).toBe(false);
    expect(isRunDue(new Date("2026-11-26T08:00:00Z"), null)).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("dates in emails", () => {
  it("are written out in each language", () => {
    expect(formatDate("2026-12-10", "nb")).toBe("torsdag 10. desember 2026");
    expect(formatDate("2026-12-10", "en")).toBe("Thursday 10 December 2026");
  });
});
