import { Button, Heading, Paragraph } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import styles from "./status.module.css";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className={`container ${styles.status}`}>
      <Heading level={1} data-size="lg">
        {t("title")}
      </Heading>
      <Paragraph>{t("text")}</Paragraph>
      <Button asChild variant="secondary">
        <NextLink href="/">{t("back")}</NextLink>
      </Button>
    </div>
  );
}
