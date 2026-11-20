import { Button, Heading, Paragraph } from "@digdir/designsystemet-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/lib/site";
import pages from "../pages.module.css";
import styles from "./about.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("metaTitle") };
}

const SECTIONS = ["why", "how", "covers", "assistant", "not"] as const;

export default async function AboutPage() {
  const t = await getTranslations("about");

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
          aria-labelledby={`about-${section}`}
          className={styles.section}
        >
          <Heading level={2} data-size="sm" id={`about-${section}`}>
            {t(`${section}Title`)}
          </Heading>
          <Paragraph>{t(section)}</Paragraph>
        </section>
      ))}

      <section aria-labelledby="about-project" className={styles.section}>
        <Heading level={2} data-size="sm" id="about-project">
          {t("projectTitle")}
        </Heading>
        <Paragraph>
          {SITE.ownerName
            ? t("projectName", { name: SITE.ownerName })
            : t("project")}
        </Paragraph>
        <div>
          <Button asChild variant="secondary">
            <NextLink href="/kontakt">{t("contact")}</NextLink>
          </Button>
        </div>
      </section>
    </article>
  );
}
