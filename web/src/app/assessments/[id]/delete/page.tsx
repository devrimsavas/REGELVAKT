import { Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { DeleteForm } from "@/components/DeleteForm";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment } from "@/lib/data";
import pages from "../../../pages.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/delete">) {
  return assessmentMetadata((await params).id, "delete");
}

// Asks once more before an assessment, its reminders and their email
// addresses are deleted
export default async function DeletePage({
  params,
}: PageProps<"/assessments/[id]/delete">) {
  const { id } = await params;
  const t = await getTranslations("deletePage");
  const assessment = await getAssessment(id);
  if (!assessment.ok) return null;

  return (
    <section aria-labelledby="delete" className={pages.section}>
      <Heading level={2} data-size="md" id="delete">
        {t("title")}
      </Heading>
      <Paragraph className={pages.lead}>
        {t("text", { name: assessment.data.company.name })}
      </Paragraph>
      <DeleteForm assessmentId={id} />
    </section>
  );
}
