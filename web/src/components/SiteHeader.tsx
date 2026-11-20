import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const t = await getTranslations("header");
  const menu = await getTranslations("menu");
  const locale = await getLocale();

  const links = [
    { href: "/assistent", text: t("assistant"), icon: "robot" as const },
    { href: "/om", text: t("about") },
    { href: "/kontakt", text: t("contact") },
  ];

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <NextLink href="/" className={styles.home} aria-label={t("home")}>
          <Logo />
        </NextLink>

        <nav className={styles.nav} aria-label={t("menu")}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} icon={link.icon}>
                  {link.text}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <LanguageSwitcher
            target={locale === "nb" ? "en" : "nb"}
            text={t("switchLanguage")}
            label={t("switchLanguageLabel")}
          />
          <ColorSchemeToggle label={t("colorScheme")} />
          <MobileMenu label={menu("open")} links={links} />
        </div>
      </div>
    </header>
  );
}
