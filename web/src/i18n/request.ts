import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  isLocale,
  LOCALE_COOKIE,
  type Locale,
  localeFromAcceptLanguage,
} from "./config";

// The language is kept in a cookie, not in the address: the links in the
// reminder emails (/assessments/…, /reminders/…) carry no language. A
// chosen language wins, otherwise the browser's language decides.
export async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Oslo",
  };
});
