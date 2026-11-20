import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nb from "../messages/nb.json";

// Every key, as "section.key"
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("the translations", () => {
  it("have the same keys in Norwegian and English", () => {
    expect(keys(en).sort()).toEqual(keys(nb).sort());
  });

  it("have no empty text", () => {
    for (const messages of [nb, en]) {
      const empty = keys(messages).filter((key) => {
        const value = key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            messages,
          );
        return typeof value !== "string" || value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
