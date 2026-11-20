import { Alert, Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { assessmentMetadata } from "@/lib/assessmentPage";
import { getAssessment, getAssistantStatus } from "@/lib/data";
import pages from "../../../pages.module.css";
import { NotSupported } from "../NotSupported";

export async function generateMetadata({
  params,
}: PageProps<"/assessments/[id]/assistant">) {
  return assessmentMetadata((await params).id, "assistant");
}

// The assistant, answering for this company
export default async function CompanyAssistantPage({
  params,
}: PageProps<"/assessments/[id]/assistant">) {
  const { id } = await params;
  const t = await getTranslations("assistant");
  const [assessment, status] = await Promise.all([
    getAssessment(id),
    getAssistantStatus(),
  ]);
  if (!assessment.ok) return null;
  const { company, result } = assessment.data;
  if (!result.supported) return <NotSupported company={company} />;

  return (
    <section aria-labelledby="assistant" className={pages.section}>
      <Heading level={2} data-size="md" id="assistant">
        {t("companyTitle", { name: company.name })}
      </Heading>
      <Paragraph className={pages.lead}>{t("companyLead")}</Paragraph>
      {status.ok && !status.data.ready ? (
        <Alert data-color="info">
          <Paragraph>{t("notReady")}</Paragraph>
        </Alert>
      ) : (
        <AssistantPanel
          assessmentId={id}
          noModel={status.ok && status.data.model === null}
        />
      )}
    </section>
  );
}
