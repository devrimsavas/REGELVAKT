import { Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { SubNav } from "@/components/assessment/SubNav";
import { CompanySummary } from "@/components/CompanySummary";
import { apiErrorOf } from "@/lib/apiErrors";
import { getAssessment } from "@/lib/data";
import pages from "../../pages.module.css";

// The company and the tabs, shared by every page for one assessment.
// The assessment is fetched once per request; the pages get it from the
// same cache.
export default async function AssessmentLayout({
  children,
  params,
}: LayoutProps<"/assessments/[id]">) {
  const { id } = await params;
  const t = await getTranslations("assessment");
  const tabs = await getTranslations("tabs");
  const assessment = await getAssessment(id);

  const newSearch = (
    <Link asChild>
      <NextLink href="/">{t("newSearch")}</NextLink>
    </Link>
  );

  if (!assessment.ok) {
    // An id that is not one, or an assessment that has been deleted
    const missing = assessment.status === 400 || assessment.status === 404;
    return (
      <div className={`container ${pages.page}`}>
        <Heading level={1} data-size="lg">
          {t("notFoundTitle")}
        </Heading>
        {missing ? (
          <Paragraph>{t("notFoundText")}</Paragraph>
        ) : (
          <ApiErrorAlert error={apiErrorOf(assessment, "assessment")} />
        )}
        {newSearch}
      </div>
    );
  }

  const base = `/assessments/${id}`;
  const supported = assessment.data.result.supported;
  const items = [
    { href: base, text: tabs("overview") },
    ...(supported
      ? [
          { href: `${base}/obligations`, text: tabs("obligations") },
          { href: `${base}/calendar`, text: tabs("calendar") },
          { href: `${base}/reminders`, text: tabs("reminders") },
          {
            href: `${base}/assistant`,
            text: tabs("assistant"),
            icon: "robot" as const,
          },
          { href: `${base}/answers`, text: tabs("answers") },
        ]
      : []),
  ];

  return (
    <div className={`container ${pages.page}`}>
      {newSearch}
      <CompanySummary company={assessment.data.company} />
      <SubNav label={tabs("label")} items={items} />
      <div className={pages.tabContent}>{children}</div>
    </div>
  );
}
