import { afterEach, describe, expect, it, vi } from "vitest";

// The routes' calls to the API
const apiRequest = vi.fn();
const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiRequest, apiFetch }));

const calendar = await import("@/app/calendar/[file]/route");
const oneClick = await import("@/app/reminders/unsubscribe/one-click/route");

const ID = "468e1f56-9d2a-46d9-bbad-6f9cea884e91";
const context = (file: string) => ({ params: Promise.resolve({ file }) });

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /calendar/:id.ics", () => {
  it("passes the calendar on from the API, in the language asked for", async () => {
    apiRequest.mockResolvedValue(
      new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
        headers: {
          "Content-Disposition": 'inline; filename="regelvakt-974760673.ics"',
        },
      }),
    );

    const response = await calendar.GET(
      new Request(`http://web.test/calendar/${ID}.ics?lang=en`),
      context(`${ID}.ics`),
    );

    expect(apiRequest).toHaveBeenCalledWith(
      `/api/assessments/${ID}/calendar.ics?lang=en`,
      {},
      "text/calendar",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toContain(
      "regelvakt-974760673.ics",
    );
    expect(await response.text()).toContain("BEGIN:VCALENDAR");
  });

  it("is saved as a file when it is downloaded", async () => {
    apiRequest.mockResolvedValue(
      new Response("x", {
        headers: {
          "Content-Disposition": 'inline; filename="regelvakt-974760673.ics"',
        },
      }),
    );
    const response = await calendar.GET(
      new Request(`http://web.test/calendar/${ID}.ics?lang=nb&download=1`),
      context(`${ID}.ics`),
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="regelvakt-974760673.ics"',
    );
  });

  it("asks for Norwegian unless English is asked for", async () => {
    apiRequest.mockResolvedValue(new Response("x"));
    await calendar.GET(
      new Request(`http://web.test/calendar/${ID}.ics?lang=tr`),
      context(`${ID}.ics`),
    );
    expect(apiRequest.mock.calls[0]?.[0]).toContain("lang=nb");
  });

  it("answers 404 for an address that is not a calendar, without asking the API", async () => {
    const response = await calendar.GET(
      new Request("http://web.test/calendar/x.ics"),
      context("../../api.ics"),
    );
    expect(response.status).toBe(404);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("answers 404 for a deleted page, 503 when the API is down", async () => {
    apiRequest.mockResolvedValueOnce(new Response(null, { status: 404 }));
    apiRequest.mockResolvedValueOnce(null);
    const url = new Request(`http://web.test/calendar/${ID}.ics`);

    expect((await calendar.GET(url, context(`${ID}.ics`))).status).toBe(404);
    expect((await calendar.GET(url, context(`${ID}.ics`))).status).toBe(503);
  });
});

describe("the one-click unsubscribe address", () => {
  it("stops the reminders on the mail program's POST", async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: {} });

    const response = await oneClick.POST(
      new Request("http://web.test/reminders/unsubscribe/one-click?token=abc", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
      }),
    );

    expect(apiFetch).toHaveBeenCalledWith("/api/subscriptions/unsubscribe", {
      method: "POST",
      body: { token: "abc" },
    });
    expect(response.status).toBe(200);
  });

  it("answers 200 for a token already used, 503 when the API is down", async () => {
    const request = () =>
      new Request("http://web.test/reminders/unsubscribe/one-click?token=x", {
        method: "POST",
      });
    apiFetch.mockResolvedValueOnce({ ok: false, status: 404, error: "x" });
    apiFetch.mockResolvedValueOnce({ ok: false, status: 0, error: "x" });

    expect((await oneClick.POST(request())).status).toBe(200);
    expect((await oneClick.POST(request())).status).toBe(503);
  });

  it("does not unsubscribe when the address is opened in a browser", async () => {
    await expect(
      oneClick.GET(
        new Request("http://web.test/reminders/unsubscribe/one-click?token=abc"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
