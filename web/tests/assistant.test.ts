import { afterEach, describe, expect, it, vi } from "vitest";
import { linkCitations, sourceAnchor } from "@/lib/assistant";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "nb" }));
const { askQuestion } = await import("@/lib/assistantActions");

afterEach(() => {
  vi.clearAllMocks();
});

describe("source numbers in an answer", () => {
  it("become links to the sources under it", () => {
    expect(linkCitations("Fristen er 10. april [1][3].", "a1")).toBe(
      "Fristen er 10. april [\\[1\\]](#a1-source-1)[\\[3\\]](#a1-source-3).",
    );
    expect(sourceAnchor("a1", 2)).toBe("a1-source-2");
  });

  it("leave the rest of the text alone", () => {
    expect(linkCitations("Ingen kilder her.", "a1")).toBe("Ingen kilder her.");
  });
});

describe("asking the assistant", () => {
  it("sends the question in the page's language, with the company", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      data: { mode: "answer", answer: "Svar [1]", sources: [], disclaimer: "" },
    });

    const result = await askQuestion("  Når er fristen?  ", "id-1");

    expect(apiFetch).toHaveBeenCalledWith("/api/assistant/ask", {
      method: "POST",
      body: { question: "Når er fristen?", language: "nb", assessmentId: "id-1" },
    });
    expect(result.ok).toBe(true);
  });

  it("checks the length before asking", async () => {
    expect(await askQuestion(" a ", null)).toEqual({
      ok: false,
      error: { key: "tooShort" },
    });
    expect(await askQuestion("x".repeat(501), null)).toEqual({
      ok: false,
      error: { key: "tooLong" },
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("tells the daily limit from the limit per address", async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, status: 429, error: "x" });
    apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      error: "x",
      retryAfterSeconds: 120,
    });

    expect(await askQuestion("Hva nå?", null)).toEqual({
      ok: false,
      error: { key: "dailyLimit" },
    });
    expect(await askQuestion("Hva nå?", null)).toEqual({
      ok: false,
      error: { key: "tooManyRequests", minutes: 2 },
    });
  });

  it("says when the knowledge base is not ready", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 503, error: "x" });
    expect(await askQuestion("Hva nå?", null)).toEqual({
      ok: false,
      error: { key: "notReady" },
    });
  });
});
