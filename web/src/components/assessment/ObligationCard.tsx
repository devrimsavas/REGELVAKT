import {
  Card,
  CardBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  Heading,
  Link,
  Paragraph,
} from "@digdir/designsystemet-react";
import { ExternalLinkIcon } from "@navikt/aksel-icons";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, type IsoDate } from "@/lib/dates";
import { pick } from "@/lib/localized";
import type { Obligation } from "@/lib/types";
import styles from "./assessment.module.css";
import { DeadlineDate } from "./DeadlineDate";

// One obligation: why it applies, its next deadline, all its deadlines in
// the coming year, and links to the official page and to where it is filed
export async function ObligationCard({
  obligation,
  today,
}: {
  obligation: Obligation;
  today: IsoDate;
}) {
  const t = await getTranslations("assessment");
  const footer = await getTranslations("footer");
  const locale = await getLocale();
  const headingId = `obligation-${obligation.id}`;

  return (
    <Card asChild className={styles.card}>
      <article aria-labelledby={headingId}>
        <CardBlock className={styles.cardBody}>
          <Heading level={3} data-size="sm" id={headingId}>
            {pick(obligation.title, locale)}
          </Heading>

          <dl className={styles.facts}>
            <dt>{t("nextDeadline")}</dt>
            <dd>
              {obligation.nextDeadline ? (
                <DeadlineDate date={obligation.nextDeadline} today={today} />
              ) : (
                t("noFixedDeadline")
              )}
            </dd>
            <dt>{t("why")}</dt>
            <dd>{pick(obligation.reason, locale)}</dd>
          </dl>

          <Paragraph>{pick(obligation.description, locale)}</Paragraph>

          {obligation.upcomingDeadlines.length > 1 && (
            <Details>
              <DetailsSummary>
                {t("allDeadlines", {
                  count: obligation.upcomingDeadlines.length,
                })}
              </DetailsSummary>
              <DetailsContent>
                <ul className={styles.dates}>
                  {obligation.upcomingDeadlines.map((date) => (
                    <li key={date}>
                      <time dateTime={date}>
                        {formatDate(date, locale, "short")}
                      </time>
                    </li>
                  ))}
                </ul>
              </DetailsContent>
            </Details>
          )}

          <div className={styles.links}>
            <Link href={obligation.sourceUrl} target="_blank" rel="noreferrer">
              {t("readMore")}
              <ExternalLinkIcon aria-hidden />
              <span className="visually-hidden">
                {" "}
                {footer("opensInNewTab")}
              </span>
            </Link>
            {obligation.filingUrl && (
              <Link
                href={obligation.filingUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("file")}
                <ExternalLinkIcon aria-hidden />
                <span className="visually-hidden">
                  {" "}
                  {footer("opensInNewTab")}
                </span>
              </Link>
            )}
          </div>
        </CardBlock>
      </article>
    </Card>
  );
}
