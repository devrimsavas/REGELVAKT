"use client";

import {
  Alert,
  Button,
  Checkbox,
  Heading,
  Paragraph,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { submitKeepingFields } from "@/lib/forms";
import { BotTrap } from "../BotTrap";
import { type SubscribeState, subscribe } from "@/lib/reminderActions";
import { DEFAULT_REMINDER_DAYS } from "@/lib/reminders";
import styles from "./reminders.module.css";
import { ReminderDays } from "./ReminderDays";

const INITIAL: SubscribeState = {
  sent: false,
  invalid: [],
  problem: null,
  email: "",
};

// Orders reminders by email for an assessment. The answer is the same
// whether or not the address already gets reminders, so the form cannot
// be used to find out whose address is in Regelvakt.
export function ReminderForm({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("reminders");
  const errors = useTranslations("apiErrors");
  const [state, action, pending] = useActionState(
    subscribe.bind(null, assessmentId),
    INITIAL,
  );

  if (state.sent) {
    return (
      <Alert data-color="success" role="status">
        <Heading level={3} data-size="xs">
          {t("sentTitle")}
        </Heading>
        <Paragraph>{t("sentText")}</Paragraph>
      </Alert>
    );
  }

  const problem =
    state.problem === "bankrupt"
      ? t("bankrupt")
      : state.problem === "sendFailed"
        ? t("sendFailed")
        : state.problem
          ? errors(state.problem.key, { minutes: state.problem.minutes ?? 1 })
          : null;

  return (
    <form
      action={action}
      onSubmit={submitKeepingFields(action)}
      noValidate
      className={styles.form}
    >
      <BotTrap />
      {problem && (
        <Alert data-color="danger">
          <Paragraph>{problem}</Paragraph>
        </Alert>
      )}
      <Textfield
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        error={state.invalid.includes("email") ? t("emailInvalid") : undefined}
        className={styles.email}
      />
      <ReminderDays
        initial={DEFAULT_REMINDER_DAYS}
        missing={state.invalid.includes("days")}
      />
      <div className={styles.consent}>
        <Checkbox
          name="consent"
          value="yes"
          label={t("consent")}
          description={t("consentDescription")}
          aria-invalid={state.invalid.includes("consent") || undefined}
        />
        {state.invalid.includes("consent") && (
          <ValidationMessage>{t("consentMissing")}</ValidationMessage>
        )}
      </div>
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
