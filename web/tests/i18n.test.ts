import { describe, expect, it } from "vitest";
import { isLocale, localeFromAcceptLanguage } from "@/i18n/config";

describe("the language from the browser", () => {
  it("is Norwegian for Bokmål, Nynorsk and plain Norwegian", () => {
    expect(localeFromAcceptLanguage("nb-NO,nb;q=0.9")).toBe("nb");
    expect(localeFromAcceptLanguage("nn")).toBe("nb");
    expect(localeFromAcceptLanguage("no")).toBe("nb");
  });

  it("is English for English", () => {
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
  });

  it("follows the browser's preference between the two", () => {
    expect(localeFromAcceptLanguage("en;q=0.8,nb;q=0.9")).toBe("nb");
    expect(localeFromAcceptLanguage("tr-TR,tr;q=0.9,en;q=0.8,nb;q=0.7")).toBe(
      "en",
    );
    // Same quality: the browser's own order
    expect(localeFromAcceptLanguage("en,nb")).toBe("en");
  });

  it("is Norwegian when the browser asks for neither, or for nothing", () => {
    expect(localeFromAcceptLanguage("tr-TR,tr")).toBe("nb");
    expect(localeFromAcceptLanguage(null)).toBe("nb");
    expect(localeFromAcceptLanguage("")).toBe("nb");
    expect(localeFromAcceptLanguage("en;q=0")).toBe("nb");
  });

  it("takes only the app's languages as a choice", () => {
    expect(isLocale("nb")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("tr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
