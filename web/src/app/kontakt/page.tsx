import { Heading, Paragraph } from "@digdir/designsystemet-react";
import {
  EnvelopeClosedIcon,
  GlobeIcon,
  PersonCircleIcon,
} from "@navikt/aksel-icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/lib/site";
import pages from "../pages.module.css";
import styles from "./contact.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("metaTitle") };
}

// Ways to get in touch. Only the details filled in in lib/site.ts are shown.
export default async function ContactPage() {
  const t = await getTranslations("contact");

  const channels = [
    SITE.contactEmail && {
      key: "email" as const,
      Icon: EnvelopeClosedIcon,
      href: `mailto:${SITE.contactEmail}`,
      text: SITE.contactEmail,
    },
    SITE.linkedInUrl && {
      key: "linkedin" as const,
      Icon: PersonCircleIcon,
      href: SITE.linkedInUrl,
      text: t("linkedinText"),
    },
    SITE.portfolioUrl && {
      key: "portfolio" as const,
      Icon: GlobeIcon,
      href: SITE.portfolioUrl,
      text: SITE.portfolioUrl.replace(/^https?:\/\//, ""),
    },
  ].filter((channel) => typeof channel === "object");

  return (
    <article className={`container ${pages.page}`}>
      <Heading level={1} data-size="lg">
        {t("title")}
      </Heading>
      <Paragraph data-size="lg" className={pages.lead}>
        {SITE.ownerName ? t("leadName", { name: SITE.ownerName }) : t("lead")}
      </Paragraph>

      <ul className={styles.channels}>
        {channels.map(({ key, Icon, href, text }) => (
          <li key={key}>
            <a
              href={href}
              className={styles.channel}
              {...(key === "email"
                ? {}
                : { target: "_blank", rel: "noreferrer" })}
            >
              <span className={styles.icon}>
                <Icon aria-hidden />
              </span>
              <span>
                <span className={styles.label}>{t(key)}</span>
                <span className={styles.text}>{text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <section aria-labelledby="support" className={styles.section}>
        <Heading level={2} data-size="sm" id="support">
          {t("supportTitle")}
        </Heading>
        <Paragraph>{t("support")}</Paragraph>
      </section>
    </article>
  );
}
