import { Alert, Heading, Paragraph } from "@digdir/designsystemet-react";
import { RobotSmileIcon } from "@navikt/aksel-icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { getAssistantStatus } from "@/lib/data";
import pages from "../pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant");
  return { title: t("metaTitle") };
}

// The assistant for anyone, without a company
export default async function AssistantPage() {
  const t = await getTranslations("assistant");
  const status = await getAssistantStatus();

  return (
    <div className={`container ${pages.page}`}>
      <Heading level={1} data-size="lg" className={pages.iconHeading}>
        <RobotSmileIcon aria-hidden />
        {t("title")}
      </Heading>
      <Paragraph className={pages.lead}>{t("lead")}</Paragraph>
      {status.ok && !status.data.ready ? (
        <Alert data-color="info">
          <Paragraph>{t("notReady")}</Paragraph>
        </Alert>
      ) : (
        <AssistantPanel
          noModel={status.ok && status.data.model === null}
          freeTier={status.ok && status.data.freeTier}
        />
      )}
    </div>
  );
}
