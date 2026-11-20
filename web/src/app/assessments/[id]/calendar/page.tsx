import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { YearOverview } from "@/components/assessment/YearOverview";
import { CalendarSection } from "@/components/reminders/CalendarSection";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment } from "@/lib/data";
import { todayInNorway } from "@/lib/dates";
import pages from "../../../pages.module.css";
import { NotSupported } from "../NotSupported";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/calendar">) {
  return assessmentMetadata((await params).id, "calendar");
}

// The year ahead month by month, and the calendar to subscribe to
export default async function CalendarPage({
  params,
}: PageProps<"/assessments/[id]/calendar">) {
  const { id } = await params;
  const year = await getTranslations("year");
  const calendar = await getTranslations("calendar");
  const assessment = await getAssessment(id);
  if (!assessment.ok) return null;
  const { result } = assessment.data;
  if (!result.supported) return <NotSupported company={assessment.data.company} />;

  return (
    <>
      <section aria-labelledby="year" className={pages.section}>
        <Heading level={2} data-size="md" id="year">
          {year("title")}
        </Heading>
        <Paragraph className={pages.lead}>{year("lead")}</Paragraph>
        <YearOverview
          obligations={result.obligations}
          today={todayInNorway()}
          linkBase={`/assessments/${id}/obligations`}
        />
      </section>
      <section aria-labelledby="subscribe" className={pages.section}>
        <Heading level={2} data-size="md" id="subscribe">
          {calendar("title")}
        </Heading>
        <CalendarSection assessmentId={id} />
      </section>
    </>
  );
}
