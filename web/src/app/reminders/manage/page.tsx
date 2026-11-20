import { Alert, Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiErrorAlert } from "@/components/ApiErrorAlert";
import { SettingsForm } from "@/components/reminders/SettingsForm";
import { StopForm } from "@/components/reminders/StopForm";
import { apiErrorOf } from "@/lib/apiErrors";
import { getSubscription } from "@/lib/data";
import { formatOrgNumber } from "@/lib/orgNumber";
import pages from "../../pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The page every reminder email links to: change when the reminders come,
// or stop them
export default async function ManagePage({
  searchParams,
}: PageProps<"/reminders/manage">) {
  const { token, confirmed } = await searchParams;
  const t = await getTranslations("manage");
  const company = await getTranslations("company");

  const result =
    typeof token === "string" && token !== ""
      ? await getSubscription(token)
      : null;

  if (!result || !result.ok) {
    const invalid = !result || result.status === 400 || result.status === 404;
    return (
      <div className={`container ${pages.page}`}>
        <Heading level={1} data-size="lg">
          {t("invalidTitle")}
        </Heading>
        {invalid ? (
          <Paragraph>{t("invalidText")}</Paragraph>
        ) : (
          <ApiErrorAlert error={apiErrorOf(result)} />
        )}
        <Link asChild>
          <NextLink href="/">{t("home")}</NextLink>
        </Link>
      </div>
    );
  }

  const subscription = result.data;
  return (
    <div className={`container ${pages.page}`}>
      {confirmed === "1" && (
        <Alert data-color="success" role="status">
          <Paragraph>{t("confirmed")}</Paragraph>
        </Alert>
      )}
      <div>
        <Heading level={1} data-size="lg">
          {t("title", { name: subscription.companyName })}
        </Heading>
        <Paragraph className={pages.lead}>
          {company("orgNumber", {
            orgNumber: formatOrgNumber(subscription.orgNumber),
          })}
          {" · "}
          {t("sentTo", { email: subscription.email })}
        </Paragraph>
      </div>
      {subscription.status === "pending" && (
        <Alert data-color="info">
          <Paragraph>{t("pending")}</Paragraph>
        </Alert>
      )}
      <Link asChild>
        <NextLink href={`/assessments/${subscription.assessmentId}`}>
          {t("seeDeadlines")}
        </NextLink>
      </Link>

      <SettingsForm token={token as string} subscription={subscription} />

      <section aria-labelledby="stop" className={pages.section}>
        <Heading level={2} data-size="sm" id="stop">
          {t("stopTitle")}
        </Heading>
        <Paragraph className={pages.lead}>{t("stopText")}</Paragraph>
        <StopForm token={token as string} />
      </section>
    </div>
  );
}
