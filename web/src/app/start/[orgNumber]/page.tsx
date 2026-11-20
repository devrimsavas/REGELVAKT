import { Alert, Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { CompanySummary } from "@/components/CompanySummary";
import { QuestionsForm } from "@/components/QuestionsForm";
import { createAssessment } from "@/lib/actions";
import { apiErrorOf } from "@/lib/apiErrors";
import { getCompany, getCompanyQuestions } from "@/lib/data";
import { isValidOrgNumber } from "@/lib/orgNumber";
import styles from "../../pages.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/start/[orgNumber]">): Promise<Metadata> {
  const { orgNumber } = await params;
  if (!isValidOrgNumber(orgNumber)) return {};
  const company = await getCompany(orgNumber);
  if (!company.ok) return {};
  const t = await getTranslations("start");
  return { title: t("metaTitle", { name: company.data.name }) };
}

// The company found by its organization number, and the questions the
// rules need answered
export default async function StartPage({
  params,
}: PageProps<"/start/[orgNumber]">) {
  const { orgNumber } = await params;
  if (!isValidOrgNumber(orgNumber)) notFound();

  const t = await getTranslations("start");
  const questionsText = await getTranslations("questions");
  const [company, questions] = await Promise.all([
    getCompany(orgNumber),
    getCompanyQuestions(orgNumber),
  ]);

  const back = (
    <Link asChild>
      <NextLink href="/">{t("back")}</NextLink>
    </Link>
  );

  if (!company.ok || !questions.ok) {
    const failed = !company.ok ? company : questions;
    return (
      <div className={`container ${styles.page}`}>
        {back}
        <Heading level={1} data-size="lg">
          {t("errorTitle")}
        </Heading>
        {!failed.ok && <ApiErrorAlert error={apiErrorOf(failed)} />}
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      {back}
      <CompanySummary company={company.data} />

      {questions.data.supported ? (
        <section aria-labelledby="questions" className={styles.section}>
          <Heading level={2} data-size="md" id="questions">
            {t("questionsTitle")}
          </Heading>
          <Paragraph className={styles.lead}>{t("questionsLead")}</Paragraph>
          <QuestionsForm
            questions={questions.data.questions}
            action={createAssessment.bind(null, orgNumber)}
            submitLabel={questionsText("submitCreate")}
          />
        </section>
      ) : (
        <Alert data-color="info">
          <Heading level={2} data-size="xs">
            {t("notSupportedTitle")}
          </Heading>
          <Paragraph>
            {t("notSupportedText", {
              name: company.data.name,
              form: company.data.organizationFormDescription,
            })}
          </Paragraph>
        </Alert>
      )}
    </div>
  );
}
