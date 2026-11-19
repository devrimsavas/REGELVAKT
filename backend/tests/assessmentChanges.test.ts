import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { Assessment } from "../src/models/Assessment.js";
import { ReminderDelivery } from "../src/models/ReminderDelivery.js";
import { Subscription } from "../src/models/Subscription.js";
import { markUsed } from "../src/services/assessmentService.js";
import { createAssessment, enkEnhet } from "./helpers/assessments.js";

const DAY_MS = 24 * 60 * 60 * 1000;

let assessment: Assessment;

beforeEach(async () => {
  assessment = await createAssessment();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PATCH /api/assessments/:id", () => {
  const newAnswers = {
    vatTerm: "bimonthly",
    paysSalary: true,
    expectsProfit: true,
  };

  it("changes the answers and answers with the new result", async () => {
    const res = await request(app)
      .patch(`/api/assessments/${assessment.id}`)
      .send({ answers: newAnswers });

    expect(res.status).toBe(200);
    expect(res.body.answers).toEqual(newAnswers);
    const ids = res.body.result.obligations.map((o: { id: string }) => o.id);
    // Paying salaries adds the payroll obligations
    expect(ids).toContain("a-melding");
    expect(ids).toContain("employer-contribution");
    await assessment.reload();
    expect(assessment.answers).toEqual(newAnswers);
  });

  it("keeps the subscriptions and the record of sent reminders", async () => {
    const subscription = await Subscription.create({
      assessmentId: assessment.id,
      email: "ayse@example.com",
      language: "nb",
      reminderDays: [14, 3],
      status: "active",
      consentedAt: new Date(),
      confirmedAt: new Date(),
    });
    await ReminderDelivery.create({
      subscriptionId: subscription.id,
      obligationId: "vat-return",
      deadline: "2026-12-10",
      daysBefore: 14,
      sentAt: new Date(),
    });

    await request(app)
      .patch(`/api/assessments/${assessment.id}`)
      .send({ answers: newAnswers });

    expect(await Subscription.count()).toBe(1);
    expect(await ReminderDelivery.count()).toBe(1);
  });

  it("checks the answers the same way as a new assessment", async () => {
    const res = await request(app)
      .patch(`/api/assessments/${assessment.id}`)
      .send({ answers: { vatTerm: "weekly", expectsSalesOver50k: true } });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      "'expectsSalesOver50k' is not a question for this company",
      "'vatTerm' must be one of: bimonthly, annual, unknown",
      "'paysSalary' must be answered",
      "'expectsProfit' must be answered",
    ]);
    await assessment.reload();
    expect(assessment.answers.paysSalary).toBe(false);
  });

  it("does not call Brreg", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await request(app)
      .patch(`/api/assessments/${assessment.id}`)
      .send({ answers: newAnswers });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 for an invalid id and 404 for an unknown assessment", async () => {
    const invalid = await request(app)
      .patch("/api/assessments/abc")
      .send({ answers: newAnswers });
    const unknown = await request(app)
      .patch("/api/assessments/6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31")
      .send({ answers: newAnswers });

    expect(invalid.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it("answers 422 when the company's organization form is not supported any more", async () => {
    const nuf = await createAssessment({
      enhet: {
        ...enkEnhet,
        organisasjonsform: {
          kode: "NUF",
          beskrivelse: "Norskregistrert utenlandsk foretak",
        },
      },
    });

    const res = await request(app)
      .patch(`/api/assessments/${nuf.id}`)
      .send({ answers: newAnswers });

    expect(res.status).toBe(422);
    expect(res.body.organizationForm).toBe("NUF");
  });
});

describe("GET /api/assessments/:id/questions", () => {
  it("gives the questions from the stored company data and the current answers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const res = await request(app).get(
      `/api/assessments/${assessment.id}/questions`,
    );

    expect(res.status).toBe(200);
    expect(res.body.supported).toBe(true);
    expect(res.body.organizationForm).toBe("ENK");
    expect(res.body.questions.map((q: { id: string }) => q.id)).toEqual([
      "vatTerm",
      "paysSalary",
      "expectsProfit",
    ]);
    expect(res.body.answers).toEqual({
      vatTerm: "bimonthly",
      paysSalary: false,
      expectsProfit: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("answersNeedUpdate", () => {
  it("is false while the answers fit the company", async () => {
    const res = await request(app).get(`/api/assessments/${assessment.id}`);

    expect(res.body.answersNeedUpdate).toBe(false);
  });

  it("is true when the company data has changed so that they do not", async () => {
    // As the weekly refresh would store it: now not VAT-registered, so the
    // VAT term is no longer asked and the 50 000 question is
    await assessment.update({
      companySnapshot: { ...assessment.companySnapshot, vatRegistered: false },
    });

    const res = await request(app).get(`/api/assessments/${assessment.id}`);

    expect(res.body.answersNeedUpdate).toBe(true);
  });
});

describe("keeping track of use", () => {
  it("records reading an assessment, at most once a day", async () => {
    const lastWeek = new Date(Date.now() - 7 * DAY_MS);
    await Assessment.update(
      { lastAccessedAt: lastWeek },
      { where: { id: assessment.id } },
    );
    await assessment.reload();
    const updatedAt = assessment.updatedAt.getTime();

    await request(app).get(`/api/assessments/${assessment.id}`);
    await assessment.reload();
    const firstUse = assessment.lastAccessedAt.getTime();

    expect(firstUse).toBeGreaterThan(lastWeek.getTime());
    // Nothing in the assessment changed
    expect(assessment.updatedAt.getTime()).toBe(updatedAt);

    await request(app).get(`/api/assessments/${assessment.id}`);
    await assessment.reload();
    expect(assessment.lastAccessedAt.getTime()).toBe(firstUse);
  });

  it("does not write when the assessment was used within the last day", async () => {
    const spy = vi.spyOn(Assessment, "update");

    await markUsed(assessment);

    expect(spy).not.toHaveBeenCalled();
  });
});
