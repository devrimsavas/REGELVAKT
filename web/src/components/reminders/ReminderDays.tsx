"use client";

import {
  Checkbox,
  Fieldset,
  FieldsetDescription,
  FieldsetLegend,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import { REMINDER_DAY_OPTIONS } from "@/lib/reminders";

// How many days before a deadline the reminders come: checkboxes named
// "days"
export function ReminderDays({
  initial,
  missing,
}: {
  initial: number[];
  missing: boolean;
}) {
  const t = useTranslations("reminders");

  return (
    <Fieldset data-invalid={missing || undefined}>
      <FieldsetLegend>{t("days")}</FieldsetLegend>
      <FieldsetDescription>{t("daysDescription")}</FieldsetDescription>
      {REMINDER_DAY_OPTIONS.map((days) => (
        <Checkbox
          key={days}
          name="days"
          value={String(days)}
          label={t("day", { days })}
          defaultChecked={initial.includes(days)}
        />
      ))}
      {missing && <ValidationMessage>{t("daysMissing")}</ValidationMessage>}
    </Fieldset>
  );
}
