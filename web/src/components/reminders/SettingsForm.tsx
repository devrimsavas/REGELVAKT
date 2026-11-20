"use client";

import {
  Alert,
  Button,
  Fieldset,
  FieldsetLegend,
  Paragraph,
  Radio,
} from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { submitKeepingFields } from "@/lib/forms";
import { type SettingsState, saveSettings } from "@/lib/reminderActions";
import type { SubscriptionView } from "@/lib/reminders";
import styles from "./reminders.module.css";
import { ReminderDays } from "./ReminderDays";

const INITIAL: SettingsState = {
  saved: false,
  daysMissing: false,
  invalid: false,
  error: null,
};

// When the reminders come and in which language
export function SettingsForm({
  token,
  subscription,
}: {
  token: string;
  subscription: SubscriptionView;
}) {
  const t = useTranslations("manage");
  const languages = useTranslations("languages");
  const errors = useTranslations("apiErrors");
  const [state, action, pending] = useActionState(
    saveSettings.bind(null, token),
    INITIAL,
  );

  return (
    <form
      action={action}
      onSubmit={submitKeepingFields(action)}
      noValidate
      className={styles.form}
    >
      {state.saved && (
        <Alert data-color="success" role="status">
          <Paragraph>{t("saved")}</Paragraph>
        </Alert>
      )}
      {state.invalid && (
        <Alert data-color="warning">
          <Paragraph>{t("invalidText")}</Paragraph>
        </Alert>
      )}
      {state.error && (
        <Alert data-color="danger">
          <Paragraph>
            {errors(state.error.key, { minutes: state.error.minutes ?? 1 })}
          </Paragraph>
        </Alert>
      )}
      <ReminderDays
        initial={subscription.reminderDays}
        missing={state.daysMissing}
      />
      <Fieldset>
        <FieldsetLegend>{t("language")}</FieldsetLegend>
        {(["nb", "en"] as const).map((language) => (
          <Radio
            key={language}
            name="language"
            value={language}
            lang={language}
            label={languages(language)}
            defaultChecked={subscription.language === language}
          />
        ))}
      </Fieldset>
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
