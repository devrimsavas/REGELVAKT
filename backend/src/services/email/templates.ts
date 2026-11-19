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

interface Layout {
  paragraphs: string[];
  button: { text: string; url: string };
  footer: string[];
}

// A plain, single-column layout that mail programs show the same way
function html(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join("");
  const footer = layout.footer.map((line) => escapeHtml(line)).join("<br>");
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f5f6;font-family:Arial,Helvetica,sans-serif;color:#24272b;font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px">
<p style="margin:0 0 24px;font-size:18px;font-weight:bold">Regelvakt</p>
${paragraphs}
<p style="margin:24px 0"><a href="${escapeHtml(layout.button.url)}" style="display:inline-block;padding:12px 20px;background:#0062ba;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold">${escapeHtml(layout.button.text)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#5d6066">${footer}</p>
</div></body></html>`;
}

function text(layout: Layout): string {
  return [
    ...layout.paragraphs.flatMap((p) => [p, ""]),
    `${layout.button.text}: ${layout.button.url}`,
    "",
    ...layout.footer,
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
