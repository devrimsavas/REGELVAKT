import type { Locale } from "@/i18n/config";
import type { LocalizedText } from "./types";

// The API sends every text in both languages; the page shows one
export function pick(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
