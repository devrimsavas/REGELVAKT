import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import type { Assessment } from "../src/models/Assessment.js";
import { ReminderDelivery } from "../src/models/ReminderDelivery.js";
import { Subscription } from "../src/models/Subscription.js";
import {
  EmailError,
  setEmailSender,
} from "../src/services/email/emailSender.js";
import { manageToken } from "../src/utils/tokens.js";
import { createAssessment } from "./helpers/assessments.js";
import { tokenFrom, useEmails } from "./helpers/emails.js";
import { LEVELS, useLogs } from "./helpers/logs.js";

const emails = useEmails();
const logs = useLogs();

// The rate limit counts are kept in memory between tests, so each request
// comes from its own client address unless a test says otherwise
let nextAddress = 1;
function newAddress(): string {
  return `198.51.100.${nextAddress++}`;
}

const validBody = {
  email: "Ayse@Example.com ",
  language: "nb",
  reminderDays: [3, 14],
  consent: true,
};

let assessment: Assessment;

beforeEach(async () => {
  // Most tests use the same address; the limit tests set their own
  vi.stubEnv("SUBSCRIPTIONS_PER_EMAIL", "1000");
  assessment = await createAssessment();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function subscribe(body: unknown = validBody, id = assessment.id) {
  return request(app)
    .post(`/api/assessments/${id}/subscriptions`)
    .set("X-Forwarded-For", newAddress())
    .send(body as object);
}

// Subscribes and confirms; returns the manage token
async function activeSubscription(body: unknown = validBody): Promise<string> {
  await subscribe(body);
  const res = await request(app)
    .post("/api/subscriptions/confirm")
    .send({ token: tokenFrom(emails.at(-1), "/reminders/confirm") });
  return res.body.manageToken as string;
}

describe("POST /api/assessments/:id/subscriptions", () => {
  it("stores a pending subscription and emails a confirmation link", async () => {
    const res = await subscribe();

    expect(res.status).toBe(202);
    const rows = await Subscription.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assessmentId: assessment.id,
      email: "ayse@example.com",
      language: "nb",
      reminderDays: [14, 3],
      status: "pending",
      confirmedAt: null,
    });
    expect(rows[0]?.consentedAt).toBeInstanceOf(Date);

    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe("ayse@example.com");
    expect(emails[0]?.subject).toBe("Bekreft påminnelser for AYSE FRISØR");
    expect(emails[0]?.text).toContain(
      "http://web.test/reminders/confirm?token=",
    );
    expect(emails[0]?.html).toContain("Bekreft påminnelser");
  });

  it("stores only a hash of the confirmation token", async () => {
    await subscribe();

    const token = tokenFrom(emails[0], "/reminders/confirm");
    const row = await Subscription.findOne();
    expect(row?.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.confirmTokenHash).not.toContain(token);
  });

  it("uses Norwegian and 14 and 3 days when they are left out", async () => {
    await subscribe({ email: "kari@example.com", consent: true });

    const row = await Subscription.findOne();
    expect(row?.language).toBe("nb");
    expect(row?.reminderDays).toEqual([14, 3]);
  });

  it("writes the email in English when asked", async () => {
    await subscribe({ ...validBody, language: "en" });

    expect(emails[0]?.subject).toBe("Confirm reminders for AYSE FRISØR");
  });

  it("lists every problem with the input", async () => {
    const res = await subscribe({
      email: "not-an-address",
      language: "de",
      reminderDays: [14, 14, 2],
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      "email must be a valid email address",
      "language must be one of: nb, en",
      "reminderDays must be a list of different numbers from: 1, 3, 7, 14, 30",
      "consent must be true",
    ]);
    expect(await Subscription.count()).toBe(0);
    expect(emails).toHaveLength(0);
  });

  it("needs consent to be exactly true", async () => {
    const res = await subscribe({ ...validBody, consent: "yes" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(["consent must be true"]);
  });

  it("answers 400 for an invalid id and 404 for an unknown assessment", async () => {
    expect((await subscribe(validBody, "not-a-uuid")).status).toBe(400);
    expect(
      (await subscribe(validBody, "6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31"))
        .status,
    ).toBe(404);
  });

  it("sends a new link for a pending subscription; the old one stops working", async () => {
    await subscribe();
    const oldToken = tokenFrom(emails[0], "/reminders/confirm");

    const res = await subscribe({ ...validBody, reminderDays: [7] });

    expect(res.status).toBe(202);
    expect(await Subscription.count()).toBe(1);
    expect((await Subscription.findOne())?.reminderDays).toEqual([7]);
    expect(emails).toHaveLength(2);
    const old = await request(app)
      .post("/api/subscriptions/confirm")
      .send({ token: oldToken });
    expect(old.status).toBe(400);
  });

  it("answers the same for an active subscription and only tells its owner", async () => {
    await activeSubscription();
    emails.length = 0;

    const res = await subscribe({ ...validBody, reminderDays: [1] });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      message:
        "If the address can get reminders, a confirmation email is on its way",
    });
    const row = await Subscription.findOne();
    expect(row?.status).toBe("active");
    expect(row?.reminderDays).toEqual([14, 3]);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe(
      "Du får allerede påminnelser for AYSE FRISØR",
    );
    expect(emails[0]?.text).toContain(
      "http://web.test/reminders/manage?token=",
    );
    expect(emails[0]?.headers?.["List-Unsubscribe"]).toMatch(
      /^<http:\/\/web\.test\/reminders\/unsubscribe\/one-click\?token=.+>$/,
    );
    expect(emails[0]?.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("answers 502 and logs the cause when the email cannot be sent", async () => {
    setEmailSender({
      async send() {
        throw new EmailError("Resend refused the email (500)");
      },
    });

    const res = await subscribe();

    expect(res.status).toBe(502);
    const line = logs.lines.find((l) => l.msg === "Could not send the email");
    expect(line?.level).toBe(LEVELS.error);
    // The address is not in the logs
    expect(logs.raw.join("")).not.toContain("ayse@example.com");
  });

  it("limits new subscriptions per email address, from any client", async () => {
    vi.stubEnv("SUBSCRIPTIONS_PER_EMAIL", "2");
    const body = { ...validBody, email: "limit@example.com" };

    expect((await subscribe(body)).status).toBe(202);
    expect((await subscribe(body)).status).toBe(202);
    const blocked = await subscribe(body);

    expect(blocked.status).toBe(429);
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(emails).toHaveLength(2);
  });

  it("limits new subscriptions per client address", async () => {
    vi.stubEnv("SUBSCRIPTIONS_PER_ADDRESS", "1");
    const address = newAddress();
    const send = (email: string) =>
      request(app)
        .post(`/api/assessments/${assessment.id}/subscriptions`)
        .set("X-Forwarded-For", address)
        .send({ ...validBody, email });

    expect((await send("one@example.com")).status).toBe(202);
    expect((await send("two@example.com")).status).toBe(429);
  });
});

describe("POST /api/subscriptions/confirm", () => {
  it("turns the subscription on and gives the manage token", async () => {
    await subscribe();

    const res = await request(app)
      .post("/api/subscriptions/confirm")
      .send({ token: tokenFrom(emails[0], "/reminders/confirm") });

    expect(res.status).toBe(200);
    const row = await Subscription.findOne();
    expect(row?.status).toBe("active");
    expect(row?.confirmedAt).toBeInstanceOf(Date);
    expect(res.body).toMatchObject({
      assessmentId: assessment.id,
      orgNumber: "974760673",
      companyName: "AYSE FRISØR",
      email: "ayse@example.com",
      status: "active",
      manageToken: manageToken(row?.id ?? ""),
    });
  });

  it("can be used twice", async () => {
    await subscribe();
    const token = tokenFrom(emails[0], "/reminders/confirm");

    await request(app).post("/api/subscriptions/confirm").send({ token });
    const again = await request(app)
      .post("/api/subscriptions/confirm")
      .send({ token });

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("active");
  });

  it("refuses a link older than 48 hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
    await subscribe();
    vi.setSystemTime(new Date("2026-11-21T10:00:01Z"));

    const res = await request(app)
      .post("/api/subscriptions/confirm")
      .send({ token: tokenFrom(emails[0], "/reminders/confirm") });

    expect(res.status).toBe(400);
    expect((await Subscription.findOne())?.status).toBe("pending");
  });

  it("refuses a token that is not one of ours", async () => {
    const res = await request(app)
      .post("/api/subscriptions/confirm")
      .send({ token: "made-up" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("This link is not valid or has expired");
  });
});

describe("managing with the manage token", () => {
  it("reads the subscription", async () => {
    const token = await activeSubscription();

    const res = await request(app)
      .post("/api/subscriptions/lookup")
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      companyName: "AYSE FRISØR",
      language: "nb",
      reminderDays: [14, 3],
      status: "active",
    });
  });

  it("refuses a token with a wrong signature", async () => {
    const token = await activeSubscription();
    const tampered = `${token.slice(0, -2)}xx`;

    const res = await request(app)
      .post("/api/subscriptions/lookup")
      .send({ token: tampered });

    expect(res.status).toBe(400);
  });

  it("refuses a token made with another secret", async () => {
    const token = await activeSubscription();
    vi.stubEnv("SUBSCRIPTION_SECRET", "another-secret-that-is-32-characters!!");

    const res = await request(app)
      .post("/api/subscriptions/lookup")
      .send({ token });

    expect(res.status).toBe(400);
  });

  it("changes the language and the reminder days", async () => {
    const token = await activeSubscription();

    const res = await request(app)
      .patch("/api/subscriptions")
      .send({ token, language: "en", reminderDays: [1, 30, 7] });

    expect(res.status).toBe(200);
    expect(res.body.language).toBe("en");
    expect(res.body.reminderDays).toEqual([30, 7, 1]);
  });

  it("refuses settings that are missing or wrong", async () => {
    const token = await activeSubscription();

    const empty = await request(app)
      .patch("/api/subscriptions")
      .send({ token });
    const wrong = await request(app)
      .patch("/api/subscriptions")
      .send({ token, reminderDays: [] });

    expect(empty.status).toBe(400);
    expect(empty.body.details).toEqual(["Give language, reminderDays or both"]);
    expect(wrong.status).toBe(400);
  });

  it("stops the reminders by deleting the subscription", async () => {
    const token = await activeSubscription();

    const res = await request(app)
      .post("/api/subscriptions/unsubscribe")
      .send({ token });

    expect(res.status).toBe(200);
    expect(await Subscription.count()).toBe(0);
    // A second click is fine; reading it now says it is gone
    const again = await request(app)
      .post("/api/subscriptions/unsubscribe")
      .send({ token });
    const lookup = await request(app)
      .post("/api/subscriptions/lookup")
      .send({ token });
    expect(again.status).toBe(200);
    expect(lookup.status).toBe(404);
  });

  it("refuses to unsubscribe with a made-up token", async () => {
    await activeSubscription();

    const res = await request(app)
      .post("/api/subscriptions/unsubscribe")
      .send({ token: "6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31.fake" });

    expect(res.status).toBe(400);
    expect(await Subscription.count()).toBe(1);
  });
});

describe("DELETE /api/assessments/:id", () => {
  it("deletes the assessment with its subscriptions and sent reminders", async () => {
    await activeSubscription();
    const subscription = await Subscription.findOne();
    await ReminderDelivery.create({
      subscriptionId: subscription?.id,
      obligationId: "vat-return",
      deadline: "2026-12-10",
      daysBefore: 14,
      sentAt: new Date(),
    });

    const res = await request(app).delete(`/api/assessments/${assessment.id}`);

    expect(res.status).toBe(204);
    expect(await Subscription.count()).toBe(0);
    expect(await ReminderDelivery.count()).toBe(0);
    const read = await request(app).get(`/api/assessments/${assessment.id}`);
    expect(read.status).toBe(404);
  });

  it("answers 404 for an unknown assessment and 400 for an invalid id", async () => {
    const unknown = await request(app).delete(
      "/api/assessments/6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31",
    );
    const invalid = await request(app).delete("/api/assessments/abc");

    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});
