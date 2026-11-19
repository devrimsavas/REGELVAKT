// The emails Regelvakt sends, in Norwegian (bokmål) and English. Each has a
// plain-text and an HTML version with the same content.
import type { EmailLanguage } from "../../models/Subscription.js";
import type { Email } from "./emailSender.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const DISCLAIMER: Record<EmailLanguage, string> = {
  nb: "Regelvakt er en veiviser, ikke skatte- eller regnskapsrådgivning. Sjekk alltid kilden.",
  en: "Regelvakt is a guide, not tax or accounting advice. Always check the source.",
};

interface Link {
  text: string;
  url: string;
}

// A boxed entry in a list, such as one deadline in a reminder
interface Item {
  title: string;
  lines: string[];
  links: Link[];
}

interface Layout {
  paragraphs: string[];
  items?: Item[];
  button: Link;
  // Plain lines and links, in small print at the bottom
  footer: string[];
  footerLinks?: Link[];
}

// A plain, single-column layout that mail programs show the same way
function html(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join("");
  const items = (layout.items ?? [])
    .map((item) => {
      const lines = item.lines
        .map(
          (line) =>
            `<p style="margin:0 0 4px;color:#5d6066">${escapeHtml(line)}</p>`,
        )
        .join("");
      const links = item.links
        .map(
          (link) =>
            `<a href="${escapeHtml(link.url)}" style="color:#0062ba">${escapeHtml(link.text)}</a>`,
        )
        .join(" · ");
      return `<div style="margin:0 0 12px;padding:12px 16px;border-left:4px solid #0062ba;background:#f4f5f6;border-radius:4px">
<p style="margin:0 0 4px;font-weight:bold">${escapeHtml(item.title)}</p>
${lines}<p style="margin:4px 0 0;font-size:13px">${links}</p>
</div>`;
    })
    .join("");
  const footerLinks = (layout.footerLinks ?? []).map(
    (link) =>
      `<a href="${escapeHtml(link.url)}" style="color:#5d6066">${escapeHtml(link.text)}</a>`,
  );
  const footer = [
    ...layout.footer.map((line) => escapeHtml(line)),
    ...(footerLinks.length > 0 ? [footerLinks.join(" · ")] : []),
  ].join("<br>");
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f5f6;font-family:Arial,Helvetica,sans-serif;color:#24272b;font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px">
<p style="margin:0 0 24px;font-size:18px;font-weight:bold">Regelvakt</p>
${paragraphs}
${items}
<p style="margin:24px 0"><a href="${escapeHtml(layout.button.url)}" style="display:inline-block;padding:12px 20px;background:#0062ba;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold">${escapeHtml(layout.button.text)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#5d6066">${footer}</p>
</div></body></html>`;
}

function text(layout: Layout): string {
  return [
    ...layout.paragraphs.flatMap((p) => [p, ""]),
    ...(layout.items ?? []).flatMap((item) => [
      item.title,
      ...item.lines.map((line) => `  ${line}`),
      ...item.links.map((link) => `  ${link.text}: ${link.url}`),
      "",
    ]),
    `${layout.button.text}: ${layout.button.url}`,
    "",
    ...layout.footer,
    ...(layout.footerLinks ?? []).map((link) => `${link.text}: ${link.url}`),
  ].join("\n");
}

function email(
  to: string,
  subject: string,
  layout: Layout,
  headers?: Record<string, string>,
): Email {
  return {
    to,
    subject,
    text: text(layout),
    html: html(layout),
    ...(headers ? { headers } : {}),
  };
}

// Lets mail programs show their own "unsubscribe" button, which stops the
// reminders with one click (RFC 8058)
export function unsubscribeHeaders(
  oneClickUrl: string,
): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

interface CompanyLine {
  companyName: string;
  orgNumber: string;
}

// ---- Confirmation ----

const CONFIRM = {
  nb: {
    subject: (c: CompanyLine) => `Bekreft påminnelser for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `Du har bedt om e-postpåminnelser fra Regelvakt om frister for ${c.companyName} (${c.orgNumber}).`,
    action: (hours: number) =>
      `Bekreft adressen din med knappen under. Lenken virker i ${hours} timer.`,
    button: "Bekreft påminnelser",
    ignore:
      "Har du ikke bedt om dette, kan du se bort fra e-posten. Da får du ingen flere e-poster fra oss.",
  },
  en: {
    subject: (c: CompanyLine) => `Confirm reminders for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `You asked Regelvakt for email reminders about deadlines for ${c.companyName} (${c.orgNumber}).`,
    action: (hours: number) =>
      `Confirm your address with the button below. The link works for ${hours} hours.`,
    button: "Confirm reminders",
    ignore:
      "If you did not ask for this, you can ignore this email. You will not get any more emails from us.",
  },
} as const;

export function confirmationEmail(input: {
  to: string;
  language: EmailLanguage;
  company: CompanyLine;
  confirmUrl: string;
  validHours: number;
}): Email {
  const t = CONFIRM[input.language];
  return email(input.to, t.subject(input.company), {
    paragraphs: [t.intro(input.company), t.action(input.validHours)],
    button: { text: t.button, url: input.confirmUrl },
    footer: [t.ignore, DISCLAIMER[input.language]],
  });
}

// ---- Already subscribed ----

const ALREADY = {
  nb: {
    subject: (c: CompanyLine) =>
      `Du får allerede påminnelser for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `Noen ba om påminnelser for ${c.companyName} (${c.orgNumber}) til denne adressen, men den får dem allerede. Ingenting er endret.`,
    action: "Her kan du endre eller stoppe påminnelsene:",
    button: "Endre påminnelser",
  },
  en: {
    subject: (c: CompanyLine) =>
      `You already get reminders for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `Someone asked for reminders for ${c.companyName} (${c.orgNumber}) to this address, but it already gets them. Nothing has changed.`,
    action: "Here you can change or stop the reminders:",
    button: "Change reminders",
  },
} as const;

export function alreadySubscribedEmail(input: {
  to: string;
  language: EmailLanguage;
  company: CompanyLine;
  manageUrl: string;
  oneClickUnsubscribeUrl: string;
}): Email {
  const t = ALREADY[input.language];
  return email(
    input.to,
    t.subject(input.company),
    {
      paragraphs: [t.intro(input.company), t.action],
      button: { text: t.button, url: input.manageUrl },
      footer: [DISCLAIMER[input.language]],
    },
    unsubscribeHeaders(input.oneClickUnsubscribeUrl),
  );
}

// ---- Reminders ----

// A deadline in a reminder email
export interface ReminderLine {
  title: string;
  deadline: string; // YYYY-MM-DD
  daysLeft: number;
  sourceUrl: string;
  altinnUrl: string | null;
}

const LOCALES: Record<EmailLanguage, string> = { nb: "nb-NO", en: "en-GB" };

// e.g. "torsdag 10. desember 2026" or "Thursday 10 December 2026". Built
// from its parts, so the punctuation does not depend on the Node version.
export function formatDate(isoDate: string, language: EmailLanguage): string {
  const parts = new Intl.DateTimeFormat(LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${isoDate}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = language === "nb" ? `${part("day")}.` : part("day");
  return `${part("weekday")} ${day} ${part("month")} ${part("year")}`;
}

const REMINDER = {
  nb: {
    when: (days: number) =>
      days === 0 ? "i dag" : days === 1 ? "i morgen" : `om ${days} dager`,
    subjectOne: (line: ReminderLine, c: CompanyLine) =>
      `Frist ${REMINDER.nb.when(line.daysLeft)}: ${line.title} (${c.companyName})`,
    subjectMany: (count: number, c: CompanyLine) =>
      `${count} frister nærmer seg for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `Dette er fristene som nærmer seg for ${c.companyName} (${c.orgNumber}):`,
    due: (line: ReminderLine, language: EmailLanguage) =>
      `Frist: ${formatDate(line.deadline, language)} (${REMINDER.nb.when(line.daysLeft)})`,
    source: "Les mer",
    altinn: "Åpne i Altinn",
    button: "Se alle frister",
    why: "Du får denne e-posten fordi du har bedt om påminnelser fra Regelvakt.",
    manage: "Endre eller stopp påminnelsene",
  },
  en: {
    when: (days: number) =>
      days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`,
    subjectOne: (line: ReminderLine, c: CompanyLine) =>
      `Deadline ${REMINDER.en.when(line.daysLeft)}: ${line.title} (${c.companyName})`,
    subjectMany: (count: number, c: CompanyLine) =>
      `${count} deadlines coming up for ${c.companyName}`,
    intro: (c: CompanyLine) =>
      `These deadlines are coming up for ${c.companyName} (${c.orgNumber}):`,
    due: (line: ReminderLine, language: EmailLanguage) =>
      `Deadline: ${formatDate(line.deadline, language)} (${REMINDER.en.when(line.daysLeft)})`,
    source: "Read more",
    altinn: "Open in Altinn",
    button: "See all deadlines",
    why: "You get this email because you asked Regelvakt for reminders.",
    manage: "Change or stop the reminders",
  },
} as const;

export function reminderEmail(input: {
  to: string;
  language: EmailLanguage;
  company: CompanyLine;
  lines: ReminderLine[];
  assessmentUrl: string;
  manageUrl: string;
  oneClickUnsubscribeUrl: string;
}): Email {
  const t = REMINDER[input.language];
  const [first] = input.lines;
  const subject =
    input.lines.length === 1 && first
      ? t.subjectOne(first, input.company)
      : t.subjectMany(input.lines.length, input.company);

  return email(
    input.to,
    subject,
    {
      paragraphs: [t.intro(input.company)],
      items: input.lines.map((line) => ({
        title: line.title,
        lines: [t.due(line, input.language)],
        links: [
          { text: t.source, url: line.sourceUrl },
          ...(line.altinnUrl ? [{ text: t.altinn, url: line.altinnUrl }] : []),
        ],
      })),
      button: { text: t.button, url: input.assessmentUrl },
      footer: [t.why, DISCLAIMER[input.language]],
      footerLinks: [{ text: t.manage, url: input.manageUrl }],
    },
    unsubscribeHeaders(input.oneClickUnsubscribeUrl),
  );
}

// ---- Reminders stopped ----

const STOPPED = {
  nb: {
    subject: (c: CompanyLine) => `Påminnelsene for ${c.companyName} er stoppet`,
    intro: (c: CompanyLine) =>
      `${c.companyName} (${c.orgNumber}) står ikke lenger som aktiv i Enhetsregisteret, så Regelvakt sender ingen flere påminnelser for den. E-postadressen din er slettet hos oss.`,
    action:
      "Har virksomheten fått et nytt organisasjonsnummer, kan du lage en ny vurdering:",
    button: "Lag en ny vurdering",
  },
  en: {
    subject: (c: CompanyLine) => `Reminders for ${c.companyName} have stopped`,
    intro: (c: CompanyLine) =>
      `${c.companyName} (${c.orgNumber}) is no longer listed as active in the Central Coordinating Register, so Regelvakt will send no more reminders for it. Your email address has been deleted.`,
    action:
      "If the business has a new organization number, you can make a new assessment:",
    button: "Make a new assessment",
  },
} as const;

export function remindersStoppedEmail(input: {
  to: string;
  language: EmailLanguage;
  company: CompanyLine;
  startUrl: string;
}): Email {
  const t = STOPPED[input.language];
  return email(input.to, t.subject(input.company), {
    paragraphs: [t.intro(input.company), t.action],
    button: { text: t.button, url: input.startUrl },
    footer: [DISCLAIMER[input.language]],
  });
}

// ---- Answers need updating ----

const OUTDATED = {
  nb: {
    subject: (c: CompanyLine) =>
      `Opplysningene om ${c.companyName} har endret seg`,
    intro: (c: CompanyLine) =>
      `Enhetsregisteret viser nye opplysninger om ${c.companyName} (${c.orgNumber}), for eksempel en ny registrering i Merverdiavgiftsregisteret. Noen frister avhenger av svarene dine, så du må svare på spørsmålene på nytt.`,
    action:
      "Til du har gjort det, kan noen frister mangle i påminnelsene. Det tar under ett minutt:",
    button: "Svar på spørsmålene",
    manage: "Endre eller stopp påminnelsene",
  },
  en: {
    subject: (c: CompanyLine) =>
      `The information about ${c.companyName} has changed`,
    intro: (c: CompanyLine) =>
      `The Central Coordinating Register shows new information about ${c.companyName} (${c.orgNumber}), such as a new VAT registration. Some deadlines depend on your answers, so you need to answer the questions again.`,
    action:
      "Until you do, some deadlines may be missing from the reminders. It takes less than a minute:",
    button: "Answer the questions",
    manage: "Change or stop the reminders",
  },
} as const;

export function answersOutdatedEmail(input: {
  to: string;
  language: EmailLanguage;
  company: CompanyLine;
  assessmentUrl: string;
  manageUrl: string;
  oneClickUnsubscribeUrl: string;
}): Email {
  const t = OUTDATED[input.language];
  return email(
    input.to,
    t.subject(input.company),
    {
      paragraphs: [t.intro(input.company), t.action],
      button: { text: t.button, url: input.assessmentUrl },
      footer: [DISCLAIMER[input.language]],
      footerLinks: [{ text: t.manage, url: input.manageUrl }],
    },
    unsubscribeHeaders(input.oneClickUnsubscribeUrl),
  );
}
