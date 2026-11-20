import {
  Alert,
  Button,
  Heading,
  Link,
  Paragraph,
} from "@digdir/designsystemet-react";
import { ArrowRightIcon } from "@navikt/aksel-icons";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { NextDeadlines } from "@/components/assessment/NextDeadlines";
import { CopyButton } from "@/components/CopyButton";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment } from "@/lib/data";
import { todayInNorway } from "@/lib/dates";
import { pick } from "@/lib/localized";
import pages from "../../pages.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]">) {
  return assessmentMetadata((await params).id, "overview");
}

// The overview of an assessment: what needs attention and what is next.
// The links in the emails and the calendar lead here.
export default async function OverviewPage({
  params,
  searchParams,
}: PageProps<"/assessments/[id]">) {
  const { id } = await params;
  const { updated } = await searchParams;
  const t = await getTranslations("assessment");
  const locale = await getLocale();
  const assessment = await getAssessment(id);
  // The layout shows why there is no assessment
  if (!assessment.ok) return null;

  const { company, result } = assessment.data;

  return (
    <>
      {updated === "1" && (
        <Alert data-color="success" role="status">
          <Paragraph>{t("updated")}</Paragraph>
        </Alert>
      )}

      {assessment.data.answersNeedUpdate && (
        <Alert data-color="warning">
          <Heading level={2} data-size="xs">
            {t("answersOutdatedTitle")}
          </Heading>
          <Paragraph>{t("answersOutdatedText")}</Paragraph>
          <Link asChild>
            <NextLink href={`/assessments/${id}/answers`}>
              {t("answersOutdatedLink")}
            </NextLink>
          </Link>
        </Alert>
      )}

      {result.supported ? (
        <>
          {result.warnings.map((warning) => (
            <Alert key={warning.id} data-color="warning">
              <Paragraph>{pick(warning.message, locale)}</Paragraph>
              <Link href={warning.sourceUrl} target="_blank" rel="noreferrer">
                {t("warningSource")}
              </Link>
            </Alert>
          ))}

          <section aria-labelledby="next" className={pages.section}>
            <Heading level={2} data-size="md" id="next">
              {t("nextTitle")}
            </Heading>
            <NextDeadlines
              obligations={result.obligations}
              today={todayInNorway()}
              linkBase={`/assessments/${id}/obligations`}
            />
            <Button asChild variant="secondary">
              <NextLink href={`/assessments/${id}/obligations`}>
                {t("allObligations", { count: result.obligations.length })}
                <ArrowRightIcon aria-hidden />
              </NextLink>
            </Button>
          </section>
        </>
      ) : (
        <Alert data-color="info">
          <Heading level={2} data-size="xs">
            {t("notSupportedTitle")}
          </Heading>
          <Paragraph>
            {t("notSupportedText", {
              form: company.organizationFormDescription,
            })}
          </Paragraph>
        </Alert>
      )}

      <Alert data-color="info">
        <Heading level={2} data-size="xs">
          {t("saveLinkTitle")}
        </Heading>
        <Paragraph>{t("saveLinkText")}</Paragraph>
        <div className={pages.alertActions}>
          <CopyButton label={t("copyLink")} copiedLabel={t("copied")} />
        </div>
      </Alert>
    </>
  );
}
