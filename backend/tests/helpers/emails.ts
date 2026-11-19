import { afterEach, beforeEach } from "vitest";
import {
  type Email,
  setEmailSender,
} from "../../src/services/email/emailSender.js";

// Collects the emails the app sends in each test of the file, instead of
// sending them
export function useEmails() {
  const sent: Email[] = [];

  beforeEach(() => {
    sent.length = 0;
    setEmailSender({
      async send(email) {
        sent.push(email);
      },
    });
  });

  afterEach(() => {
    setEmailSender(null);
  });

  return sent;
}

// The token in the first link of an email that has `path` in it
export function tokenFrom(email: Email | undefined, path: string): string {
  const match = email?.text.match(
    new RegExp(`${path.replaceAll("/", "\\/")}\\?token=([^\\s]+)`),
  );
  if (!match?.[1]) {
    throw new Error(`No ${path} link in the email`);
  }
  return decodeURIComponent(match[1]);
}
