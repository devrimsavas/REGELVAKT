"use client";

import { Alert, Button, Paragraph } from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { stopReminders, type TokenState } from "@/lib/reminderActions";

const INITIAL: TokenState = { invalid: false, error: null };

export function StopForm({ token }: { token: string }) {
  const t = useTranslations("manage");
  const errors = useTranslations("apiErrors");
  const [state, action, pending] = useActionState(
    stopReminders.bind(null, token),
    INITIAL,
  );

  return (
    <form action={action}>
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
      <Button
        type="submit"
        variant="secondary"
        data-color="danger"
        disabled={pending}
        aria-busy={pending}
      >
        {t("stopButton")}
      </Button>
    </form>
  );
}
