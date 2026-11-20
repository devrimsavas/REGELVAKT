"use client";

import { Alert, Button, Paragraph } from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { confirmReminders, type TokenState } from "@/lib/reminderActions";

const INITIAL: TokenState = { invalid: false, error: null };

export function ConfirmForm({ token }: { token: string }) {
  const t = useTranslations("manage");
  const errors = useTranslations("apiErrors");
  const [state, action, pending] = useActionState(confirmReminders, INITIAL);

  if (state.invalid) {
    return (
      <Alert data-color="warning">
        <Paragraph>{t("invalidText")}</Paragraph>
      </Alert>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <Alert data-color="danger">
          <Paragraph>
            {errors(state.error.key, { minutes: state.error.minutes ?? 1 })}
          </Paragraph>
        </Alert>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("confirmButton")}
      </Button>
    </form>
  );
}
