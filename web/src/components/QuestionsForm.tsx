"use client";

import {
  Alert,
  Button,
  ErrorSummary,
  ErrorSummaryHeading,
  ErrorSummaryItem,
  ErrorSummaryLink,
  ErrorSummaryList,
  Fieldset,
  FieldsetDescription,
  FieldsetLegend,
  Paragraph,
  Radio,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { QuestionsState } from "@/lib/actions";
import { submitKeepingFields } from "@/lib/forms";
import { pick } from "@/lib/localized";
import type { Answers, Question } from "@/lib/types";
import styles from "./QuestionsForm.module.css";

const INITIAL: QuestionsState = { missing: [], error: null };

interface QuestionsFormProps {
  questions: Question[];
  // The answers to start from, when changing them
  answers?: Answers;
  // createAssessment or updateAnswers, with the org number or id bound
  action: (state: QuestionsState, formData: FormData) => Promise<QuestionsState>;
  submitLabel: string;
  cancelHref?: string;
}

// The form value of an answer: "true", "false" or the option's value
function toFormValue(value: Answers[string] | undefined): string {
  return value === undefined ? "" : String(value);
}

// The company's questions as groups of radio buttons. The answers stay
// chosen when the server sends the form back with a message.
export function QuestionsForm({
  questions,
  answers = {},
  action,
  submitLabel,
  cancelHref,
}: QuestionsFormProps) {
  const t = useTranslations("questions");
  const errors = useTranslations("apiErrors");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions.map((question) => [
        question.id,
        toFormValue(answers[question.id]),
      ]),
    ),
  );

  // A question is shown as missing until it gets an answer
  const missing = state.missing.filter((id) => !chosen[id]);

  function optionsOf(question: Question) {
    return question.type === "boolean"
      ? [
          { value: "true", label: t("yes") },
          { value: "false", label: t("no") },
        ]
      : (question.options ?? []).map((option) => ({
          value: option.value,
          label: pick(option.label, locale),
        }));
  }

  return (
    <form
      action={formAction}
      onSubmit={submitKeepingFields(formAction)}
      noValidate
      className={styles.form}
    >
      <input
        type="hidden"
        name="questionIds"
        value={questions.map((question) => question.id).join(",")}
      />

      {state.error && (
        <Alert data-color="danger">
          <Paragraph>
            {errors(state.error.key, { minutes: state.error.minutes ?? 1 })}
          </Paragraph>
        </Alert>
      )}

      {missing.length > 0 && (
        <ErrorSummary>
          <ErrorSummaryHeading>{t("missingSummary")}</ErrorSummaryHeading>
          <ErrorSummaryList>
            {questions
              .filter((question) => missing.includes(question.id))
              .map((question) => (
                <ErrorSummaryItem key={question.id}>
                  <ErrorSummaryLink href={`#${question.id}-0`}>
                    {pick(question.text, locale)}
                  </ErrorSummaryLink>
                </ErrorSummaryItem>
              ))}
          </ErrorSummaryList>
        </ErrorSummary>
      )}

      {questions.map((question) => {
        const isMissing = missing.includes(question.id);
        return (
          <Fieldset
            key={question.id}
            className={styles.question}
            data-invalid={isMissing || undefined}
          >
            <FieldsetLegend>{pick(question.text, locale)}</FieldsetLegend>
            {question.help && (
              <FieldsetDescription>
                {pick(question.help, locale)}
              </FieldsetDescription>
            )}
            {optionsOf(question).map((option, index) => (
              <Radio
                key={option.value}
                id={`${question.id}-${index}`}
                name={question.id}
                value={option.value}
                label={option.label}
                checked={chosen[question.id] === option.value}
                onChange={() =>
                  setChosen((current) => ({
                    ...current,
                    [question.id]: option.value,
                  }))
                }
              />
            ))}
            {isMissing && <ValidationMessage>{t("missing")}</ValidationMessage>}
          </Fieldset>
        );
      })}

      <div className={styles.buttons}>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {submitLabel}
        </Button>
        {cancelHref && (
          <Button asChild variant="tertiary">
            <NextLink href={cancelHref}>{t("cancel")}</NextLink>
          </Button>
        )}
      </div>
    </form>
  );
}
