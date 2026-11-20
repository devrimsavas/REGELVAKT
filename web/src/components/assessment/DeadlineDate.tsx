import { getLocale, getTranslations } from "next-intl/server";
import { daysBetween, formatDate, type IsoDate } from "@/lib/dates";
import styles from "./assessment.module.css";

// A deadline as a date and how far off it is: "tirsdag 10. desember 2026 ·
// om 20 dager"
export async function DeadlineDate({
  date,
  today,
}: {
  date: IsoDate;
  today: IsoDate;
}) {
  const locale = await getLocale();
  const t = await getTranslations("when");
  const days = daysBetween(today, date);
  const when =
    days === 0
      ? t("today")
      : days === 1
        ? t("tomorrow")
        : t("inDays", { days });

  return (
    <span className={styles.deadline}>
      <time dateTime={date}>
        {formatDate(date, locale)}
      </time>
      <span className={days <= 7 ? styles.soon : styles.later}>{when}</span>
    </span>
  );
}
