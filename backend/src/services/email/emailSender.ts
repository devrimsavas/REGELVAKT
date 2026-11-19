// Sending email. The provider is chosen with EMAIL_PROVIDER:
//   log     writes each email to the terminal (the default), for development
//   resend  sends it with Resend (https://resend.com), needs RESEND_API_KEY
// The rest of the app only knows the EmailSender interface, so another
// provider can be added here without touching it.

export interface Email {
  to: string;
  subject: string;
  // Both a plain-text and an HTML version, for every mail program
  text: string;
  html: string;
  // Extra headers, such as List-Unsubscribe
  headers?: Record<string, string>;
}

export interface EmailSender {
  send(email: Email): Promise<void>;
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

const RESEND_URL = "https://api.resend.com/emails";

// Resend's own sender address works without setting up a domain, but only
// to the address the Resend account was made with
const DEFAULT_FROM = "Regelvakt <onboarding@resend.dev>";

const resendSender: EmailSender = {
  async send(email) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new EmailError("RESEND_API_KEY is not set");
    }

    let response: Response;
    try {
      response = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || DEFAULT_FROM,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          ...(email.headers ? { headers: email.headers } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EmailError(`Could not reach Resend: ${message}`);
    }

    if (!response.ok) {
      // Resend explains the problem in "message"; the address is not logged
      const body = (await response.json().catch(() => null)) as {
        message?: unknown;
      } | null;
      const reason =
        typeof body?.message === "string" ? body.message : response.statusText;
      throw new EmailError(
        `Resend refused the email (${response.status}): ${reason}`,
      );
    }
  },
};

// Development only: the email is written to the terminal, links included,
// so the confirmation link can be opened without a mail account
const logSender: EmailSender = {
  async send(email) {
    process.stdout.write(
      [
        "---- Email (EMAIL_PROVIDER=log, not sent) ----",
        `To: ${email.to}`,
        `Subject: ${email.subject}`,
        "",
        email.text,
        "----",
        "",
      ].join("\n"),
    );
  },
};

let override: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (override) return override;
  const provider = process.env.EMAIL_PROVIDER || "log";
  if (provider === "resend") return resendSender;
  if (provider === "log") return logSender;
  throw new EmailError(`Unknown EMAIL_PROVIDER "${provider}"`);
}

// For tests: send the emails here instead. null puts back the provider.
export function setEmailSender(sender: EmailSender | null): void {
  override = sender;
}
