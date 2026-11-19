import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashToken,
  manageToken,
  randomToken,
  subscriptionIdFromToken,
  subscriptionSecret,
} from "../src/utils/tokens.js";

const ID = "6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("subscriptionSecret", () => {
  it("refuses a missing or short secret", () => {
    vi.stubEnv("SUBSCRIPTION_SECRET", "");
    expect(() => subscriptionSecret()).toThrow("SUBSCRIPTION_SECRET");
    vi.stubEnv("SUBSCRIPTION_SECRET", "short");
    expect(() => subscriptionSecret()).toThrow("at least 32 characters");
  });
});

describe("manage tokens", () => {
  it("give back the subscription id they were made for", () => {
    expect(subscriptionIdFromToken(manageToken(ID))).toBe(ID);
  });

  it("are refused when anything in them is changed", () => {
    const token = manageToken(ID);
    const otherId = "7f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31";

    expect(subscriptionIdFromToken(token.replace(ID, otherId))).toBeNull();
    expect(subscriptionIdFromToken(`${token}.extra`)).toBeNull();
    expect(subscriptionIdFromToken(ID)).toBeNull();
    expect(subscriptionIdFromToken(42)).toBeNull();
  });
});

describe("random tokens", () => {
  it("are long, URL-safe and different every time", () => {
    const token = randomToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
