import type messages from "../../messages/nb.json";
import type { Locale } from "./config";

// Makes translation keys type-checked: a missing or misspelled key is a
// compile error. nb.json is the source; en.json must have the same keys
// (checked by tests/messages.test.ts).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
