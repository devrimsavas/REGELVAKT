import { Button, Heading, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/lib/site";
import styles from "../om/about.module.css";
import pages from "../pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("metaTitle") };
}

// What Regelvakt stores, for how long, and who else gets it. Every
// statement here follows the code: change the page when the code changes.
const SECTIONS = [
  "page",
  "reminders",
  "assistant",
  "others",
  "cookies",
  "logs",
  "rights",
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <article className={`container ${pages.page}`}>
      <Heading level={1} data-size="lg">
        {t("title")}
      </Heading>
      <Paragraph data-size="lg" className={pages.lead}>
        {t("lead")}
      </Paragraph>

      {SECTIONS.map((section) => (
        <section
          key={section}
          aria-labelledby={`privacy-${section}`}
          className={styles.section}
        >
          <Heading level={2} data-size="sm" id={`privacy-${section}`}>
            {t(`${section}Title`)}
          </Heading>
          <Paragraph>{t(section)}</Paragraph>
        </section>
      ))}

      {SITE.ownerName && (
        <Paragraph className={pages.lead}>
          {t("owner", { name: SITE.ownerName })}
        </Paragraph>
      )}
      <Button asChild variant="secondary">
        <NextLink href="/kontakt">{t("contact")}</NextLink>
      </Button>
    </article>
  );
}
