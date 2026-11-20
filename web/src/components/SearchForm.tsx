"use client";

import { Button, Textfield } from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type SearchState, searchCompany } from "@/lib/actions";
import styles from "./SearchForm.module.css";

const INITIAL: SearchState = { error: null, value: "" };

// The organization number field on the front page. The number is checked
// on the server (also without JavaScript), which then goes on to the
// company's questions.
export function SearchForm() {
  const t = useTranslations("search");
  const [state, action, pending] = useActionState(searchCompany, INITIAL);

  return (
    <form action={action} noValidate className={styles.form}>
      <Textfield
        // A new key after each try keeps what was typed: React empties
        // a form's fields once its action has run
        key={`${state.error}-${state.value}`}
        label={t("label")}
        description={t("description")}
        name="orgNumber"
        defaultValue={state.value}
        inputMode="numeric"
        autoComplete="off"
        error={state.error ? t(state.error) : undefined}
        className={styles.input}
      />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
