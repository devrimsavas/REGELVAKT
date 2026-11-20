import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The incoming request's headers, as next/headers would give them
let incoming = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => incoming,
}));

const { apiFetch } = await import("@/lib/api");

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("calling the API", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    incoming = new Headers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("CLIENT_IP_HEADER", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends JSON and returns the answer", async () => {
    fetchMock.mockResolvedValue(answer(201, { id: "a1" }));

    const result = await apiFetch<{ id: string }>("/api/assessments", {
      method: "POST",
      body: { orgNumber: "974760673" },
    });

    expect(result).toEqual({ ok: true, status: 201, data: { id: "a1" } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/api/assessments");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"orgNumber":"974760673"}');
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("passes the visitor's address on, the first one only", async () => {
    incoming = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" });
    fetchMock.mockResolvedValue(answer(200, {}));

    await apiFetch("/api");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Forwarded-For"]).toBe("203.0.113.7");
  });

  it("reads the address from the header CLIENT_IP_HEADER names", async () => {
    vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
    incoming = new Headers({
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "203.0.113.7",
    });
    fetchMock.mockResolvedValue(answer(200, {}));

    await apiFetch("/api");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Forwarded-For"]).toBe("198.51.100.4");
  });

  it("sends no address that is not one", async () => {
    incoming = new Headers({ "x-forwarded-for": "not-an-address" });
    fetchMock.mockResolvedValue(answer(200, {}));

    await apiFetch("/api");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Forwarded-For"]).toBeUndefined();
  });

  it("returns the API's error with its details and wait time", async () => {
    fetchMock.mockResolvedValueOnce(
      answer(400, { error: "Invalid answers", details: ["vatTerm: required"] }),
    );
    fetchMock.mockResolvedValueOnce(
      answer(429, { error: "Too many requests", retryAfterSeconds: 60 }),
    );

    expect(await apiFetch("/api/assessments")).toEqual({
      ok: false,
      status: 400,
      error: "Invalid answers",
      details: ["vatTerm: required"],
    });
    expect(await apiFetch("/api/assessments")).toEqual({
      ok: false,
      status: 429,
      error: "Too many requests",
      retryAfterSeconds: 60,
    });
  });

  it("returns no data for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await apiFetch("/api/x", { method: "DELETE" })).toEqual({
      ok: true,
      status: 204,
      data: null,
    });
  });

  it("returns status 0 when the API cannot be reached, without the query string in the log", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await apiFetch("/api/subscriptions/lookup?token=secret");

    expect(result).toMatchObject({ ok: false, status: 0 });
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("GET /api/subscriptions/lookup");
    expect(logged).not.toContain("secret");
  });
});
