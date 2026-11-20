import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { ReminderForm } from "@/components/reminders/ReminderForm";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment } from "@/lib/data";
import pages from "../../../pages.module.css";
import { NotSupported } from "../NotSupported";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/reminders">) {
  return assessmentMetadata((await params).id, "reminders");
}

export default async function RemindersPage({
  params,
}: PageProps<"/assessments/[id]/reminders">) {
  const { id } = await params;
  const t = await getTranslations("reminders");
  const assessment = await getAssessment(id);
  if (!assessment.ok) return null;
  const { company, result } = assessment.data;
  if (!result.supported) return <NotSupported company={company} />;

  return (
    <section aria-labelledby="reminders" className={pages.section}>
      <Heading level={2} data-size="md" id="reminders">
        {t("title")}
      </Heading>
      {company.isBankrupt ? (
        <Paragraph className={pages.lead}>{t("bankrupt")}</Paragraph>
      ) : (
        <>
          <Paragraph className={pages.lead}>{t("lead")}</Paragraph>
          <ReminderForm assessmentId={id} />
        </>
      )}
    </section>
  );
}
