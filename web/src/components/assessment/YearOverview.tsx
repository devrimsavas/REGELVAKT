import { Heading } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMonth, type IsoDate } from "@/lib/dates";
import { pick } from "@/lib/localized";
import type { Obligation } from "@/lib/types";
import { deadlinesByMonth } from "@/lib/year";
import styles from "./assessment.module.css";

// The coming twelve months side by side, each with its deadlines: where
// the busy months are, at a glance
// linkBase: the page with the obligation cards, which each deadline
// links to
export async function YearOverview({
  obligations,
  today,
  linkBase,
}: {
  obligations: Obligation[];
  today: IsoDate;
  linkBase: string;
}) {
  const t = await getTranslations("year");
  const locale = await getLocale();

  return (
    <ol className={styles.year}>
      {deadlinesByMonth(obligations, today).map(({ month, deadlines }) => (
        <li key={month} className={styles.month}>
          <Heading level={3} data-size="2xs" className={styles.monthName}>
            {formatMonth(month, locale)}
          </Heading>
          {deadlines.length === 0 ? (
            <span className={styles.noDeadlines}>{t("none")}</span>
          ) : (
            <ul className={styles.monthDeadlines}>
              {deadlines.map(({ date, obligation }) => (
                <li key={`${date}-${obligation.id}`}>
                  <time dateTime={date} className={styles.day}>
                    {Number(date.slice(8))}.
                  </time>
                  <NextLink href={`${linkBase}#obligation-${obligation.id}`}>
                    {pick(obligation.title, locale)}
                  </NextLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
