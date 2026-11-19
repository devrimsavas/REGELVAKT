import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { LEVELS, useLogs } from "./helpers/logs.js";

const logs = useLogs();

// A valid organization number (Brønnøysundregistrene)
const ORG_NUMBER = "974760673";

// The rate limit counts live in the API's memory, not in the database, so
// they are not emptied between tests. Each test therefore sends its
// requests as its own client addresses (through X-Forwarded-For, which the
// API trusts from this machine).
let nextAddress = 1;
function newAddress(): string {
  return `203.0.113.${nextAddress++}`;
}

// Replaces fetch so the tests never call the real Brreg API
function mockBrregNotFound() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(null, { status: 404 }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("are sent without telling that it is Express", async () => {
    const res = await request(app).get("/api");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(res.headers).not.toHaveProperty("x-powered-by");
  });

  it("are also sent with errors", async () => {
    const res = await request(app).get("/api/assessments/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers).not.toHaveProperty("x-powered-by");
  });

  it("do not upgrade the API docs to HTTPS, so they work over http", async () => {
    const res = await request(app).get("/api");

    expect(res.headers["content-security-policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("request id", () => {
  it("is created for every request and sent back", async () => {
    const res = await request(app).get("/api");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a valid id sent by the caller", async () => {
    const res = await request(app)
      .get("/api")
      .set("X-Request-Id", "web-page-1234abcd");

    expect(res.headers["x-request-id"]).toBe("web-page-1234abcd");
  });

  it("replaces an id that is not safe to log", async () => {
    const res = await request(app)
      .get("/api")
      .set("X-Request-Id", "id with spaces {and} braces");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("request log", () => {
  it("writes one line per request with method, path, status and time", async () => {
    const res = await request(app).get("/api");

    const line = logs.lines.find((l) => l.msg?.startsWith("GET /api 200"));
    expect(line?.level).toBe(LEVELS.info);
    expect(line?.msg).toMatch(/^GET \/api 200 \d+ ms$/);
    expect(line?.requestId).toBe(res.headers["x-request-id"]);
  });

  it("leaves out query strings, bodies and headers", async () => {
    await request(app)
      .get("/api/companies/123?search=hidden-query-word")
      .set("Authorization", "Bearer hidden-token-value");
    await request(app)
      .post("/api/assessments")
      .send({ orgNumber: "hidden-body-value" });

    expect(
      logs.lines.some((l) => l.msg?.startsWith("GET /api/companies/123 400")),
    ).toBe(true);
    const all = logs.raw.join("");
    expect(all).not.toContain("hidden-query-word");
    expect(all).not.toContain("hidden-token-value");
    expect(all).not.toContain("hidden-body-value");
  });
});

describe("request body", () => {
  it("is refused with 413 when it is larger than 10 kb", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .send({ orgNumber: ORG_NUMBER, padding: "x".repeat(11 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe("Request body is too large");
  });
});

describe("rate limits", () => {
  it("stop Brreg lookups from one address after the limit", async () => {
    vi.stubEnv("BRREG_REQUESTS_PER_ADDRESS", "2");
    const fetchMock = mockBrregNotFound();
    const address = newAddress();
    const lookup = () =>
      request(app)
        .get(`/api/companies/${ORG_NUMBER}`)
        .set("X-Forwarded-For", address);

    expect((await lookup()).status).toBe(404);
    expect((await lookup()).status).toBe(404);
    const blocked = await lookup();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe(
      "Too many company lookups. Try again later.",
    );
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.headers["retry-after"]).toBeDefined();
    // The blocked request never reached Brreg
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("count questions and new assessments as Brreg lookups too", async () => {
    vi.stubEnv("BRREG_REQUESTS_PER_ADDRESS", "2");
    mockBrregNotFound();
    const address = newAddress();

    await request(app)
      .get(`/api/companies/${ORG_NUMBER}/questions`)
      .set("X-Forwarded-For", address);
    await request(app)
      .post("/api/assessments")
      .set("X-Forwarded-For", address)
      .send({ orgNumber: ORG_NUMBER, answers: {} });
    const blocked = await request(app)
      .get(`/api/companies/${ORG_NUMBER}`)
      .set("X-Forwarded-For", address);

    expect(blocked.status).toBe(429);
  });

  it("count each address on its own", async () => {
    vi.stubEnv("BRREG_REQUESTS_PER_ADDRESS", "1");
    mockBrregNotFound();
    const first = newAddress();
    const second = newAddress();

    await request(app)
      .get(`/api/companies/${ORG_NUMBER}`)
      .set("X-Forwarded-For", first);
    const res = await request(app)
      .get(`/api/companies/${ORG_NUMBER}`)
      .set("X-Forwarded-For", second);

    expect(res.status).toBe(404);
  });

  it("do not count reading a saved assessment as a Brreg lookup", async () => {
    vi.stubEnv("BRREG_REQUESTS_PER_ADDRESS", "1");
    const address = newAddress();
    const read = () =>
      request(app)
        .get("/api/assessments/6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31")
        .set("X-Forwarded-For", address);

    expect((await read()).status).toBe(404);
    expect((await read()).status).toBe(404);
  });

  it("stop all requests from one address after the general limit", async () => {
    vi.stubEnv("REQUESTS_PER_ADDRESS", "3");
    const address = newAddress();
    const call = () => request(app).get("/api").set("X-Forwarded-For", address);

    await call();
    await call();
    await call();
    const blocked = await call();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("Too many requests. Try again later.");
  });
});
