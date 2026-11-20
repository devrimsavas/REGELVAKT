// The languages of the app. "nb" is Norwegian Bokmål.
export const locales = ["nb", "en"] as const;
export type Locale = (typeof locales)[number];

// A Norwegian service: Norwegian unless the browser asks for English
export const defaultLocale: Locale = "nb";

// Remembers the chosen language for a year
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

// Picks a language from the browser's Accept-Language header, e.g.
// "en-GB,en;q=0.9,nb;q=0.8". Bokmål, Nynorsk and plain "no" all get the
// Norwegian text, English gets English, and the first of the two in the
// browser's order wins. Anything else gets Norwegian.
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const preferred = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return {
        language: tag.toLowerCase().split("-")[0] ?? "",
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((entry) => entry.language && entry.quality > 0)
    // Highest quality first; the browser's own order breaks ties
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { language } of preferred) {
    if (language === "nb" || language === "nn" || language === "no") {
      return "nb";
    }
    if (language === "en") return "en";
  }
  return defaultLocale;
}
