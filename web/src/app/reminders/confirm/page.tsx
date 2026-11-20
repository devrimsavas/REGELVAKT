import { Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ConfirmForm } from "@/components/reminders/ConfirmForm";
import pages from "../../pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage");
  return { title: t("confirmTitle"), robots: { index: false, follow: false } };
}

// The page the confirmation email links to. The reminders start when the
// button is pressed, not when the link is opened.
export default async function ConfirmPage({
  searchParams,
}: PageProps<"/reminders/confirm">) {
  const { token } = await searchParams;
  const t = await getTranslations("manage");

  if (typeof token !== "string" || token === "") {
    return (
      <div className={`container ${pages.page}`}>
        <Heading level={1} data-size="lg">
          {t("invalidTitle")}
        </Heading>
        <Paragraph>{t("invalidText")}</Paragraph>
        <Link asChild>
          <NextLink href="/">{t("home")}</NextLink>
        </Link>
      </div>
    );
  }

  return (
    <div className={`container ${pages.page}`}>
      <Heading level={1} data-size="lg">
        {t("confirmTitle")}
      </Heading>
      <Paragraph>{t("confirmText")}</Paragraph>
      <ConfirmForm token={token} />
    </div>
  );
}
