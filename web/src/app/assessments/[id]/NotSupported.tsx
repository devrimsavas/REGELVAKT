import { Alert, Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import type { Company } from "@/lib/types";

// Shown on a tab when the rules do not cover the company's form
export async function NotSupported({ company }: { company: Company }) {
  const t = await getTranslations("assessment");
  return (
    <Alert data-color="info">
      <Heading level={2} data-size="xs">
        {t("notSupportedTitle")}
      </Heading>
      <Paragraph>
        {t("notSupportedText", { form: company.organizationFormDescription })}
      </Paragraph>
    </Alert>
  );
}
