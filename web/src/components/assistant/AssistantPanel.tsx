"use client";

import {
  Alert,
  Button,
  ChipButton,
  Heading,
  Paragraph,
  Spinner,
  Textfield,
} from "@digdir/designsystemet-react";
import { PaperplaneIcon, RobotSmileIcon } from "@navikt/aksel-icons";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import {
  type AssistantAnswer,
  excerptsMessage,
  linkCitations,
  MAX_QUESTION,
  MIN_QUESTION,
} from "@/lib/assistant";
import { type AskError, askQuestion } from "@/lib/assistantActions";
import styles from "./assistant.module.css";
import { Markdown } from "./Markdown";
import { SourceList } from "./SourceList";

interface Entry {
  id: string;
  question: string;
  answer: AssistantAnswer;
}

// How many answers stay on the page; older ones are dropped
const KEPT = 10;

const EXAMPLES = ["example1", "example2", "example3"] as const;
const COMPANY_EXAMPLES = [
  "companyExample1",
  "companyExample2",
  "companyExample3",
] as const;

// Questions to the assistant and its answers with their sources. The
// answers live in this page only: nothing is stored, and each question is
// answered on its own.
export function AssistantPanel({
  assessmentId = null,
  noModel,
  freeTier = false,
}: {
  assessmentId?: string | null;
  // No language model: the answers are excerpts only
  noModel: boolean;
  // The model is used on a free tier, which the users are told
  freeTier?: boolean;
}) {
  const t = useTranslations("assistant");
  const errors = useTranslations("apiErrors");
  const locale = useLocale();
  const baseId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<AskError | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(text: string) {
    setError(null);
    startTransition(async () => {
      const result = await askQuestion(text, assessmentId);
      if (result.ok) {
        setEntries((current) =>
          [
            ...current,
            {
              id: `${baseId}-${Date.now()}`,
              question: text.trim(),
              answer: result.answer,
            },
          ].slice(-KEPT),
        );
        setQuestion("");
      } else {
        setError(result.error);
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < MIN_QUESTION) {
      setError({ key: "tooShort" });
      return;
    }
    ask(text);
  }

  function errorText(problem: AskError): string {
    switch (problem.key) {
      case "tooShort":
      case "notReady":
      case "dailyLimit":
        return t(problem.key);
      case "tooLong":
        return t("tooLong", { max: MAX_QUESTION });
      default:
        return errors(problem.key, {
          minutes: "minutes" in problem ? (problem.minutes ?? 1) : 1,
        });
    }
  }

  const examples = assessmentId ? COMPANY_EXAMPLES : EXAMPLES;

  return (
    <div className={styles.panel} lang={locale}>
      {noModel && (
        <Alert data-color="info">
          <Paragraph>{t("noModel")}</Paragraph>
        </Alert>
      )}
      {freeTier && (
        <Alert data-color="info">
          <Paragraph>{t("freeTier")}</Paragraph>
        </Alert>
      )}

      {entries.length > 0 && (
        <ol className={styles.entries} aria-label={t("answer")}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <div className={styles.question}>
                <span className={styles.label}>{t("you")}</span>
                <Paragraph>{entry.question}</Paragraph>
              </div>
              <div className={styles.answer}>
                <span className={styles.label}>
                  <RobotSmileIcon aria-hidden className={styles.robot} />
                  {t("assistantName")}
                </span>
                {entry.answer.mode === "answer" && entry.answer.answer ? (
                  <Markdown
                    text={linkCitations(entry.answer.answer, entry.id)}
                  />
                ) : (
                  <>
                    <Paragraph>
                      {t(excerptsMessage(entry.answer.reason))}
                    </Paragraph>
                    {entry.answer.deadlines.length > 0 && (
                      <div className={styles.deadlines}>
                        <Heading level={3} data-size="2xs">
                          {t("rulesDeadlines")}
                        </Heading>
                        <ul>
                          {entry.answer.deadlines.map((deadline) => (
                            <li key={deadline.title}>
                              <strong>{deadline.title}:</strong>{" "}
                              {deadline.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                {entry.answer.sources.length > 0 && (
                  <>
                    <Heading level={3} data-size="2xs">
                      {t("sources")}
                    </Heading>
                    <SourceList
                      sources={entry.answer.sources}
                      prefix={entry.id}
                      showCited={entry.answer.mode === "answer"}
                    />
                  </>
                )}
                <Paragraph data-size="xs" className={styles.disclaimer}>
                  {entry.answer.disclaimer}
                </Paragraph>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Read out by screen readers while the assistant works */}
      <div aria-live="polite" className={styles.status}>
        {pending && (
          <>
            <RobotSmileIcon aria-hidden className={styles.robot} />
            <Spinner aria-hidden data-size="sm" />
            <span>{t("thinking")}</span>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {error && (
          <Alert data-color={error.key === "tooShort" ? "warning" : "danger"}>
            <Paragraph>{errorText(error)}</Paragraph>
          </Alert>
        )}
        <Textfield
          multiline
          rows={3}
          label={t("question")}
          description={t("questionDescription")}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          counter={MAX_QUESTION}
          maxLength={MAX_QUESTION}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            <PaperplaneIcon aria-hidden />
            {t("submit")}
          </Button>
        </div>
        {entries.length === 0 && (
          <div className={styles.examples}>
            <span className={styles.label}>{t("examples")}</span>
            <div className={styles.chips}>
              {examples.map((key) => (
                <ChipButton
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setQuestion(t(key));
                    ask(t(key));
                  }}
                >
                  {t(key)}
                </ChipButton>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
