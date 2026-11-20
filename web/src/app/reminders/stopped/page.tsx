import { Alert, Heading, Link, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import pages from "../../pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage");
  return {
    title: t("stoppedTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function StoppedPage() {
  const t = await getTranslations("manage");
  return (
    <div className={`container ${pages.page}`}>
      <Heading level={1} data-size="lg">
        {t("stoppedTitle")}
      </Heading>
      <Alert data-color="success" role="status">
        <Paragraph>{t("stoppedText")}</Paragraph>
      </Alert>
      <Link asChild>
        <NextLink href="/">{t("home")}</NextLink>
      </Link>
    </div>
  );
}
