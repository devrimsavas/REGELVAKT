import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/components/SearchForm";
import styles from "./page.module.css";

const STEPS = ["step1", "step2", "step3"] as const;

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="container">
      <section className={styles.hero}>
        <Heading level={1} data-size="xl">
          {t("title")}
        </Heading>
        <Paragraph data-size="lg" className={styles.lead}>
          {t("lead")}
        </Paragraph>
        <SearchForm />
      </section>

      <section aria-labelledby="how">
        <Heading level={2} data-size="md" id="how">
          {t("howTitle")}
        </Heading>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step} className={styles.step}>
              <Heading level={3} data-size="xs">
                {t(`${step}Title`)}
              </Heading>
              <Paragraph>{t(`${step}Text`)}</Paragraph>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
