import {
  Alert,
  Button,
  Heading,
  Link,
  Paragraph,
} from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { AnswersSummary } from "@/components/assessment/AnswersSummary";
import styles from "@/components/assessment/assessment.module.css";
import { NextDeadlines } from "@/components/assessment/NextDeadlines";
import { ObligationCard } from "@/components/assessment/ObligationCard";
import { CompanySummary } from "@/components/CompanySummary";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { apiErrorOf } from "@/lib/apiErrors";
import { getAssessment, getAssessmentQuestions } from "@/lib/data";
import { todayInNorway } from "@/lib/dates";
import { byNextDeadline } from "@/lib/deadlines";
import { pick } from "@/lib/localized";
import pages from "../../pages.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]">): Promise<Metadata> {
  const { id } = await params;
  const assessment = await getAssessment(id);
  const t = await getTranslations("assessment");
  return {
    title: assessment.ok
      ? t("metaTitle", { name: assessment.data.company.name })
      : t("notFoundTitle"),
    // The page is about one business and reached only by its link
    robots: { index: false, follow: false },
  };
}

// An assessment: the company's obligations and deadlines, worked out
// again with today's date each time the page is shown
export default async function AssessmentPage({
  params,
  searchParams,
}: PageProps<"/assessments/[id]">) {
  const { id } = await params;
  const { updated } = await searchParams;
  const t = await getTranslations("assessment");
  const locale = await getLocale();
  const [assessment, questions] = await Promise.all([
    getAssessment(id),
    getAssessmentQuestions(id),
  ]);

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

  const { company, result } = assessment.data;
  const today = todayInNorway();

  return (
    <div className={`container ${pages.page}`}>
      {newSearch}
      <CompanySummary company={company} />

      {updated === "1" && (
        <Alert data-color="success" role="status">
          <Paragraph>{t("updated")}</Paragraph>
        </Alert>
      )}

      <Alert data-color="info">
        <Heading level={2} data-size="xs">
          {t("saveLinkTitle")}
        </Heading>
        <Paragraph>{t("saveLinkText")}</Paragraph>
        <div className={styles.saveLink}>
          <CopyLinkButton label={t("copyLink")} copiedLabel={t("copied")} />
        </div>
      </Alert>

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
            <NextDeadlines obligations={result.obligations} today={today} />
          </section>

          <section aria-labelledby="obligations" className={pages.section}>
            <Heading level={2} data-size="md" id="obligations">
              {t("obligationsTitle")}
            </Heading>
            <Paragraph className={pages.lead}>
              {t("obligationsLead", { count: result.obligations.length })}
            </Paragraph>
            <div className={styles.obligations}>
              {[...result.obligations].sort(byNextDeadline).map((obligation) => (
                <ObligationCard
                  key={obligation.id}
                  obligation={obligation}
                  today={today}
                />
              ))}
            </div>
            <Paragraph data-size="sm" className={pages.lead}>
              {t("rulesVersion", { version: result.rulesVersion })}
            </Paragraph>
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

      {questions.ok && questions.data.supported && (
        <section aria-labelledby="answers" className={pages.section}>
          <Heading level={2} data-size="md" id="answers">
            {t("answersTitle")}
          </Heading>
          <AnswersSummary
            questions={questions.data.questions}
            answers={questions.data.answers}
          />
          <Button asChild variant="secondary">
            <NextLink href={`/assessments/${id}/answers`}>
              {t("editAnswers")}
            </NextLink>
          </Button>
        </section>
      )}
    </div>
  );
}
