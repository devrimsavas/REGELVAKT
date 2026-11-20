import { describe, expect, it } from "vitest";
import { looksLikeBot } from "@/lib/botCheck";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("the bot check", () => {
  const now = 1_000_000;

  it("lets a person through", () => {
    expect(looksLikeBot(form({ website: "", startedAt: String(now - 8000) }), now)).toBe(false);
  });

  it("stops a form whose hidden field is filled in", () => {
    expect(
      looksLikeBot(form({ website: "https://spam.test", startedAt: String(now - 8000) }), now),
    ).toBe(true);
  });

  it("stops a form sent within two seconds", () => {
    expect(looksLikeBot(form({ website: "", startedAt: String(now - 500) }), now)).toBe(true);
  });

  it("does not hold it against a browser without JavaScript that the time is missing", () => {
    expect(looksLikeBot(form({ website: "", startedAt: "" }), now)).toBe(false);
    expect(looksLikeBot(form({}), now)).toBe(false);
  });
});
