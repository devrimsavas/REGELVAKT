import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAssessment } from "./data";

type Tab =
  | "overview"
  | "obligations"
  | "calendar"
  | "reminders"
  | "assistant"
  | "answers"
  | "delete";

// The title of a page for one assessment: "Plikter – AYSE FRISØR". Pages
// about one business are reached by their link only, so search engines
// are asked to leave them out.
export async function assessmentMetadata(
  id: string,
  tab: Tab,
): Promise<Metadata> {
  const assessment = await getAssessment(id);
  const t = await getTranslations("assessment");
  const tabs = await getTranslations("tabs");
  return {
    title: assessment.ok
      ? t("pageTitle", { tab: tabs(tab), name: assessment.data.company.name })
      : t("notFoundTitle"),
    robots: { index: false, follow: false },
  };
}
