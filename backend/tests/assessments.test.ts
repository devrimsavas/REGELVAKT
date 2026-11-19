import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { Assessment } from "../src/models/Assessment.js";
import { RULES_VERSION } from "../src/rules/version.js";
import type { BrregEnhet } from "../src/types/brreg.js";

// A valid organization number (the mod 11 check digit matches)
const ORG_NUMBER = "974760673";

const enkEnhet: BrregEnhet = {
  organisasjonsnummer: ORG_NUMBER,
  navn: "AYSE FRISØR",
  organisasjonsform: { kode: "ENK", beskrivelse: "Enkeltpersonforetak" },
  naeringskode1: { kode: "96.021", beskrivelse: "Frisering" },
  registrertIMvaregisteret: true,
  registrertIForetaksregisteret: false,
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
};

const ayseAnswers = {
  vatTerm: "bimonthly",
  paysSalary: false,
  expectsProfit: true,
};

// Replaces fetch so the tests never call the real Brreg API
function mockBrreg(status: number, body?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  // Only the date is fixed; timers stay real for the database driver
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/companies/:orgNumber/questions", () => {
  it("returns the questions for this company, without server-side logic", async () => {
    mockBrreg(200, enkEnhet);

    const res = await request(app).get(
      `/api/companies/${ORG_NUMBER}/questions`,
    );

    expect(res.status).toBe(200);
    expect(res.body.supported).toBe(true);
    expect(res.body.questions.map((q: { id: string }) => q.id)).toEqual([
      "vatTerm",
      "paysSalary",
      "expectsProfit",
    ]);
    expect(res.body.questions[0].options).toHaveLength(3);
    expect(res.body.questions[0].askWhen).toBeUndefined();
  });

  it("says when the organization form is not supported", async () => {
    mockBrreg(200, {
      ...enkEnhet,
      organisasjonsform: { kode: "ORGL", beskrivelse: "Organisasjonsledd" },
    });

    const res = await request(app).get(
      `/api/companies/${ORG_NUMBER}/questions`,
    );

    expect(res.body).toEqual({
      supported: false,
      organizationForm: "ORGL",
      questions: [],
    });
  });
});

describe("POST /api/assessments", () => {
  it("creates an assessment and returns the obligations", async () => {
    mockBrreg(200, enkEnhet);

    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, answers: ayseAnswers });

    expect(res.status).toBe(201);
    expect(res.body.company.name).toBe("AYSE FRISØR");
    expect(res.body.rulesVersionAtCreation).toBe(RULES_VERSION);
    expect(res.body.result.supported).toBe(true);
    expect(
      res.body.result.obligations.map(
        (o: { id: string; nextDeadline: string | null }) => [
          o.id,
          o.nextDeadline,
        ],
      ),
    ).toEqual([
      ["vat-return", "2026-12-10"],
      ["advance-tax-enk", "2026-12-15"],
      ["tax-return-enk", "2027-05-31"],
      ["bookkeeping", null],
    ]);

    // Stored with the company snapshot and the answers
    const stored = await Assessment.findByPk(res.body.id);
    expect(stored?.answers).toEqual(ayseAnswers);
    expect(stored?.companySnapshot.organizationForm).toBe("ENK");
  });

  it("rejects an invalid organization number without calling Brreg", async () => {
    const fetchMock = mockBrreg(200, enkEnhet);

    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: "123", answers: ayseAnswers });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists every problem with the answers and stores nothing", async () => {
    mockBrreg(200, enkEnhet);

    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, answers: { vatTerm: "weekly" } });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      "'vatTerm' must be one of: bimonthly, annual, unknown",
      "'paysSalary' must be answered",
      "'expectsProfit' must be answered",
    ]);
    expect(await Assessment.count()).toBe(0);
  });

  it("refuses an unsupported organization form", async () => {
    mockBrreg(200, {
      ...enkEnhet,
      organisasjonsform: { kode: "ORGL", beskrivelse: "Organisasjonsledd" },
    });

    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, answers: {} });

    expect(res.status).toBe(422);
    expect(res.body.organizationForm).toBe("ORGL");
  });

  it("returns 404 for an unknown company", async () => {
    mockBrreg(404);

    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, answers: ayseAnswers });

    expect(res.status).toBe(404);
  });

  it("answers invalid JSON with a JSON error", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Request body is not valid JSON");
  });
});

describe("GET /api/assessments/:id", () => {
  it("recalculates the deadlines from today's date", async () => {
    mockBrreg(200, enkEnhet);
    const created = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, answers: ayseAnswers });

    // A month later the December VAT deadline has passed
    vi.setSystemTime(new Date("2026-12-20T10:00:00Z"));

    const res = await request(app).get(`/api/assessments/${created.body.id}`);

    expect(res.status).toBe(200);
    const vat = res.body.result.obligations.find(
      (o: { id: string }) => o.id === "vat-return",
    );
    expect(vat.nextDeadline).toBe("2027-02-10");
  });

  it("returns 404 for an unknown id and 400 for a malformed one", async () => {
    const unknown = await request(app).get(
      "/api/assessments/5f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
    );
    expect(unknown.status).toBe(404);

    const malformed = await request(app).get("/api/assessments/42");
    expect(malformed.status).toBe(400);
  });
});
