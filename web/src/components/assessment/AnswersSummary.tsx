import { getLocale, getTranslations } from "next-intl/server";
import { pick } from "@/lib/localized";
import type { Answers, Question } from "@/lib/types";
import styles from "./assessment.module.css";

// The questions with the answers given, in the words of the form
export async function AnswersSummary({
  questions,
  answers,
}: {
  questions: Question[];
  answers: Answers;
}) {
  const t = await getTranslations("questions");
  const locale = await getLocale();

  function answerText(question: Question): string {
    const value = answers[question.id];
    if (value === true) return t("yes");
    if (value === false) return t("no");
    const option = question.options?.find((o) => o.value === value);
    return option ? pick(option.label, locale) : "–";
  }

  return (
    <dl className={styles.answers}>
      {questions.map((question) => (
        <div key={question.id} className={styles.answerRow}>
          <dt>{pick(question.text, locale)}</dt>
          <dd>{answerText(question)}</dd>
        </div>
      ))}
    </dl>
  );
}
