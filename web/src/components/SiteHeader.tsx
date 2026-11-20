import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const t = await getTranslations("header");
  const locale = await getLocale();

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <NextLink href="/" className={styles.home} aria-label={t("home")}>
          <Logo />
        </NextLink>

        <div className={styles.actions}>
          <LanguageSwitcher
            target={locale === "nb" ? "en" : "nb"}
            text={t("switchLanguage")}
            label={t("switchLanguageLabel")}
          />
          <ColorSchemeToggle label={t("colorScheme")} />
        </div>
      </div>
    </header>
  );
}
