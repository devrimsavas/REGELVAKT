// Limits on how often the same client may call the API. Counts are kept in
// memory, so they are per API process and start again when it restarts.
//
// The client's IP address is req.ip. Behind the web app (and in Docker or
// a hosting platform) the request arrives from a proxy, so Express must be
// told which proxies to trust to read the real address from
// X-Forwarded-For: see TRUST_PROXY in app.ts.
//
// Each limit is read from the environment on every request, so it can be
// changed without code and the tests can set their own.
import type { Request, Response } from "express";
import {
  type Options,
  type RateLimitInfo,
  rateLimit,
} from "express-rate-limit";
import { normalizeEmail } from "../services/subscriptionService.js";

const MINUTE = 60 * 1000;

function envLimit(name: string, fallback: number): () => number {
  return () => {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
}

// The 429 answer says when the client may try again
function tooMany(message: string): Options["handler"] {
  return (req: Request & { rateLimit?: RateLimitInfo }, res: Response) => {
    const resetTime = req.rateLimit?.resetTime?.getTime() ?? Date.now();
    res.status(429).json({
      error: message,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((resetTime - Date.now()) / 1000),
      ),
    });
  };
}

const common = {
  windowMs: 15 * MINUTE,
  // RateLimit and RateLimit-Policy headers (IETF draft 8) and Retry-After
  standardHeaders: "draft-8",
  legacyHeaders: false,
} as const;

// Every request from one address. High enough for the web app, whose pages
// call the API several times each.
export const apiLimit = rateLimit({
  ...common,
  limit: envLimit("REQUESTS_PER_ADDRESS", 1000),
  identifier: "api",
  handler: tooMany("Too many requests. Try again later."),
});

// Requests that look a company up in Brreg. Lower than apiLimit, so this
// API cannot be used to flood Brreg, which could then block us for
// everyone. One assessment needs about three of these.
export const brregLimit = rateLimit({
  ...common,
  limit: envLimit("BRREG_REQUESTS_PER_ADDRESS", 100),
  identifier: "brreg",
  handler: tooMany("Too many company lookups. Try again later."),
});

// New subscriptions from one address, for any email addresses
export const subscribePerAddressLimit = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: envLimit("SUBSCRIPTIONS_PER_ADDRESS", 20),
  identifier: "subscribe-address",
  handler: tooMany("Too many reminder requests. Try again later."),
});

// New subscriptions for one email address, from any client address: stops
// filling someone's inbox with confirmation emails
export const subscribePerEmailLimit = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: envLimit("SUBSCRIPTIONS_PER_EMAIL", 5),
  keyGenerator: (req) => {
    const email: unknown = req.body?.email;
    return `email:${typeof email === "string" ? normalizeEmail(email) : ""}`;
  },
  identifier: "subscribe-email",
  handler: tooMany(
    "Too many reminder requests for this address. Try again later.",
  ),
});
