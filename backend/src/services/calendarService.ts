// An assessment's deadlines as an iCalendar file (RFC 5545), for
// subscribing in Google Calendar, Outlook or Apple Calendar. Calendar apps
// fetch the address again now and then, and the deadlines are calculated
// on every fetch, so the calendar follows changed answers, new company data
// and new rules by itself.
import type { Assessment } from "../models/Assessment.js";
import type { EmailLanguage } from "../models/Subscription.js";
import { addDays, fromIsoDate } from "../rules/calendar.js";
import { assess } from "../rules/engine.js";
import { RULES_VERSION } from "../rules/version.js";
import { todayInNorway } from "../utils/today.js";
import { webAppUrl } from "../utils/webAppUrl.js";

const TEXT = {
  nb: {
    calendarName: (company: string) => `Regelvakt – ${company}`,
    calendarDescription: (company: string) =>
      `Frister for ${company} fra Regelvakt`,
    summary: (title: string) => `Frist: ${title}`,
    readMore: "Les mer",
    allDeadlines: "Alle frister",
    disclaimer:
      "Regelvakt er en veiviser, ikke skatte- eller regnskapsrådgivning. Sjekk alltid kilden.",
    alarm: (title: string) => `Frist om 3 dager: ${title}`,
  },
  en: {
    calendarName: (company: string) => `Regelvakt – ${company}`,
    calendarDescription: (company: string) =>
      `Deadlines for ${company} from Regelvakt`,
    summary: (title: string) => `Deadline: ${title}`,
    readMore: "Read more",
    allDeadlines: "All deadlines",
    disclaimer:
      "Regelvakt is a guide, not tax or accounting advice. Always check the source.",
    alarm: (title: string) => `Deadline in 3 days: ${title}`,
  },
} as const;

// Text values: backslash, semicolon, comma and line breaks are escaped
// (RFC 5545 section 3.3.11)
export function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", ";")
    .replaceAll(",", "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const MAX_LINE_OCTETS = 75;

// Lines longer than 75 octets are folded: broken into lines that start with
// a space (RFC 5545 section 3.1). Counted in UTF-8 bytes, and never inside a
// character, so letters such as "ø" stay whole.
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  // The first line has 75 octets; the next ones lose one to the space
  let limit = MAX_LINE_OCTETS;

  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

// 2026-12-10 → 20261210
function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

// A moment in UTC, e.g. 20261119T194204Z
function timestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replaceAll("-", "").replaceAll(":", "")}Z`;
}

export function buildCalendar(
  assessment: Assessment,
  language: EmailLanguage,
  now = new Date(),
): string {
  const t = TEXT[language];
  const company = assessment.companySnapshot.name;
  const result = assess(
    assessment.companySnapshot,
    assessment.answers,
    todayInNorway(now),
  );
  const assessmentUrl = `${webAppUrl()}/assessments/${assessment.id}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Regelvakt//Regelvakt ${RULES_VERSION}//${language.toUpperCase()}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(t.calendarName(company))}`,
    `X-WR-CALDESC:${escapeText(t.calendarDescription(company))}`,
    // How often calendar apps should fetch it again (not all follow it)
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  const obligations = result.supported ? result.obligations : [];
  for (const obligation of obligations) {
    const title = obligation.title[language];
    const description = [
      obligation.reason[language],
      "",
      obligation.description[language],
      "",
      `${t.readMore}: ${obligation.sourceUrl}`,
      `${t.allDeadlines}: ${assessmentUrl}`,
      "",
      t.disclaimer,
    ].join("\n");

    for (const deadline of obligation.upcomingDeadlines) {
      const start = fromIsoDate(deadline);
      lines.push(
        "BEGIN:VEVENT",
        // The same deadline keeps the same UID, so calendar apps update an
        // event instead of adding a copy on every fetch
        `UID:${obligation.id}-${deadline}-${assessment.id}@regelvakt`,
        `DTSTAMP:${timestamp(now)}`,
        // A whole day: DTEND is the day after (RFC 5545 section 3.6.1)
        `DTSTART;VALUE=DATE:${dateValue(start)}`,
        `DTEND;VALUE=DATE:${dateValue(addDays(start, 1))}`,
        `SUMMARY:${escapeText(t.summary(title))}`,
        `DESCRIPTION:${escapeText(description)}`,
        `URL:${obligation.sourceUrl}`,
        // Shown as free time, so it does not block meetings
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(t.alarm(title))}`,
        "TRIGGER:-P3D",
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  // Lines end with CRLF, the last one too
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
