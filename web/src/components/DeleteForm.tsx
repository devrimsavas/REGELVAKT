"use client";

import { Alert, Button, Paragraph } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type DeleteState, deleteAssessment } from "@/lib/reminderActions";
import styles from "./reminders/reminders.module.css";

const INITIAL: DeleteState = { error: null };

export function DeleteForm({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("deletePage");
  const errors = useTranslations("apiErrors");
  const [state, action, pending] = useActionState(
    deleteAssessment.bind(null, assessmentId),
    INITIAL,
  );

  return (
    <form action={action} className={styles.form}>
      {state.error && (
        <Alert data-color="danger">
          <Paragraph>
            {errors(state.error.key, { minutes: state.error.minutes ?? 1 })}
          </Paragraph>
        </Alert>
      )}
      <div className={styles.actions}>
        <Button
          type="submit"
          data-color="danger"
          disabled={pending}
          aria-busy={pending}
        >
          {t("confirm")}
        </Button>
        <Button asChild variant="tertiary">
          <NextLink href={`/assessments/${assessmentId}`}>
            {t("cancel")}
          </NextLink>
        </Button>
      </div>
    </form>
  );
}
