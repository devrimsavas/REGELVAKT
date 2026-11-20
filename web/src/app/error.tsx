"use client";

import { Button, Heading, Paragraph } from "@digdir/designsystemet-react";
import { useTranslations } from "next-intl";
import styles from "./status.module.css";

// Shown when a page fails while it is rendered. The details are in the
// server's log, never on the page.
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("error");

  return (
    <div className={`container ${styles.status}`}>
      <Heading level={1} data-size="lg">
        {t("title")}
      </Heading>
      <Paragraph>{t("text")}</Paragraph>
      <Button variant="secondary" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
