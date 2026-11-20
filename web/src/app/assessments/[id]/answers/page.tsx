import { Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { QuestionsForm } from "@/components/QuestionsForm";
import { updateAnswers } from "@/lib/actions";
import { apiErrorOf } from "@/lib/apiErrors";
import { getAssessment, getAssessmentQuestions } from "@/lib/data";
import pages from "../../../pages.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/answers">): Promise<Metadata> {
  const { id } = await params;
  const assessment = await getAssessment(id);
  const t = await getTranslations("answersPage");
  return {
    ...(assessment.ok
      ? { title: t("metaTitle", { name: assessment.data.company.name }) }
      : {}),
    robots: { index: false, follow: false },
  };
}

// The questions again, with the current answers chosen
export default async function AnswersPage({
  params,
}: PageProps<"/assessments/[id]/answers">) {
  const { id } = await params;
  const t = await getTranslations("answersPage");
  const assessmentText = await getTranslations("assessment");
  const questionsText = await getTranslations("questions");
  const [assessment, questions] = await Promise.all([
    getAssessment(id),
    getAssessmentQuestions(id),
  ]);

  if (!assessment.ok || !questions.ok) {
    const failed = !assessment.ok ? assessment : questions;
    const missing = failed.status === 400 || failed.status === 404;
    return (
      <div className={`container ${pages.page}`}>
        <Heading level={1} data-size="lg">
          {assessmentText("notFoundTitle")}
        </Heading>
        {missing ? (
          <Paragraph>{assessmentText("notFoundText")}</Paragraph>
        ) : (
          !failed.ok && (
            <ApiErrorAlert error={apiErrorOf(failed, "assessment")} />
          )
        )}
        <Link asChild>
          <NextLink href="/">{assessmentText("newSearch")}</NextLink>
        </Link>
      </div>
    );
  }

  const back = `/assessments/${id}`;
  return (
    <div className={`container ${pages.page}`}>
      <Link asChild>
        <NextLink href={back}>{assessment.data.company.name}</NextLink>
      </Link>
      <Heading level={1} data-size="lg">
        {t("title")}
      </Heading>
      <Paragraph className={pages.lead}>
        {t("lead", { name: assessment.data.company.name })}
      </Paragraph>
      <QuestionsForm
        questions={questions.data.questions}
        answers={questions.data.answers}
        action={updateAnswers.bind(null, id)}
        submitLabel={questionsText("submitUpdate")}
        cancelHref={back}
      />
    </div>
  );
}
