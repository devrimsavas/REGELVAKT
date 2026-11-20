import {
  Button,
  Details,
  DetailsContent,
  DetailsSummary,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react";
import { CalendarIcon, DownloadIcon } from "@navikt/aksel-icons";
import { getLocale, getTranslations } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { publicOrigin } from "@/lib/origin";
import styles from "./reminders.module.css";

// The address calendar apps subscribe to. It is on the web app's own
// domain (app/calendar), which passes the request on to the API.
export async function CalendarSection({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const t = await getTranslations("calendar");
  const locale = await getLocale();
  const address = `${await publicOrigin()}/calendar/${assessmentId}.ics?lang=${locale}`;
  // webcal:// opens the address in the calendar app instead of downloading
  const webcal = address.replace(/^https?:/, "webcal:");

  return (
    <div className={styles.calendar}>
      <Paragraph>{t("lead")}</Paragraph>
      <div className={styles.address}>
        <Textfield label={t("address")} value={address} readOnly />
        <CopyButton label={t("copy")} copiedLabel={t("copied")} text={address} />
      </div>
      <div className={styles.actions}>
        <Button asChild variant="secondary">
          <a href={webcal}>
            <CalendarIcon aria-hidden />
            {t("open")}
          </a>
        </Button>
        <Button asChild variant="tertiary">
          <a href={`${address}&download=1`} download>
            <DownloadIcon aria-hidden />
            {t("download")}
          </a>
        </Button>
      </div>
      <Paragraph data-size="sm">{t("downloadNote")}</Paragraph>
      <Details>
        <DetailsSummary>{t("howTitle")}</DetailsSummary>
        <DetailsContent>
        <ul className={styles.steps}>
          <li>{t("google")}</li>
          <li>{t("outlook")}</li>
          <li>{t("apple")}</li>
        </ul>
        </DetailsContent>
      </Details>
      <Paragraph data-size="sm">{t("privacy")}</Paragraph>
    </div>
  );
}
