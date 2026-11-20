import { Link, Paragraph } from "@digdir/designsystemet-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import styles from "./SiteFooter.module.css";

// The official sources the rules and the assistant are built on
const SOURCES = [
  { key: "skatteetaten", url: "https://www.skatteetaten.no/" },
  { key: "brreg", url: "https://www.brreg.no/" },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const header = await getTranslations("header");
  const pagesLinks = [
    { href: "/assistent", text: header("assistant") },
    { href: "/om", text: header("about") },
    { href: "/kontakt", text: header("contact") },
    { href: "/personvern", text: header("privacy") },
  ];

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.columns}`}>
        <div className={styles.brand}>
          <Logo />
          <Paragraph data-size="sm">{t("tagline")}</Paragraph>
        </div>

        <nav aria-labelledby="footer-pages">
          <h2 id="footer-pages" className={styles.heading}>
            {t("pages")}
          </h2>
          <ul className={styles.list}>
            {pagesLinks.map((link) => (
              <li key={link.href}>
                <Link asChild>
                  <NextLink href={link.href}>{link.text}</NextLink>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-sources">
          <h2 id="footer-sources" className={styles.heading}>
            {t("sources")}
          </h2>
          <ul className={styles.list}>
            {SOURCES.map((source) => (
              <li key={source.key}>
                <Link href={source.url} target="_blank" rel="noreferrer">
                  {t(source.key)}
                  <span className="visually-hidden"> {t("opensInNewTab")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={`container ${styles.legal}`}>
        <Paragraph data-size="xs">
          {t("notAdvice")} {t("inDevelopment")}
        </Paragraph>
      </div>
    </footer>
  );
}
