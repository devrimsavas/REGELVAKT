import { Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { QuestionsForm } from "@/components/QuestionsForm";
import { updateAnswers } from "@/lib/actions";
import { apiErrorOf } from "@/lib/apiErrors";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment, getAssessmentQuestions } from "@/lib/data";
import pages from "../../../pages.module.css";
import { NotSupported } from "../NotSupported";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/answers">) {
  return assessmentMetadata((await params).id, "answers");
}

// The answers, ready to be changed, and deleting the page
export default async function AnswersPage({
  params,
}: PageProps<"/assessments/[id]/answers">) {
  const { id } = await params;
  const t = await getTranslations("assessment");
  const tabs = await getTranslations("tabs");
  const questionsText = await getTranslations("questions");
  const deleting = await getTranslations("deletePage");
  const [assessment, questions] = await Promise.all([
    getAssessment(id),
    getAssessmentQuestions(id),
  ]);
  if (!assessment.ok) return null;
  if (!assessment.data.result.supported) {
    return <NotSupported company={assessment.data.company} />;
  }

  return (
    <>
      <section aria-labelledby="answers" className={pages.section}>
        <Heading level={2} data-size="md" id="answers">
          {tabs("answers")}
        </Heading>
        <Paragraph className={pages.lead}>{t("answersLead")}</Paragraph>
        {questions.ok ? (
          <QuestionsForm
            questions={questions.data.questions}
            answers={questions.data.answers}
            action={updateAnswers.bind(null, id)}
            submitLabel={questionsText("submitUpdate")}
          />
        ) : (
          <ApiErrorAlert error={apiErrorOf(questions, "assessment")} />
        )}
      </section>

      <section aria-labelledby="delete" className={pages.section}>
        <Heading level={2} data-size="sm" id="delete">
          {t("dangerTitle")}
        </Heading>
        <Paragraph className={pages.lead}>{t("deleteLead")}</Paragraph>
        <Link asChild data-color="danger">
          <NextLink href={`/assessments/${id}/delete`}>
            {deleting("link")}
          </NextLink>
        </Link>
      </section>
    </>
  );
}
