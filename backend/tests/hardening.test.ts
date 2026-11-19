// Brreg answers, the Brreg cache, winding-up warnings, the official links
// and the lock that lets only one reminder run go on at a time.
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { sequelize } from "../src/config/database.js";
import { toCompany } from "../src/mappers/companyMapper.js";
import { Subscription } from "../src/models/Subscription.js";
import { fromIsoDate } from "../src/rules/calendar.js";
import { assess } from "../src/rules/engine.js";
import { OBLIGATIONS } from "../src/rules/obligations.js";
import { WARNINGS } from "../src/rules/warnings.js";
import { BrregError, lookupCompany } from "../src/services/brregService.js";
import {
  REMINDER_LOCK_KEY,
  refreshCompanies,
  runReminders,
  sendDueReminders,
} from "../src/services/reminderService.js";
import {
  createAssessment,
  enkEnhet,
  ORG_NUMBER,
} from "./helpers/assessments.js";
import { useEmails } from "./helpers/emails.js";
import { useLogs } from "./helpers/logs.js";

const emails = useEmails();
const logs = useLogs();

const DAY_MS = 24 * 60 * 60 * 1000;

function mockBrreg(status: number, body?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Brreg answers", () => {
  it("are refused when a field everything depends on is missing", async () => {
    const { navn: _navn, ...withoutName } = enkEnhet;
    mockBrreg(200, withoutName);

    await expect(lookupCompany(ORG_NUMBER)).rejects.toBeInstanceOf(BrregError);
  });

  it("are refused when they are about another company", async () => {
    mockBrreg(200, { ...enkEnhet, organisasjonsnummer: "923609016" });

    await expect(lookupCompany(ORG_NUMBER)).rejects.toThrow(
      "unexpected answer",
    );
  });

  it("are refused when they are not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>maintenance</html>", { status: 200 }),
    );

    await expect(lookupCompany(ORG_NUMBER)).rejects.toThrow("not JSON");
  });

  it("make the API answer 502 instead of storing a broken company", async () => {
    mockBrreg(200, { ...enkEnhet, organisasjonsform: {} });

    const res = await request(app)
      .post("/api/assessments")
      .set("X-Forwarded-For", "203.0.113.200")
      .send({ orgNumber: ORG_NUMBER, answers: {} });

    expect(res.status).toBe(502);
  });
});

describe("Brreg cache", () => {
  it("asks Brreg once for the same active company within ten minutes", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    await lookupCompany(ORG_NUMBER);
    await lookupCompany(ORG_NUMBER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again after ten minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T08:00:00Z"));
    const fetchMock = mockBrreg(200, enkEnhet);

    await lookupCompany(ORG_NUMBER);
    vi.setSystemTime(new Date("2026-11-26T08:10:01Z"));
    await lookupCompany(ORG_NUMBER);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not keep unknown companies, which may be registered any minute", async () => {
    const fetchMock = mockBrreg(404);

    await lookupCompany(ORG_NUMBER);
    await lookupCompany(ORG_NUMBER);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is skipped when fresh data is asked for", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    await lookupCompany(ORG_NUMBER);
    await lookupCompany(ORG_NUMBER, { fresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is used by the questions and the assessment that follow a lookup", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    await request(app)
      .get(`/api/companies/${ORG_NUMBER}`)
      .set("X-Forwarded-For", "203.0.113.201");
    await request(app)
      .get(`/api/companies/${ORG_NUMBER}/questions`)
      .set("X-Forwarded-For", "203.0.113.201");
    const created = await request(app)
      .post("/api/assessments")
      .set("X-Forwarded-For", "203.0.113.201")
      .send({
        orgNumber: ORG_NUMBER,
        answers: {
          vatTerm: "bimonthly",
          paysSalary: false,
          expectsProfit: true,
        },
      });

    expect(created.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("winding-up warnings", () => {
  const today = fromIsoDate("2026-11-26");
  const answers = {
    vatTerm: "bimonthly",
    paysSalary: false,
    expectsProfit: true,
  } as const;
  const warningsFor = (flags: Partial<typeof enkEnhet>) => {
    const result = assess(toCompany({ ...enkEnhet, ...flags }), answers, today);
    if (!result.supported) throw new Error("expected a supported result");
    return result.warnings.map((w) => w.id);
  };

  it("tell when the company is bankrupt, under forced liquidation or being wound up", () => {
    expect(warningsFor({ konkurs: true })).toEqual(["company-bankrupt"]);
    expect(
      warningsFor({ underTvangsavviklingEllerTvangsopplosning: true }),
    ).toEqual(["company-forced-liquidation"]);
    expect(warningsFor({ underAvvikling: true })).toEqual([
      "company-under-liquidation",
    ]);
    expect(warningsFor({})).toEqual([]);
  });

  it("show only the most serious one", () => {
    expect(warningsFor({ konkurs: true, underAvvikling: true })).toEqual([
      "company-bankrupt",
    ]);
  });
});

describe("reminders for a bankrupt company", () => {
  const bankrupt = { ...enkEnhet, konkurs: true };

  async function activeSubscription(assessmentId: string) {
    return Subscription.create({
      assessmentId,
      email: "ayse@example.com",
      language: "nb",
      reminderDays: [14, 3],
      status: "active",
      consentedAt: new Date(),
      confirmedAt: new Date(),
    });
  }

  it("stop when the weekly refresh finds the bankruptcy, and the subscribers are told", async () => {
    const assessment = await createAssessment();
    await activeSubscription(assessment.id);
    mockBrreg(200, bankrupt);

    const summary = await refreshCompanies(new Date(Date.now() + 8 * DAY_MS));

    expect(summary.stopped).toBe(1);
    expect(await Subscription.count()).toBe(0);
    expect(emails[0]?.text).toContain("er konkurs");
    expect(emails[0]?.text).toContain("bostyreren");
    // The page shows the bankruptcy
    await assessment.reload();
    expect(assessment.companySnapshot.isBankrupt).toBe(true);
  });

  it("are never sent, even for a subscription that is still there", async () => {
    const assessment = await createAssessment({ enhet: bankrupt });
    await activeSubscription(assessment.id);

    await sendDueReminders(new Date("2026-11-26T07:00:00Z"));

    expect(emails).toHaveLength(0);
  });

  it("cannot be asked for", async () => {
    const assessment = await createAssessment({ enhet: bankrupt });

    const res = await request(app)
      .post(`/api/assessments/${assessment.id}/subscriptions`)
      .set("X-Forwarded-For", "203.0.113.202")
      .send({ email: "ayse@example.com", consent: true });

    expect(res.status).toBe(422);
    expect(emails).toHaveLength(0);
  });
});

describe("official links", () => {
  const OFFICIAL =
    /^https:\/\/(www\.|info\.|skatt\.|data\.)?(skatteetaten|brreg|lovdata|altinn)\.no\//;

  it("all go to an official site over HTTPS", () => {
    for (const obligation of OBLIGATIONS) {
      expect(obligation.sourceUrl, obligation.id).toMatch(OFFICIAL);
      if (obligation.filingUrl !== null) {
        expect(obligation.filingUrl, obligation.id).toMatch(OFFICIAL);
      }
    }
    for (const warning of WARNINGS) {
      expect(warning.sourceUrl, warning.id).toMatch(OFFICIAL);
    }
  });

  it("include where to file, in the reminder email", async () => {
    const assessment = await createAssessment();
    await Subscription.create({
      assessmentId: assessment.id,
      email: "ayse@example.com",
      language: "nb",
      reminderDays: [14],
      status: "active",
      consentedAt: new Date(),
      confirmedAt: new Date(),
    });

    await sendDueReminders(new Date("2026-11-26T07:00:00Z"));

    expect(emails[0]?.text).toContain(
      "Gå til innlevering: https://skatt.skatteetaten.no/web/mva/",
    );
  });
});

describe("the reminder run lock", () => {
  it("lets only one run go on at a time", async () => {
    const assessment = await createAssessment();
    await Subscription.create({
      assessmentId: assessment.id,
      email: "ayse@example.com",
      language: "nb",
      reminderDays: [14],
      status: "active",
      consentedAt: new Date(),
      confirmedAt: new Date(),
    });

    // Another run holds the lock
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = () => {};
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const other = sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(:key)", {
        replacements: { key: REMINDER_LOCK_KEY },
        transaction,
      });
      locked();
      await held;
    });
    await isLocked;

    const skipped = await runReminders(new Date("2026-11-26T07:00:00Z"));
    release();
    await other;

    expect(skipped).toBeNull();
    expect(emails).toHaveLength(0);
    expect(
      logs.lines.some((l) => l.msg?.startsWith("Another reminder run")),
    ).toBe(true);

    // With the lock free again, the run goes on
    const summary = await runReminders(new Date("2026-11-26T07:00:00Z"));
    expect(summary?.send.emailsSent).toBe(1);
  });
});
