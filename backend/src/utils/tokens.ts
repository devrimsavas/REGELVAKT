import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { requireEnv } from "../config/env.js";
import { isUuid } from "./uuid.js";

// Tokens for the links in emails. Two kinds:
//
// - A confirmation token is random. Only its hash is stored, so someone
//   who reads the database cannot confirm a subscription with it.
// - A manage token lets the receiver change or stop their reminders. It is
//   the subscription id with a signature made with SUBSCRIPTION_SECRET, so
//   every email can carry a working link without the token being stored,
//   and no one can make one for another subscription. It stops working
//   when the subscription is deleted. Changing the secret breaks all the
//   manage links in emails already sent.

export const MIN_SECRET_LENGTH = 32;

// Throws if SUBSCRIPTION_SECRET is missing or too short to be safe.
// server.ts calls it at startup, so a bad setting is found at once.
export function subscriptionSecret(): string {
  const secret = requireEnv("SUBSCRIPTION_SECRET");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SUBSCRIPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }
  return secret;
}

// 32 random bytes: far too many possibilities to guess
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(subscriptionId: string): string {
  return createHmac("sha256", subscriptionSecret())
    .update(`manage:${subscriptionId}`)
    .digest("base64url");
}

export function manageToken(subscriptionId: string): string {
  return `${subscriptionId}.${sign(subscriptionId)}`;
}

// The subscription id a manage token was made for, or null if the token
// is not one of ours
export function subscriptionIdFromToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const [id, signature, ...rest] = token.split(".");
  if (!id || !signature || rest.length > 0 || !isUuid(id)) return null;

  const expected = Buffer.from(sign(id));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? id
    : null;
}
