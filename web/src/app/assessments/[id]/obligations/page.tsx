import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import styles from "@/components/assessment/assessment.module.css";
import { ObligationCard } from "@/components/assessment/ObligationCard";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment } from "@/lib/data";
import { todayInNorway } from "@/lib/dates";
import { byNextDeadline } from "@/lib/deadlines";
import pages from "../../../pages.module.css";
import { NotSupported } from "../NotSupported";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/obligations">) {
  return assessmentMetadata((await params).id, "obligations");
}

// Every obligation of the company, by its next deadline
export default async function ObligationsPage({
  params,
}: PageProps<"/assessments/[id]/obligations">) {
  const { id } = await params;
  const t = await getTranslations("assessment");
  const tabs = await getTranslations("tabs");
  const assessment = await getAssessment(id);
  if (!assessment.ok) return null;
  const { result } = assessment.data;
  if (!result.supported) return <NotSupported company={assessment.data.company} />;

  const today = todayInNorway();
  return (
    <section aria-labelledby="obligations" className={pages.section}>
      <Heading level={2} data-size="md" id="obligations">
        {tabs("obligations")}
      </Heading>
      <Paragraph className={pages.lead}>
        {t("obligationsLead", { count: result.obligations.length })}
      </Paragraph>
      <div className={styles.obligations}>
        {[...result.obligations].sort(byNextDeadline).map((obligation) => (
          <ObligationCard
            key={obligation.id}
            obligation={obligation}
            today={today}
          />
        ))}
      </div>
      <Paragraph data-size="sm" className={pages.lead}>
        {t("rulesVersion", { version: result.rulesVersion })}
      </Paragraph>
    </section>
  );
}
