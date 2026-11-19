import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import type { Assessment } from "../src/models/Assessment.js";
import { escapeText, foldLine } from "../src/services/calendarService.js";
import { createAssessment } from "./helpers/assessments.js";

let assessment: Assessment;

// Each test fetches as its own client address, since the rate limit counts
// are kept between tests
let nextAddress = 1;
function fetchCalendar(id: string, query = "", address = newAddress()) {
  return request(app)
    .get(`/api/assessments/${id}/calendar.ics${query}`)
    .set("X-Forwarded-For", address);
}
function newAddress(): string {
  return `192.0.2.${nextAddress++}`;
}

// The calendar's lines, with folded lines put back together
function unfold(body: string): string[] {
  return body.replace(/\r\n /g, "").split("\r\n");
}

beforeEach(async () => {
  assessment = await createAssessment();
  // The deadlines are counted from 26 November 2026
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/assessments/:id/calendar.ics", () => {
  it("is an iCalendar file", async () => {
    const res = await fetchCalendar(assessment.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="regelvakt-974760673.ics"',
    );
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(
      true,
    );
    expect(res.text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Every line ends with CRLF, never a bare LF
    expect(res.text.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("has a whole-day event for every upcoming deadline", async () => {
    const res = await fetchCalendar(assessment.id);
    const lines = unfold(res.text);

    // The VAT return is due Thursday 10 December 2026
    const start = lines.indexOf(
      `UID:vat-return-2026-12-10-${assessment.id}@regelvakt`,
    );
    expect(start).toBeGreaterThan(0);
    const event = lines.slice(start, lines.indexOf("END:VEVENT", start));
    expect(event).toContain("DTSTART;VALUE=DATE:20261210");
    expect(event).toContain("DTEND;VALUE=DATE:20261211");
    expect(event).toContain("SUMMARY:Frist: Mva-melding");
    expect(event).toContain("TRIGGER:-P3D");
    expect(event).toContain(
      "URL:https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/mva-melding/",
    );

    // Six VAT returns, four advance tax payments and one tax return within
    // the next 12 months
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(11);
  });

  it("explains each deadline and links to the source and the assessment", async () => {
    const res = await fetchCalendar(assessment.id);
    const description = unfold(res.text).find((line) =>
      line.startsWith("DESCRIPTION:Foretaket er registrert"),
    );

    expect(description).toContain(
      "\\n\\nLes mer: https://www.skatteetaten.no/",
    );
    expect(description).toContain(
      `Alle frister: http://web.test/assessments/${assessment.id}`,
    );
    // Commas in the text are escaped
    expect(description).toContain("\\,");
  });

  it("keeps the same event ids, so calendar apps update instead of adding copies", async () => {
    const uids = (body: string) =>
      unfold(body).filter((line) => line.startsWith("UID:"));

    const first = await fetchCalendar(assessment.id);
    vi.setSystemTime(new Date("2026-11-27T08:00:00Z"));
    const second = await fetchCalendar(assessment.id);

    expect(uids(second.text)).toEqual(uids(first.text));
  });

  it("follows changed answers", async () => {
    await assessment.update({
      answers: { ...assessment.answers, paysSalary: true },
    });

    const res = await fetchCalendar(assessment.id);

    expect(res.text).toContain("SUMMARY:Frist: A-melding");
  });

  it("is written in English when asked", async () => {
    const res = await fetchCalendar(assessment.id, "?lang=en");

    expect(res.text).toContain("SUMMARY:Deadline: VAT return");
    expect(unfold(res.text)).toContain("X-WR-CALNAME:Regelvakt – AYSE FRISØR");
  });

  it("refuses an unknown language and an unknown assessment", async () => {
    const language = await fetchCalendar(assessment.id, "?lang=de");
    const unknown = await fetchCalendar("6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31");

    expect(language.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it("has its own rate limit, not the general one", async () => {
    vi.stubEnv("REQUESTS_PER_ADDRESS", "1");
    vi.stubEnv("CALENDAR_REQUESTS_PER_ADDRESS", "2");
    const address = newAddress();

    expect((await fetchCalendar(assessment.id, "", address)).status).toBe(200);
    expect((await fetchCalendar(assessment.id, "", address)).status).toBe(200);
    expect((await fetchCalendar(assessment.id, "", address)).status).toBe(429);
  });
});

describe("iCalendar text", () => {
  it("escapes backslashes, semicolons, commas and line breaks", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b;c\\,d\\ne");
  });

  it("folds long lines at 75 bytes without splitting a letter", () => {
    const line = `DESCRIPTION:${"Frisør på Bragernes, ".repeat(10)}`;

    const folded = foldLine(line);
    const parts = folded.split("\r\n");

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    // Unfolding gives the line back
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    // No broken characters
    expect(folded).not.toContain("�");
  });

  it("leaves short lines alone", () => {
    expect(foldLine("VERSION:2.0")).toBe("VERSION:2.0");
  });
});
