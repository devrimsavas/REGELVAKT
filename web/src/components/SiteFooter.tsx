import { Link, Paragraph } from "@digdir/designsystemet-react";
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

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.columns}`}>
        <div className={styles.brand}>
          <Logo />
          <Paragraph data-size="sm">{t("tagline")}</Paragraph>
        </div>

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
